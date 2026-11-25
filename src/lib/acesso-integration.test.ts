// Cadastro só para e-mails liberados, com o Better Auth montado (harness de
// banco do template), nos dois modos de `appConfig.accessMode`.
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

import { appConfig } from '#/config/app'
import { enforceAccess } from '#/lib/session-access'
import { createAuthHarness } from '#/test/auth-harness'

let h: Awaited<ReturnType<typeof createAuthHarness>>

beforeAll(async () => {
  h = await createAuthHarness({
    ACCESS_ALLOWLIST: '  Ana@Exemplo.test , bia@exemplo.test  ',
  })
}, 60_000)
afterAll(() => h?.dispose())

async function pedirCodigo(email: string, type = 'sign-in') {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  try {
    const res = await h.post('/email-otp/send-verification-otp', {
      email,
      type,
    })
    // O envio roda em segundo plano: dá tempo de ele aparecer, se vier.
    await new Promise((r) => setTimeout(r, 150))
    const logs = warn.mock.calls.map(([l]) => String(l))
    return { res, body: await res.json(), logs }
  } finally {
    warn.mockRestore()
  }
}

const verificacoes = async (email: string) =>
  (
    await h.db
      .prepare('select count(*) as n from verification where identifier like ?')
      .bind(`%${email}%`)
      .first<{ n: number }>()
  )?.n ?? 0
const usuarios = async (email: string) =>
  (
    await h.db
      .prepare('select count(*) as n from user where email = ?')
      .bind(email)
      .first<{ n: number }>()
  )?.n ?? 0

