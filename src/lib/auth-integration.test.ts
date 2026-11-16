import { env as testEnv } from 'cloudflare:workers'
import { decryptOAuthToken, setTokenUtil } from 'better-auth/oauth2'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { type AuditRecord, onAudit } from '#/lib/audit'
import { otpHasher } from '#/lib/auth-config'

import { createAuthHarness } from '#/test/auth-harness'

let h: Awaited<ReturnType<typeof createAuthHarness>>

beforeAll(async () => {
  h = await createAuthHarness({ PASSWORD_LOGIN_ENABLED: 'true' })
}, 60_000)
afterAll(() => h?.dispose())

describe('senha contra as mais comuns (Better Auth montado)', () => {
  it('recusa senha comum no cadastro com PASSWORD_TOO_COMMON', async () => {
    const res = await h.post('/sign-up/email', {
      email: 'comum@exemplo.test',
      password: 'password123',
      name: 'Comum',
    })
    expect(res.status).toBe(400)
    expect(((await res.json()) as { code: string }).code).toBe(
      'PASSWORD_TOO_COMMON',
    )
  })

  it('aceita senha boa no cadastro', async () => {
    const res = await h.post('/sign-up/email', {
      email: 'boa@exemplo.test',
      password: 'cavalo-bateria-grampo-7',
      name: 'Boa',
    })
    expect(res.status).toBe(200)
  })
})

describe('/update-user (Better Auth montado)', () => {
  it('descarta image externa e corta o nome', async () => {
    const { cookie, body } = await h.signIn('perfil@exemplo.test')
    const res = await h.post(
      '/update-user',
      { name: 'n'.repeat(400), image: 'https://evil.com/x.png' },
      { cookie },
    )
    expect(res.status).toBe(200)
    const row = await h.db
      .prepare('select name, image from user where id = ?')
      .bind(body.user.id)
      .first<{ name: string; image: string | null }>()
    expect(row?.name).toHaveLength(100)
    expect(row?.image).toBeNull()
  })

  it('aceita a URL da foto do próprio app', async () => {
    const { cookie, body } = await h.signIn('perfil2@exemplo.test')
    const image = `/api/avatar/${body.user.id}?v=1`
    const res = await h.post('/update-user', { image }, { cookie })
    expect(res.status).toBe(200)
    const row = await h.db
      .prepare('select image from user where id = ?')
      .bind(body.user.id)
      .first<{ image: string | null }>()
    expect(row?.image).toBe(image)
  })
})

describe('rotas sem tela ficam desligadas (Better Auth montado)', () => {
  it('/change-password responde 404, mesmo logado', async () => {
    const { cookie } = await h.signIn('senha-troca@exemplo.test')
    const res = await h.post(
      '/change-password',
      { currentPassword: 'a', newPassword: 'cavalo-bateria-grampo-7' },
      { cookie },
    )
    expect(res.status).toBe(404)
  })
})

describe('tokens OAuth cifrados (Better Auth montado)', () => {
  it('encryptOAuthTokens liga e o token gravado não é o texto puro', async () => {
    // Cast: as funções do Better Auth pedem o contexto com opções genéricas.
    const ctx = (await h.getAuth().$context) as unknown as Parameters<
      typeof setTokenUtil
    >[1]
    expect(ctx.options.account?.encryptOAuthTokens).toBe(true)
    const stored = await setTokenUtil('ya29.token-de-acesso', ctx)
    expect(stored).not.toBe('ya29.token-de-acesso')
    expect(stored).not.toContain('ya29')
    expect(await decryptOAuthToken(stored as string, ctx)).toBe(
      'ya29.token-de-acesso',
    )
  })
})

describe('auditoria de saída, vínculo social e usuário novo (Better Auth montado)', () => {
  const events: AuditRecord[] = []
  let off: () => void
  beforeAll(() => {
    off = onAudit('teste-integracao', async (record) => {
      events.push(record)
    })
  })
  afterAll(() => off())

  const find = (action: string, email: string) =>
    events.find((e) => e.action === action && e.actorEmail === email)
  async function until<T>(fn: () => T | undefined): Promise<T> {
    for (let i = 0; i < 100; i++) {
      const value = fn()
      if (value) return value
      await new Promise((r) => setTimeout(r, 20))
    }
    throw new Error('evento de auditoria não apareceu')
  }

  it('registra a saída (auth.sign_out)', async () => {
    const email = 'saida@exemplo.test'
    const { cookie } = await h.signIn(email)
    const res = await h.post('/sign-out', {}, { cookie })
    expect(res.status).toBe(200)
    const event = await until(() => find('auth.sign_out', email))
    expect(event.targetType).toBe('user')
  })

  it('registra o usuário novo e o vínculo do login social', async () => {
    const ctx = (await h.getAuth().$context) as unknown as {
      internalAdapter: {
        createOAuthUser: (
          user: Record<string, unknown>,
          account: Record<string, unknown>,
        ) => Promise<unknown>
      }
    }
    const email = 'social@exemplo.test'
    await ctx.internalAdapter.createOAuthUser(
      { email, name: 'Social', emailVerified: false },
      { providerId: 'google', accountId: 'g-123' },
    )
    const created = await until(() => find('account.created', email))
    expect(created.targetType).toBe('user')
    const linked = await until(() => find('auth.account_linked', email))
    expect(JSON.parse(linked.meta ?? '{}')).toEqual({ provider: 'google' })
  })
})

