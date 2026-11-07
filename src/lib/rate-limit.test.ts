import { env } from 'cloudflare:workers'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { isRateLimited, tooManyRequests } from './rate-limit'

// `getRequest` vem do runtime do TanStack Start; aqui sempre passamos `headers`.
vi.mock('@tanstack/react-start/server', () => ({
  getRequest: () => new Request('http://localhost/'),
}))

// No teste, `env` é o stub mutável de src/test/cloudflare-workers.ts.
const stubEnv = env as unknown as Record<string, unknown>
const headers = new Headers({ 'cf-connecting-ip': '203.0.113.7' })

beforeEach(() => {
  for (const key of Object.keys(stubEnv)) delete stubEnv[key]
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('isRateLimited', () => {
  it('sem binding não limita', async () => {
    expect(await isRateLimited('login', { headers })).toBe(false)
  })

  it('limita quando o binding responde success: false', async () => {
    const limit = vi.fn(async () => ({ success: false }))
    Object.assign(stubEnv, { PUBLIC_RATE_LIMIT: { limit } })
    expect(await isRateLimited('login', { headers })).toBe(true)
  })

  it('libera quando o binding responde success: true', async () => {
    const limit = vi.fn(async () => ({ success: true }))
    Object.assign(stubEnv, { PUBLIC_RATE_LIMIT: { limit } })
    expect(await isRateLimited('login', { headers })).toBe(false)
  })

  it('falha aberta quando o binding dá erro', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    Object.assign(stubEnv, {
      PUBLIC_RATE_LIMIT: {
        limit: vi.fn(async () => {
          throw new Error('indisponível')
        }),
      },
    })
    expect(await isRateLimited('login', { headers })).toBe(false)
  })

  it('monta a chave com o escopo e o cf-connecting-ip', async () => {
    const limit = vi.fn(async () => ({ success: true }))
    Object.assign(stubEnv, { PUBLIC_RATE_LIMIT: { limit } })
    await isRateLimited('login', { headers })
    expect(limit).toHaveBeenCalledWith({ key: 'login:203.0.113.7' })
  })

  it('respeita a chave informada', async () => {
    const limit = vi.fn(async () => ({ success: true }))
    Object.assign(stubEnv, { PUBLIC_RATE_LIMIT: { limit } })
    await isRateLimited('login', { headers, key: 'minha-chave' })
    expect(limit).toHaveBeenCalledWith({ key: 'minha-chave' })
  })
})

describe('tooManyRequests', () => {
  it('responde 429 com retry-after', () => {
    const res = tooManyRequests()
    expect(res.status).toBe(429)
    expect(res.headers.get('retry-after')).toBe('60')
  })
})
