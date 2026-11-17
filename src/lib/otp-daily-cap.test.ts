import { env } from 'cloudflare:workers'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  total: 1 as number | Error,
  calls: [] as unknown[][],
}))
// Banco de mentira: o upsert devolve o `total` combinado e registra o que foi pedido.
vi.mock('#/db/index', () => ({
  getDb: () => ({
    select: () => ({
      from: () => ({
        where: () => ({
          limit: async () => {
            state.calls.push(['select'])
            return state.total instanceof Error ? [] : [{ total: state.total }]
          },
        }),
      }),
    }),
    insert: () => ({
      values: (v: unknown) => {
        state.calls.push(['values', v])
        return {
          onConflictDoUpdate: () => ({
            returning: async () => {
              if (state.total instanceof Error) throw state.total
              return [{ total: state.total }]
            },
          }),
        }
      },
    }),
  }),
}))

import {
  OTP_DAILY_LIMIT_DEFAULT,
  otpDailyCapReached,
  otpDailyLimit,
  otpDay,
} from './otp-daily-cap'

const stubEnv = env as unknown as Record<string, unknown>

beforeEach(() => {
  for (const key of Object.keys(stubEnv)) delete stubEnv[key]
  stubEnv.DB = {}
  state.calls = []
})
afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
})

describe('otpDailyLimit', () => {
  it('padrão, valor válido, zero e lixo', () => {
    expect(otpDailyLimit(undefined)).toBe(OTP_DAILY_LIMIT_DEFAULT)
    expect(otpDailyLimit('')).toBe(OTP_DAILY_LIMIT_DEFAULT)
    expect(otpDailyLimit('120')).toBe(120)
    expect(otpDailyLimit('0')).toBe(0)
    expect(otpDailyLimit('abc')).toBe(OTP_DAILY_LIMIT_DEFAULT)
    expect(otpDailyLimit('-3')).toBe(OTP_DAILY_LIMIT_DEFAULT)
  })
})

describe('otpDailyCapReached', () => {
  it('conta por dia UTC', () => {
    expect(otpDay(new Date('2026-11-16T23:59:59Z'))).toBe('2026-11-16')
  })

  it('dentro do teto passa; acima dele recusa', async () => {
    stubEnv.OTP_DAILY_LIMIT = '10'
    state.total = 10
    expect(await otpDailyCapReached()).toBe(false)
    state.total = 11
    expect(await otpDailyCapReached()).toBe(true)
  })

  it('count: false só lê: não grava e recusa quando o próximo pedido estouraria', async () => {
    stubEnv.OTP_DAILY_LIMIT = '10'
    state.total = 9
    expect(await otpDailyCapReached(new Date(), { count: false })).toBe(false)
    state.total = 10
    expect(await otpDailyCapReached(new Date(), { count: false })).toBe(true)
    expect(state.calls.every(([kind]) => kind === 'select')).toBe(true)
  })

  it('OTP_DAILY_LIMIT=0 desliga e nem consulta o banco', async () => {
    stubEnv.OTP_DAILY_LIMIT = '0'
    state.total = 99999
    expect(await otpDailyCapReached()).toBe(false)
    expect(state.calls).toEqual([])
  })

  it('erro no D1 libera (falha aberta)', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    state.total = new Error('d1 fora')
    expect(await otpDailyCapReached()).toBe(false)
  })

  it('com VITE_E2E_SEM_LIMITE=1 em dev não consulta', async () => {
    vi.stubEnv('VITE_E2E_SEM_LIMITE', '1')
    state.total = 99999
    expect(await otpDailyCapReached()).toBe(false)
    expect(state.calls).toEqual([])
  })
})
