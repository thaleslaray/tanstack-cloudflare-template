import { env } from 'cloudflare:workers'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { authRateLimit, emailFromBody } from './auth-rate-limit'

vi.mock('@tanstack/react-start/server', () => ({
  getRequest: () => new Request('http://localhost/'),
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
      '/sign-in/email-otp',
      '/email-otp/verify-email',
      '/email-otp/check-verification-otp',
      '/forget-password/email-otp',
      '/email-otp/reset-password',
    ]) {
      const res = await authRateLimit(post(path, { email: 'a@b.com' }))
      expect(res?.status, path).toBe(429)
    }
  })

  it('sem e-mail válido no corpo, pula só a chave por e-mail', async () => {
    const limiter = limiterBlocking('auth-email:')
    Object.assign(stubEnv, { PUBLIC_RATE_LIMIT: limiter })
    expect(
      await authRateLimit(post('/sign-in/email-otp', { email: 'sem-arroba' })),
    ).toBeNull()
    expect(await authRateLimit(post('/sign-in/email-otp', { x: 1 }))).toBeNull()
    expect(await authRateLimit(post('/sign-in/email-otp'))).toBeNull()
    // só a chave por IP foi consultada
    expect(
      limiter.limit.mock.calls.every(([a]) => a.key.startsWith('auth:')),
    ).toBe(true)
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
