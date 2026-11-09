import { env } from 'cloudflare:workers'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { deliverOtp } from './auth-otp'

// No teste, `env` é o stub mutável de src/test/cloudflare-workers.ts.
const stubEnv = env as unknown as Record<string, unknown>

beforeEach(() => {
  for (const key of Object.keys(stubEnv)) delete stubEnv[key]
  Object.assign(stubEnv, { BETTER_AUTH_URL: 'http://localhost:3000' })
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('deliverOtp', () => {
  it('recusa tipos sem fluxo (forget-password, change-email)', async () => {
    for (const type of ['forget-password', 'change-email', 'outro']) {
      await expect(
        deliverOtp({ email: 'ana@exemplo.com', otp: '123456', type }),
      ).rejects.toThrow('Tipo de código não suportado.')
    }
  })

  it('entrega o código de sign-in e mantém o formato do log do e2e', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    await deliverOtp({
      email: 'ana@exemplo.com',
      otp: '123456',
      type: 'sign-in',
    })
    expect(warn).toHaveBeenCalledWith(
      '[auth] código de login para ana@exemplo.com: 123456',
    )
  })

  it('entrega o código de email-verification com o e-mail de confirmação', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    await deliverOtp({
      email: 'ana@exemplo.com',
      otp: '654321',
      type: 'email-verification',
    })
    expect(String(log.mock.calls[0]?.[0])).toContain('confirmação')
  })

  it('em produção sem provedor, falha em vez de imprimir o código', async () => {
    Object.assign(stubEnv, { BETTER_AUTH_URL: 'https://app.exemplo.com' })
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    await expect(
      deliverOtp({ email: 'ana@exemplo.com', otp: '123456', type: 'sign-in' }),
    ).rejects.toThrow(/Nenhum provedor de e-mail/)
    expect(warn).not.toHaveBeenCalled()
  })
})
