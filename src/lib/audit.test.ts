import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  type AuditRecord,
  audit,
  auditSinkCount,
  formatAuditEntry,
  onAudit,
  requestMeta,
} from '#/lib/audit'

const removers: Array<() => void> = []
function register(name: string, sink: (r: AuditRecord) => Promise<void>) {
  removers.push(onAudit(name, sink))
}

afterEach(() => {
  for (const remove of removers.splice(0)) remove()
  vi.restoreAllMocks()
})

describe('registro de sinks', () => {
  it('sem sink, audit() é no-op e não lança', async () => {
    expect(auditSinkCount()).toBe(0)
    await expect(audit({ action: 'auth.sign_in' })).resolves.toBeUndefined()
  })

  it('entrega o evento formatado a cada sink registrado', async () => {
    const a = vi.fn(async (_r: AuditRecord) => {})
    const b = vi.fn(async (_r: AuditRecord) => {})
    register('a', a)
    register('b', b)
    await audit({ action: 'account.avatar_set', actorId: 'u1' })
    expect(a).toHaveBeenCalledOnce()
    expect(b).toHaveBeenCalledOnce()
    expect(a.mock.calls[0][0]).toMatchObject({
      action: 'account.avatar_set',
      actorId: 'u1',
    })
  })

  it('registrar de novo com o mesmo nome substitui (sem duplicar)', async () => {
    const first = vi.fn(async () => {})
    const second = vi.fn(async () => {})
    register('d1', first)
    register('d1', second)
    expect(auditSinkCount()).toBe(1)
    await audit({ action: 'auth.sign_in' })
    expect(first).not.toHaveBeenCalled()
    expect(second).toHaveBeenCalledOnce()
  })

  it('um sink com erro não impede os outros nem a ação', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const ok = vi.fn(async () => {})
    register('quebrado', async () => {
      throw new Error('D1 fora do ar')
    })
    register('ok', ok)
    await expect(audit({ action: 'auth.sign_in' })).resolves.toBeUndefined()
    expect(ok).toHaveBeenCalledOnce()
  })

  it('action inválida é descartada com log, sem lançar', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const sink = vi.fn(async () => {})
    register('s', sink)
    await audit({ action: 'Login' })
    expect(sink).not.toHaveBeenCalled()
    expect(error).toHaveBeenCalled()
  })

  it('com ctx, entrega via waitUntil em vez de esperar', async () => {
    const sink = vi.fn(async () => {})
    register('s', sink)
    const pending: Promise<unknown>[] = []
    await audit(
      { action: 'auth.sign_in' },
      { waitUntil: (p) => pending.push(p) },
    )
    expect(pending).toHaveLength(1)
    await Promise.all(pending)
    expect(sink).toHaveBeenCalledOnce()
  })
})

describe('formatAuditEntry', () => {
  it('normaliza campos ausentes para null', () => {
    expect(formatAuditEntry({ action: 'account.deleted' })).toEqual({
      action: 'account.deleted',
      actorId: null,
      actorEmail: null,
      targetType: null,
      targetId: null,
      meta: null,
      ip: null,
      userAgent: null,
    })
  })

  it('exige o formato <area>.<verbo>', () => {
    for (const bad of ['', 'login', 'Auth.SignIn', 'a.b.c', 'auth sign_in']) {
      expect(() => formatAuditEntry({ action: bad })).toThrow(/action inválida/)
    }
    expect(() =>
      formatAuditEntry({ action: 'account.close_requested' }),
    ).not.toThrow()
  })

  it('nunca grava chaves com cara de segredo em meta', () => {
    const record = formatAuditEntry({
      action: 'auth.sign_in',
      meta: {
        method: 'sign-in/email-otp',
        password: 'x',
        token: 'x',
        otp: '123456',
        code: '123456',
        apiKey: 'x',
        cookie: 'x',
        clientSecret: 'x',
      },
    })
    expect(JSON.parse(record.meta ?? '{}')).toEqual({
      method: 'sign-in/email-otp',
    })
  })

  it('meta só aceita primitivos e vira JSON (ou null se vazio)', () => {
    const record = formatAuditEntry({
      action: 'account.avatar_set',
      // biome-ignore lint/suspicious/noExplicitAny: testando entrada fora do tipo
      meta: { size: 1024, ok: true, nada: null, obj: { a: 1 } as any, n: NaN },
    })
    expect(JSON.parse(record.meta ?? '')).toEqual({
      size: 1024,
      ok: true,
      nada: null,
    })
    expect(
      formatAuditEntry({ action: 'auth.sign_in', meta: { token: 'x' } }).meta,
    ).toBeNull()
  })

  it('corta textos longos em 255 e põe o e-mail em minúsculas', () => {
    const record = formatAuditEntry({
      action: 'auth.sign_in',
      actorEmail: '  Ana@Exemplo.COM ',
      userAgent: 'x'.repeat(1000),
    })
    expect(record.actorEmail).toBe('ana@exemplo.com')
    expect(record.userAgent).toHaveLength(255)
  })
})

describe('requestMeta', () => {
  it('prefere cf-connecting-ip e lê o user-agent', () => {
    const headers = new Headers({
      'cf-connecting-ip': '1.2.3.4',
      'x-forwarded-for': '9.9.9.9, 8.8.8.8',
      'user-agent': 'Teste/1.0',
    })
    expect(requestMeta(headers)).toEqual({
      ip: '1.2.3.4',
      userAgent: 'Teste/1.0',
    })
  })

  it('cai para o primeiro x-forwarded-for e aceita headers ausentes', () => {
    expect(
      requestMeta(new Headers({ 'x-forwarded-for': '9.9.9.9, 8.8.8.8' })).ip,
    ).toBe('9.9.9.9')
    expect(requestMeta(undefined)).toEqual({ ip: null, userAgent: null })
  })
})

describe('isSignInPath (hook do Better Auth)', () => {
  it('reconhece só os endpoints de login', async () => {
    const { isSignInPath } = await import('#/lib/auth-audit-hook')
    for (const path of [
      '/sign-in/email-otp',
      '/sign-in/email',
      '/sign-up/email',
      '/callback/google',
      '/oauth2/callback/github',
    ]) {
      expect(isSignInPath(path), path).toBe(true)
    }
    for (const path of [
      '/update-user',
      '/get-session',
      '/sign-out',
      '/x/sign-in',
    ]) {
      expect(isSignInPath(path), path).toBe(false)
    }
  })
})