describe('código de login com hash com chave (Better Auth montado)', () => {
  it('o login funciona e o banco guarda o HMAC, não o SHA-256 puro', async () => {
    const email = 'hmac@exemplo.test'
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    await h.post('/email-otp/send-verification-otp', { email, type: 'sign-in' })
    let code: string | undefined
    for (let i = 0; i < 100 && !code; i++) {
      const line = warn.mock.calls
        .map(([l]) => String(l))
        .find((l) => l.includes(email))
      code = line?.match(/(\d{6})$/)?.[1]
      if (!code) await new Promise((r) => setTimeout(r, 20))
    }
    warn.mockRestore()
    expect(code).toBeDefined()
    const row = await h.db
      .prepare('select value from verification where identifier = ?')
      .bind(`sign-in-otp-${email}`)
      .first<{ value: string }>()
    // o valor guardado é `<hash>:<tentativas>`
    const stored = row?.value.split(':')[0]
    expect(stored).toBe(
      await otpHasher(h.env.BETTER_AUTH_SECRET)(code as string),
    )
    const login = await h.post('/sign-in/email-otp', { email, otp: code })
    expect(login.status).toBe(200)
  })
})

describe('pedido de código sem provedor de e-mail (Better Auth montado)', () => {
  it('fora do dev, recusa com 503 EMAIL_NAO_CONFIGURADO, com ou sem conta', async () => {
    const { cookie } = await h.signIn('existe@exemplo.test')
    expect(cookie).toBeTruthy()
    vi.stubEnv('DEV', false)
    try {
      for (const email of ['existe@exemplo.test', 'nao-existe@exemplo.test']) {
        const res = await h.post('/email-otp/send-verification-otp', {
          email,
          type: 'sign-in',
        })
        expect(res.status).toBe(503)
        expect(((await res.json()) as { code: string }).code).toBe(
          'EMAIL_NAO_CONFIGURADO',
        )
      }
    } finally {
      vi.unstubAllEnvs()
    }
  })

  it('com RESEND_API_KEY, o pedido é aceito mesmo fora do dev', async () => {
    vi.stubEnv('DEV', false)
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('{"id":"x"}', { status: 200 }))
    Object.assign(testEnv, { RESEND_API_KEY: 're_teste' })
    try {
      const res = await h.post('/email-otp/send-verification-otp', {
        email: 'com-provedor@exemplo.test',
        type: 'sign-in',
      })
      expect(res.status).toBe(200)
    } finally {
      delete (testEnv as { RESEND_API_KEY?: string }).RESEND_API_KEY
      fetchMock.mockRestore()
      vi.unstubAllEnvs()
    }
  })
})

describe('cadastro com senha sem provedor de e-mail (Better Auth montado)', () => {
  const body = (email: string) => ({
    email,
    password: 'cavalo-bateria-grampo-7',
    name: 'Nova',
  })

  it('fora do dev, recusa com 503 EMAIL_NAO_CONFIGURADO e não cria a conta', async () => {
    vi.stubEnv('DEV', false)
    try {
      const res = await h.post(
        '/sign-up/email',
        body('sem-provedor@exemplo.test'),
      )
      expect(res.status).toBe(503)
      expect(((await res.json()) as { code: string }).code).toBe(
        'EMAIL_NAO_CONFIGURADO',
      )
      const row = await h.db
        .prepare('select id from user where email = ?')
        .bind('sem-provedor@exemplo.test')
        .first()
      expect(row).toBeNull()
    } finally {
      vi.unstubAllEnvs()
    }
  })

  it('o reenvio da verificação (código email-verification) também é recusado', async () => {
    vi.stubEnv('DEV', false)
    try {
      const res = await h.post('/email-otp/send-verification-otp', {
        email: 'sem-provedor@exemplo.test',
        type: 'email-verification',
      })
      expect(res.status).toBe(503)
      expect(((await res.json()) as { code: string }).code).toBe(
        'EMAIL_NAO_CONFIGURADO',
      )
    } finally {
      vi.unstubAllEnvs()
    }
  })

  it('com RESEND_API_KEY, o cadastro e o reenvio são aceitos fora do dev', async () => {
    vi.stubEnv('DEV', false)
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('{"id":"x"}', { status: 200 }))
    Object.assign(testEnv, { RESEND_API_KEY: 're_teste' })
    try {
      const up = await h.post(
        '/sign-up/email',
        body('com-provedor-senha@exemplo.test'),
      )
      expect(up.status).toBe(200)
      const again = await h.post('/email-otp/send-verification-otp', {
        email: 'com-provedor-senha@exemplo.test',
        type: 'email-verification',
      })
      expect(again.status).toBe(200)
    } finally {
      delete (testEnv as { RESEND_API_KEY?: string }).RESEND_API_KEY
      fetchMock.mockRestore()
      vi.unstubAllEnvs()
    }
  })

  it('os caminhos por link (reenvio e redefinição) seguem em 404', async () => {
    for (const route of [
      '/send-verification-email',
      '/request-password-reset',
      '/reset-password',
    ]) {
      const res = await h.post(route, { email: 'x@exemplo.test' })
      expect(res.status).toBe(404)
    }
  })
})
