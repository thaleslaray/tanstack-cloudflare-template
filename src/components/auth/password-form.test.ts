import { describe, expect, it } from 'vitest'

import { initial, reducer } from '#/components/auth/password-form'

describe('reducer do login com senha', () => {
  it('"Voltar" preserva o modo "criar conta"', () => {
    let state = reducer(initial, { type: 'toggle_mode' })
    expect(state.step).toEqual({ s: 'form', mode: 'criar' })
    state = reducer(state, { type: 'submit_started' })
    state = reducer(state, { type: 'needs_verification', email: 'a@b.com' })
    expect(state.step.s).toBe('verify')
    state = reducer(state, { type: 'back_to_form' })
    expect(state.step).toEqual({ s: 'form', mode: 'criar' })
  })

  it('verify_failed mantém o modo e o e-mail', () => {
    let state = reducer(initial, { type: 'toggle_mode' })
    state = reducer(state, { type: 'submit_started' })
    state = reducer(state, { type: 'needs_verification', email: 'a@b.com' })
    state = reducer(state, { type: 'verify_started' })
    state = reducer(state, { type: 'verify_failed', message: 'erro' })
    expect(state.step).toEqual({
      s: 'verify',
      mode: 'criar',
      email: 'a@b.com',
      resending: false,
    })
  })

  it('resend_finished volta a liberar o reenvio com a mensagem', () => {
    let state = reducer(initial, { type: 'submit_started' })
    state = reducer(state, { type: 'needs_verification', email: 'a@b.com' })
    state = reducer(state, { type: 'resend_started' })
    state = reducer(state, { type: 'resend_finished', message: 'erro' })
    expect(state.step).toMatchObject({ s: 'verify', resending: false })
    expect(state.error).toBe('erro')
  })
})
