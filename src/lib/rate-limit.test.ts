import { env } from 'cloudflare:workers'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  clientIp,
  isRateLimited,
  isUserRateLimited,
  limitarUsuario,
  normalizeIp,
  tooManyRequests,
} from './rate-limit'

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
  vi.unstubAllEnvs()
})

describe('isRateLimited', () => {
  it('sem VITE_E2E_SEM_LIMITE o limite vale mesmo em dev', async () => {
    const limit = vi.fn(async () => ({ success: false }))
    Object.assign(stubEnv, { PUBLIC_RATE_LIMIT: { limit } })
    vi.stubEnv('VITE_E2E_SEM_LIMITE', '')
    expect(await isRateLimited('login', { headers })).toBe(true)
    expect(limit).toHaveBeenCalled()
  })

  it('com VITE_E2E_SEM_LIMITE=1 em dev (e2e) não limita nem consulta', async () => {
    const limit = vi.fn(async () => ({ success: false }))
    Object.assign(stubEnv, { PUBLIC_RATE_LIMIT: { limit } })
    vi.stubEnv('VITE_E2E_SEM_LIMITE', '1')
    expect(await isRateLimited('login', { headers })).toBe(false)
    expect(limit).not.toHaveBeenCalled()
  })

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

describe('normalizeIp / clientIp', () => {
  it('IPv4 fica igual', () => {
    expect(normalizeIp('203.0.113.7')).toBe('203.0.113.7')
  })

  it('IPv6 completo vira o prefixo /64', () => {
    expect(normalizeIp('2001:db8:0:1:aaaa:bbbb:cccc:dddd')).toBe(
      '2001:db8:0:1::/64',
    )
  })

  it('aceita a forma comprimida com ::', () => {
    expect(normalizeIp('2001:db8:0:1::5')).toBe('2001:db8:0:1::/64')
    expect(normalizeIp('2001:db8::1')).toBe('2001:db8:0:0::/64')
    expect(normalizeIp('::1')).toBe('0:0:0:0::/64')
    expect(normalizeIp('2001:DB8:0:1::5')).toBe('2001:db8:0:1::/64')
  })

  it('IPv4 mapeado em IPv6 vale como IPv4', () => {
    expect(normalizeIp('::ffff:203.0.113.7')).toBe('203.0.113.7')
  })

  it('clientIp usa o cf-connecting-ip e normaliza', () => {
    const h = new Headers({
      'cf-connecting-ip': '2001:db8:0:1:1:2:3:4',
      'x-forwarded-for': '9.9.9.9',
    })
    expect(clientIp(h)).toBe('2001:db8:0:1::/64')
    expect(clientIp(new Headers())).toBe('unknown')
  })
})

describe('limite por /64 (limitador em memória, 5 por chave)', () => {
  function memoryLimiter() {
    const counts = new Map<string, number>()
    return {
      limit: vi.fn(async ({ key }: { key: string }) => {
        const n = (counts.get(key) ?? 0) + 1
        counts.set(key, n)
        return { success: n <= 5 }
      }),
    }
  }
  const from = (ip: string) => new Headers({ 'cf-connecting-ip': ip })

  it('10 IPs do mesmo /64 dividem o mesmo balde', async () => {
    Object.assign(stubEnv, { PUBLIC_RATE_LIMIT: memoryLimiter() })
    const results: boolean[] = []
    for (let i = 1; i <= 10; i++) {
      results.push(
        await isRateLimited('auth', {
          headers: from(`2001:db8:0:1:aaaa:bbbb:cccc:${i.toString(16)}`),
        }),
      )
    }
    expect(results.slice(0, 5)).toEqual([false, false, false, false, false])
    expect(results[5]).toBe(true)
  })

  it('dois /64 diferentes têm baldes diferentes', async () => {
    const limiter = memoryLimiter()
    Object.assign(stubEnv, { PUBLIC_RATE_LIMIT: limiter })
    for (let i = 0; i < 6; i++) {
      await isRateLimited('auth', { headers: from('2001:db8:0:1::1') })
    }
    expect(
      await isRateLimited('auth', { headers: from('2001:db8:0:2::1') }),
    ).toBe(false)
    const keys = limiter.limit.mock.calls.map(([arg]) => arg.key)
    expect(keys).toContain('auth:2001:db8:0:1::/64')
    expect(keys).toContain('auth:2001:db8:0:2::/64')
  })

  it('IPv4 continua com uma chave por endereço', async () => {
    const limiter = memoryLimiter()
    Object.assign(stubEnv, { PUBLIC_RATE_LIMIT: limiter })
    await isRateLimited('auth', { headers: from('203.0.113.7') })
    expect(limiter.limit).toHaveBeenCalledWith({ key: 'auth:203.0.113.7' })
  })
})

describe('limite por usuário', () => {
  it('sem binding não limita (falha aberta)', async () => {
    expect(await isUserRateLimited('u1', 'leitura')).toBe(false)
    await expect(limitarUsuario('u1', 'escrita')).resolves.toBeUndefined()
  })

  it('usa a chave user:<id>:<escopo> no USER_RATE_LIMIT, não no público', async () => {
    const limit = vi.fn(async () => ({ success: true }))
    const publico = vi.fn(async () => ({ success: false }))
    Object.assign(stubEnv, {
      USER_RATE_LIMIT: { limit },
      PUBLIC_RATE_LIMIT: { limit: publico },
    })
    await limitarUsuario('u1', 'leitura')
    await limitarUsuario('u1', 'escrita')
    expect(limit).toHaveBeenNthCalledWith(1, { key: 'user:u1:leitura' })
    expect(limit).toHaveBeenNthCalledWith(2, { key: 'user:u1:escrita' })
    expect(publico).not.toHaveBeenCalled()
  })

  it('estourou: registra no log quem estourou e em qual escopo (o 500 da página não fica mudo)', async () => {
    const erro = vi.spyOn(console, 'error').mockImplementation(() => {})
    Object.assign(stubEnv, {
      USER_RATE_LIMIT: { limit: async () => ({ success: false }) },
    })
    await expect(limitarUsuario('u1', 'leitura')).rejects.toThrow()
    expect(erro).toHaveBeenCalledTimes(1)
    expect(String(erro.mock.calls[0]?.[0])).toContain('u1')
    expect(String(erro.mock.calls[0]?.[0])).toContain('leitura')
  })

  it('estourou: limitarUsuario lança erro em pt-BR', async () => {
    Object.assign(stubEnv, {
      USER_RATE_LIMIT: { limit: vi.fn(async () => ({ success: false })) },
    })
    expect(await isUserRateLimited('u1', 'escrita')).toBe(true)
    await expect(limitarUsuario('u1', 'escrita')).rejects.toThrow(
      /Muitas requisições/,
    )
  })

  it('erro no binding libera', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    Object.assign(stubEnv, {
      USER_RATE_LIMIT: {
        limit: vi.fn(async () => {
          throw new Error('boom')
        }),
      },
    })
    expect(await isUserRateLimited('u1', 'leitura')).toBe(false)
  })

  it('com VITE_E2E_SEM_LIMITE=1 em dev não consulta', async () => {
    const limit = vi.fn(async () => ({ success: false }))
    Object.assign(stubEnv, { USER_RATE_LIMIT: { limit } })
    vi.stubEnv('VITE_E2E_SEM_LIMITE', '1')
    expect(await isUserRateLimited('u1', 'leitura')).toBe(false)
    expect(limit).not.toHaveBeenCalled()
  })
})