describe('modo lista (Better Auth montado)', () => {
  beforeEach(() => {
    appConfig.accessMode = 'allowlist'
  })
  afterEach(() => {
    appConfig.accessMode = 'open'
  })

  it('e-mail liberado recebe o código e entra, criando a conta', async () => {
    const { res, logs } = await pedirCodigo('ana@exemplo.test')
    expect(res.status).toBe(200)
    expect(logs.some((l) => l.includes('ana@exemplo.test'))).toBe(true)
    const { body } = await h.signIn('ana@exemplo.test')
    expect(body.user.id).toBeTruthy()
    expect(await usuarios('ana@exemplo.test')).toBe(1)
  })

  it('e-mail fora da lista: mesma resposta, nenhum código, nenhuma conta', async () => {
    const liberado = await pedirCodigo('bia@exemplo.test')
    const fora = await pedirCodigo('intruso@exemplo.test')
    expect(fora.res.status).toBe(liberado.res.status)
    expect(fora.body).toEqual(liberado.body)
    expect(fora.logs.some((l) => l.includes('intruso@'))).toBe(false)
    // Fica gravada a verificação (o código gerado nunca é entregue), para o
    // pedido ser igual ao do e-mail liberado; nenhum usuário.
    expect(await verificacoes('intruso@exemplo.test')).toBe(1)
    expect(await usuarios('intruso@exemplo.test')).toBe(0)
  })

  it('o pedido de código faz as mesmas consultas ao banco dentro e fora da lista', async () => {
    // Causa do tempo diferente: cada versão do Better Auth muda as consultas do
    // caminho liberado (a 1.7.28 passou a apagar e recriar a verificação). O
    // formato (verbo e tabela, em ordem) tem de ser o mesmo nos dois caminhos,
    // no 1º pedido e no repetido, que é quando já existe uma verificação.
    // Estado inicial igual: os testes anteriores já deixaram verificações.
    await h.db
      .prepare(
        'delete from verification where identifier like ? or identifier like ?',
      )
      .bind('%bia@exemplo.test', '%intruso-formato@exemplo.test')
      .run()
    const consultas: string[] = []
    const real = h.env.DB
    const espiado = new Proxy(real, {
      get(alvo, prop) {
        if (prop !== 'prepare') return Reflect.get(alvo, prop)
        return (sql: string) => {
          const m =
            /^\s*(select|insert|update|delete)\b[\s\S]*?\b(?:from|into|update)\s+"?(\w+)"?/i.exec(
              sql,
            )
          consultas.push(
            m ? `${m[1]?.toLowerCase()} ${m[2]}` : sql.slice(0, 30),
          )
          return alvo.prepare(sql)
        }
      },
    })
    Object.defineProperty(h.env, 'DB', { value: espiado, configurable: true })
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      const formato = async (email: string) => {
        consultas.length = 0
        const res = await h.post('/email-otp/send-verification-otp', {
          email,
          type: 'sign-in',
        })
        await res.text()
        expect(res.status).toBe(200)
        return [...consultas]
      }
      const dentro1 = await formato('bia@exemplo.test')
      const dentro2 = await formato('bia@exemplo.test')
      const fora1 = await formato('intruso-formato@exemplo.test')
      const fora2 = await formato('intruso-formato@exemplo.test')
      expect(fora1).toEqual(dentro1)
      expect(fora2).toEqual(dentro2)
    } finally {
      warn.mockRestore()
      Object.defineProperty(h.env, 'DB', { value: real, configurable: true })
    }
  })

  it('o pedido de código leva o mesmo tempo dentro e fora da lista', {
    timeout: 30_000,
  }, async () => {
    const mediana = (xs: number[]) =>
      [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)] ?? 0
    const tempo = async (email: string) => {
      const t0 = performance.now()
      const res = await h.post('/email-otp/send-verification-otp', {
        email,
        type: 'sign-in',
      })
      await res.text()
      const duracao = performance.now() - t0
      expect(res.status).toBe(200)
      return duracao
    }
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const RODADAS = 3
    try {
      await tempo('ana@exemplo.test')
      await tempo('intruso-tempo@exemplo.test')
      // O ruído da máquina pode afetar uma rodada isolada. Uma gravação
      // só para quem está na lista aumenta a diferença em todas as rodadas.
      for (let r = 1; r <= RODADAS; r++) {
        const dentro: number[] = []
        const fora: number[] = []
        // Alternados, para o ruído da máquina pesar igual nos dois lados. Os dois
        // lados repetem o MESMO e-mail: a 1.7.28 do Better Auth apaga a
        // verificação anterior do identificador antes de gravar, então o tempo
        // depende de já existir uma (estado), não de estar na lista. Com um
        // e-mail novo por pedido de fora, a comparação misturava as duas coisas.
        // O formato das consultas, inclusive no 1º pedido, é conferido no teste
        // "faz as mesmas consultas".
        for (let i = 0; i < 25; i++) {
          dentro.push(await tempo('bia@exemplo.test'))
          fora.push(await tempo('intruso-tempo@exemplo.test'))
        }
        const medianaDentro = mediana(dentro)
        const medianaFora = mediana(fora)
        const diferenca = Math.abs(medianaDentro - medianaFora)
        const limite = Math.max(3, medianaDentro * 0.25)
        console.info(
          `[tempo] rodada ${r}/${RODADAS}: dentro ${medianaDentro.toFixed(2)} ms, fora ${medianaFora.toFixed(2)} ms, diferença ${diferenca.toFixed(2)} ms, limite ${limite.toFixed(2)} ms`,
        )
        if (diferenca < limite) return
      }
      expect.fail(
        `A diferença atingiu ou superou o limite nas ${RODADAS} rodadas`,
      )
    } finally {
      warn.mockRestore()
    }
  })

  it('fora da lista, também no tipo email-verification', async () => {
    const { res, body, logs } = await pedirCodigo(
      'intruso2@exemplo.test',
      'email-verification',
    )
    expect(res.status).toBe(200)
    expect(body).toEqual({ success: true })
    expect(logs).toHaveLength(0)
    expect(await usuarios('intruso2@exemplo.test')).toBe(0)
  })

  it('maiúsculas no pedido valem como o e-mail da lista', async () => {
    const { logs } = await pedirCodigo('ANA@exemplo.TEST')
    expect(logs.some((l) => l.includes('ana@exemplo.test'))).toBe(true)
  })

  it('e-mail com espaço dá 400 igual para quem está e para quem não está na lista', async () => {
    const dentro = await pedirCodigo(' ana@exemplo.test')
    const fora = await pedirCodigo(' intruso@exemplo.test')
    expect(dentro.res.status).toBe(400)
    expect(fora.res.status).toBe(400)
  })

  it('fora da lista não entra nem com um código de outro caminho', async () => {
    const res = await h.post('/sign-in/email-otp', {
      email: 'intruso@exemplo.test',
      otp: '123456',
    })
    expect(res.status).toBeGreaterThanOrEqual(400)
    expect(await usuarios('intruso@exemplo.test')).toBe(0)
  })

  it('usuário novo de e-mail fora da lista é recusado na criação (falha fechada)', async () => {
    const ctx = (await h.getAuth().$context) as unknown as {
      internalAdapter: {
        createUser: (u: Record<string, unknown>) => Promise<unknown>
      }
    }
    await expect(
      ctx.internalAdapter.createUser({
        email: 'direto@exemplo.test',
        name: 'Direto',
        emailVerified: true,
      }),
    ).rejects.toThrow()
    expect(await usuarios('direto@exemplo.test')).toBe(0)
  })

  it('conta existente que saiu da lista não recebe código nem entra', async () => {
    const email = 'saiu@exemplo.test'
    h.allow(email)
    await h.signIn(email)
    // sai da lista
    h.env.ACCESS_ALLOWLIST = 'ana@exemplo.test'
    const { res, logs } = await pedirCodigo(email)
    expect(res.status).toBe(200)
    expect(logs).toHaveLength(0)
    // mesmo com sessão pedida por outro caminho, a criação da sessão recusa
    const ctx = (await h.getAuth().$context) as unknown as {
      internalAdapter: { createSession: (id: string) => Promise<unknown> }
    }
    const row = await h.db
      .prepare('select id from user where email = ?')
      .bind(email)
      .first<{ id: string }>()
    await expect(
      ctx.internalAdapter.createSession(row?.id as string),
    ).rejects.toThrow()
  })

  it('lista vazia: ninguém entra, nem quem já tem conta', async () => {
    h.env.ACCESS_ALLOWLIST = ''
    const { res, logs } = await pedirCodigo('ana@exemplo.test')
    expect(res.status).toBe(200)
    expect(logs).toHaveLength(0)
    const row = await h.db
      .prepare('select id from user where email = ?')
      .bind('ana@exemplo.test')
      .first<{ id: string }>()
    const ctx = (await h.getAuth().$context) as unknown as {
      internalAdapter: { createSession: (id: string) => Promise<unknown> }
    }
    await expect(
      ctx.internalAdapter.createSession(row?.id as string),
    ).rejects.toThrow()
  })

  // Verificar o código não revela quem está na lista.
  describe('verificação do código ', () => {
    const verificar = async (email: string, otp = '000000') => {
      const res = await h.post('/sign-in/email-otp', { email, otp })
      const body = (await res.json()) as { code?: string }
      return { status: res.status, code: body.code }
    }
    const vencer = (email: string) =>
      h.db
        .prepare(
          'update verification set expires_at = ? where identifier like ?',
        )
        .bind(Date.now() - 1000, `%${email}%`)
        .run()

    it('4 tentativas erradas dão as mesmas respostas dentro e fora da lista', async () => {
      const sessoesAntes = await h.db
        .prepare('select count(*) as n from session')
        .first<{ n: number }>()
      await pedirCodigo('bia@exemplo.test')
      await pedirCodigo('fora-m1@exemplo.test')
      const dentro = []
      const fora = []
      for (let i = 0; i < 5; i++) {
        dentro.push(await verificar('bia@exemplo.test'))
        fora.push(await verificar('fora-m1@exemplo.test'))
      }
      expect(fora).toEqual(dentro)
      // Prova que o teste enxerga o desfecho "esgotadas" (e não só INVALID_OTP).
      expect(dentro.map((r) => r.code)).toContain('TOO_MANY_ATTEMPTS')
      expect(dentro[3]?.status).toBe(403)
      expect(await usuarios('fora-m1@exemplo.test')).toBe(0)
      const sessoes = await h.db
        .prepare('select count(*) as n from session')
        .first<{ n: number }>()
      expect(sessoes?.n).toBe(sessoesAntes?.n)
    })

    it('código expirado dá a mesma resposta dentro e fora da lista', async () => {
      // Um de cada vez: o Better Auth apaga TODAS as verificações vencidas a
      // cada consulta, então vencer as duas juntas faria a primeira consulta
      // limpar a outra (igual para quem está e quem não está na lista).
      await pedirCodigo('ana@exemplo.test')
      await vencer('ana@exemplo.test')
      const dentro = await verificar('ana@exemplo.test')
      await pedirCodigo('fora-m1b@exemplo.test')
      await vencer('fora-m1b@exemplo.test')
      const fora = await verificar('fora-m1b@exemplo.test')
      expect(fora).toEqual(dentro)
      expect(dentro.code).toBe('OTP_EXPIRED')
    })

    it('fora da lista, o código nunca vale e não cria conta nem sessão', async () => {
      await pedirCodigo('fora-m1c@exemplo.test')
      const r = await verificar('fora-m1c@exemplo.test', '123456')
      expect(r.status).toBe(400)
      expect(await usuarios('fora-m1c@exemplo.test')).toBe(0)
    })
  })

  // Quem sai da lista perde também as sessões já abertas.
  describe('sessões abertas de quem saiu da lista ', () => {
    it('com sessão aberta e fora da lista: sem sessão e sessões apagadas', async () => {
      const email = 'bia@exemplo.test'
      h.env.ACCESS_ALLOWLIST = 'ana@exemplo.test,bia@exemplo.test'
      const { cookie, body } = await h.signIn(email)
      const ler = async (semCache = false) => {
        const request = new Request('http://localhost:3000/app', {
          headers: { cookie },
        })
        const atual = await h.getAuth(request).api.getSession({
          headers: request.headers,
          query: semCache ? { disableCookieCache: true } : undefined,
        })
        return enforceAccess(h.env, atual)
      }
      expect((await ler())?.user.id).toBe(body.user.id)
      h.env.ACCESS_ALLOWLIST = 'ana@exemplo.test'
      expect(await ler()).toBeNull()
      const restantes = await h.db
        .prepare('select count(*) as n from session where user_id = ?')
        .bind(body.user.id)
        .first<{ n: number }>()
      expect(restantes?.n).toBe(0)
      // Voltar à lista não ressuscita a sessão apagada (lendo o banco).
      h.env.ACCESS_ALLOWLIST = 'ana@exemplo.test,bia@exemplo.test'
      expect(await ler(true)).toBeNull()
    })
  })
})

describe('modo aberto (padrão do template)', () => {
  it('qualquer e-mail recebe código e cria conta, com a lista vazia', async () => {
    expect(appConfig.accessMode).toBe('open')
    h.env.ACCESS_ALLOWLIST = ''
    const { res, logs } = await pedirCodigo('qualquer@exemplo.test')
    expect(res.status).toBe(200)
    expect(logs.some((l) => l.includes('qualquer@exemplo.test'))).toBe(true)
    const { body } = await h.signIn('qualquer@exemplo.test')
    expect(body.user.id).toBeTruthy()
    expect(await usuarios('qualquer@exemplo.test')).toBe(1)
  })

  it('a sessão de quem não está na lista continua valendo', async () => {
    h.env.ACCESS_ALLOWLIST = ''
    const { cookie, body } = await h.signIn('aberto@exemplo.test')
    const request = new Request('http://localhost:3000/app', {
      headers: { cookie },
    })
    const atual = await h.getAuth(request).api.getSession({
      headers: request.headers,
    })
    expect((await enforceAccess(h.env, atual))?.user.id).toBe(body.user.id)
  })
})
