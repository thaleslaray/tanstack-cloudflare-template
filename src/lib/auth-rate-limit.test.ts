import { env } from 'cloudflare:workers'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { appConfig } from '#/config/app'

import { authRateLimit, emailFromBody } from './auth-rate-limit'

vi.mock('@tanstack/react-start/server', () => ({
  getRequest: () => new Request('http://localhost/'),
}))

// O teto diário vai ao D1; aqui é testado em otp-daily-cap.test.ts.
const capState = vi.hoisted(() => ({
  reached: false,
  calls: 0,
  counts: [] as boolean[],
}))
vi.mock('#/lib/otp-daily-cap', () => ({
  otpDailyCapReached: async (_now?: Date, opts?: { count?: boolean }) => {
    capState.calls++
    capState.counts.push(opts?.count ?? true)
    return capState.reached
  },
}))

const stubEnv = env as unknown as Record<string, unknown>

function post(path: string, body?: unknown, ip = '203.0.113.7') {
  return new Request(`https://app.exemplo.com/api/auth${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'cf-connecting-ip': ip },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

// Limitador que recusa as chaves pedidas.
function limiterBlocking(...blocked: string[]) {
  return {
    limit: vi.fn(async ({ key }: { key: string }) => ({
      success: !blocked.some((b) => key.startsWith(b)),
    })),
  }
}

beforeEach(() => {
  capState.reached = false
  capState.calls = 0
  capState.counts = []
  appConfig.accessMode = 'open'
  for (const key of Object.keys(stubEnv)) delete stubEnv[key]
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('authRateLimit', () => {
  it('não limita /sign-out nem /get-session', async () => {
    const limiter = limiterBlocking('auth:')
    Object.assign(stubEnv, { PUBLIC_RATE_LIMIT: limiter })
    expect(await authRateLimit(post('/sign-out'))).toBeNull()
    expect(await authRateLimit(post('/get-session'))).toBeNull()
    expect(limiter.limit).not.toHaveBeenCalled()
  })

  it('limita por IP qualquer outro POST (ex.: /sign-in/social)', async () => {
    Object.assign(stubEnv, { PUBLIC_RATE_LIMIT: limiterBlocking('auth:') })
    const res = await authRateLimit(post('/sign-in/social', { provider: 'x' }))
    expect(res?.status).toBe(429)
  })

  it('limita também por e-mail (minúsculas, sem espaços)', async () => {
    const limiter = limiterBlocking('auth-email:')
    Object.assign(stubEnv, { PUBLIC_RATE_LIMIT: limiter })
    const res = await authRateLimit(
      post('/email-otp/send-verification-otp', {
        email: '  Ana@Exemplo.com ',
        type: 'sign-in',
      }),
    )
    expect(res?.status).toBe(429)
    expect(limiter.limit).toHaveBeenCalledWith({
      key: 'auth-email:ana@exemplo.com',
    })
  })

  it('cobre os outros endpoints com e-mail no corpo', async () => {
    const limiter = limiterBlocking('auth-email:')
    Object.assign(stubEnv, { PUBLIC_RATE_LIMIT: limiter })
    for (const path of [
      '/sign-in/email',
      '/sign-up/email',
      '/forget-password/email-otp',
      '/email-otp/reset-password',
    ]) {
      const res = await authRateLimit(post(path, { email: 'a@b.com' }))
      expect(res?.status, path).toBe(429)
    }
  })

  it('a verificação do código só tem a chave por IP (não trava a vítima)', async () => {
    // Se a chave por e-mail valesse aqui, quem soubesse o e-mail de alguém
    // esgotaria o limite dele e o impediria de digitar o próprio código. O
    // código já tem 3 tentativas por emissão (`allowedAttempts`).
    const limiter = limiterBlocking('auth-email:')
    Object.assign(stubEnv, { PUBLIC_RATE_LIMIT: limiter })
    for (const path of [
      '/sign-in/email-otp',
      '/email-otp/verify-email',
      '/email-otp/check-verification-otp',
    ]) {
      expect(
        await authRateLimit(post(path, { email: 'a@b.com' })),
        path,
      ).toBeNull()
    }
    expect(
      limiter.limit.mock.calls.every(([a]) => a.key.startsWith('auth:')),
    ).toBe(true)
    expect(limiter.limit).toHaveBeenCalledTimes(3)
  })

  it('o envio do código continua limitado por e-mail', async () => {
    Object.assign(stubEnv, {
      PUBLIC_RATE_LIMIT: limiterBlocking('auth-email:'),
    })
    const res = await authRateLimit(
      post('/email-otp/send-verification-otp', {
        email: 'a@b.com',
        type: 'sign-in',
      }),
    )
    expect(res?.status).toBe(429)
  })

  it('sem e-mail válido no corpo, pula só a chave por e-mail', async () => {
    const limiter = limiterBlocking('auth-email:')
    Object.assign(stubEnv, { PUBLIC_RATE_LIMIT: limiter })
    expect(
      await authRateLimit(post('/sign-in/email', { email: 'sem-arroba' })),
    ).toBeNull()
    expect(await authRateLimit(post('/sign-in/email', { x: 1 }))).toBeNull()
    // só a chave por IP foi consultada
    expect(
      limiter.limit.mock.calls.every(([a]) => a.key.startsWith('auth:')),
    ).toBe(true)
  })

  it('lê o e-mail também de application/x-www-form-urlencoded', async () => {
    const limiter = limiterBlocking('auth-email:')
    Object.assign(stubEnv, { PUBLIC_RATE_LIMIT: limiter })
    const request = new Request(
      'https://app.exemplo.com/api/auth/sign-in/email',
      {
        method: 'POST',
        headers: {
          'content-type': 'application/x-www-form-urlencoded; charset=utf-8',
          'cf-connecting-ip': '203.0.113.7',
        },
        body: 'email=Ana%40Exemplo.com&password=x',
      },
    )
    const res = await authRateLimit(request)
    expect(res?.status).toBe(429)
    expect(limiter.limit).toHaveBeenCalledWith({
      key: 'auth-email:ana@exemplo.com',
    })
    // o corpo continua legível para o Better Auth
    expect(await request.text()).toBe('email=Ana%40Exemplo.com&password=x')
  })

  it('recusa com 400 o corpo que não consegue ler (em vez de pular o limite)', async () => {
    Object.assign(stubEnv, { PUBLIC_RATE_LIMIT: limiterBlocking() })
    const semCorpo = await authRateLimit(post('/sign-in/email'))
    expect(semCorpo?.status).toBe(400)
    const jsonQuebrado = new Request(
      'https://app.exemplo.com/api/auth/sign-in/email',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{nao e json',
      },
    )
    expect((await authRateLimit(jsonQuebrado))?.status).toBe(400)
    const textoPuro = new Request(
      'https://app.exemplo.com/api/auth/sign-up/email',
      {
        method: 'POST',
        headers: { 'content-type': 'text/plain' },
        body: 'email=a@b.com',
      },
    )
    expect((await authRateLimit(textoPuro))?.status).toBe(400)
  })

  describe('teto diário global de códigos', () => {
    it('o envio de código que passou dos outros limites conta no teto; estourou, 429', async () => {
      Object.assign(stubEnv, { PUBLIC_RATE_LIMIT: limiterBlocking() })
      capState.reached = true
      const res = await authRateLimit(
        post('/email-otp/send-verification-otp', {
          email: 'a@b.com',
          type: 'sign-in',
        }),
      )
      expect(res?.status).toBe(429)
      expect(res?.headers.get('retry-after')).toBe('60')
      capState.reached = false
      expect(
        await authRateLimit(
          post('/email-otp/send-verification-otp', {
            email: 'a@b.com',
            type: 'sign-in',
          }),
        ),
      ).toBeNull()
    })

    it('modo lista: e-mail fora da lista só lê o teto (não gasta) e vê o mesmo 429; o da lista gasta', async () => {
      appConfig.accessMode = 'allowlist'
      Object.assign(stubEnv, {
        PUBLIC_RATE_LIMIT: limiterBlocking(),
        ACCESS_ALLOWLIST: 'Dentro@b.com',
      })
      const pedido = (email: string) =>
        post('/email-otp/send-verification-otp', { email, type: 'sign-in' })
      await authRateLimit(pedido('dentro@b.com'))
      await authRateLimit(pedido('fora@b.com'))
      expect(capState.counts).toEqual([true, false])
      capState.reached = true
      expect((await authRateLimit(pedido('dentro@b.com')))?.status).toBe(429)
      expect((await authRateLimit(pedido('fora@b.com')))?.status).toBe(429)
    })

    it('modo aberto: todo e-mail gasta o teto', async () => {
      Object.assign(stubEnv, { PUBLIC_RATE_LIMIT: limiterBlocking() })
      const pedido = (email: string) =>
        post('/email-otp/send-verification-otp', { email, type: 'sign-in' })
      await authRateLimit(pedido('a@b.com'))
      await authRateLimit(pedido('c@d.com'))
      expect(capState.counts).toEqual([true, true])
    })

    it('verificação do código e pedido já recusado por IP não gastam o teto', async () => {
      Object.assign(stubEnv, { PUBLIC_RATE_LIMIT: limiterBlocking() })
      await authRateLimit(post('/sign-in/email-otp', { email: 'a@b.com' }))
      expect(capState.calls).toBe(0)
      Object.assign(stubEnv, { PUBLIC_RATE_LIMIT: limiterBlocking('auth:') })
      await authRateLimit(
        post('/email-otp/send-verification-otp', { email: 'a@b.com' }),
      )
      expect(capState.calls).toBe(0)
    })
  })

  it('recusa tipo de código sem fluxo com 400', async () => {
    Object.assign(stubEnv, { PUBLIC_RATE_LIMIT: limiterBlocking() })
    const res = await authRateLimit(
      post('/email-otp/send-verification-otp', {
        email: 'a@b.com',
        type: 'forget-password',
      }),
    )
    expect(res?.status).toBe(400)
  })

  it('o corpo continua legível para o Better Auth (clone)', async () => {
    Object.assign(stubEnv, { PUBLIC_RATE_LIMIT: limiterBlocking() })
    const request = post('/sign-in/email-otp', { email: 'a@b.com', otp: '1' })
    await authRateLimit(request)
    expect(await request.json()).toEqual({ email: 'a@b.com', otp: '1' })
  })
})

describe('emailFromBody', () => {
  it('normaliza e valida', () => {
    expect(emailFromBody({ email: ' A@B.com ' })).toBe('a@b.com')
    expect(emailFromBody({ email: 5 })).toBeNull()
    expect(emailFromBody(null)).toBeNull()
    expect(emailFromBody({ email: `${'a'.repeat(260)}@b.com` })).toBeNull()
  })
})
