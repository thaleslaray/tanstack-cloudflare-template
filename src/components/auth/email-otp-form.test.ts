import { describe, expect, it } from 'vitest'

import { initial, reducer } from '#/components/auth/email-otp-form'

describe('reducer do login por código', () => {
  it('send_failed no primeiro envio volta para o e-mail', () => {
    const sending = reducer(initial, {
      type: 'send_started',
      to: 'a@b.com',
      resend: false,
    })
    expect(sending.step.s).toBe('sending')
    const failed = reducer(sending, { type: 'send_failed', message: 'erro' })
    expect(failed.step).toEqual({ s: 'email' })
    expect(failed.error).toBe('erro')
  })

  it('send_failed no reenvio volta para o código', () => {
    const sending = reducer(initial, {
      type: 'send_started',
      to: 'a@b.com',
      resend: true,
    })
    const failed = reducer(sending, { type: 'send_failed', message: 'erro' })
    expect(failed.step).toEqual({ s: 'code', to: 'a@b.com' })
  })

  it('verify_failed volta para o código do mesmo e-mail', () => {
    const verifying = reducer(initial, {
      type: 'verify_started',
      to: 'a@b.com',
    })
    const failed = reducer(verifying, {
      type: 'verify_failed',
      message: 'erro',
    })
    expect(failed.step).toEqual({ s: 'code', to: 'a@b.com' })
  })
})
