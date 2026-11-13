import { describe, expect, it } from 'vitest'

import { authFailureMessage, toAuthFailure } from '#/lib/auth-failure'

describe('toAuthFailure', () => {
  it('429 vira rate_limited, com ou sem código', () => {
    expect(toAuthFailure({ status: 429 })).toBe('rate_limited')
    expect(toAuthFailure({ status: 429, code: 'INVALID_OTP' })).toBe(
      'rate_limited',
    )
  })

  it('traduz os códigos do Better Auth usados nos formulários', () => {
    expect(toAuthFailure({ status: 400, code: 'INVALID_OTP' })).toBe(
      'invalid_otp',
    )
    expect(toAuthFailure({ status: 400, code: 'OTP_EXPIRED' })).toBe(
      'otp_expired',
    )
    expect(toAuthFailure({ status: 403, code: 'TOO_MANY_ATTEMPTS' })).toBe(
      'too_many_attempts',
    )
    expect(toAuthFailure({ status: 403, code: 'ACCOUNT_CLOSED' })).toBe(
      'account_closed',
    )
    expect(toAuthFailure({ status: 403, code: 'EMAIL_NOT_VERIFIED' })).toBe(
      'email_not_verified',
    )
    expect(
      toAuthFailure({ status: 401, code: 'INVALID_EMAIL_OR_PASSWORD' }),
    ).toBe('invalid_credentials')
  })

  it('o que não conhece é unknown', () => {
    expect(toAuthFailure({ status: 500, code: 'OUTRA_COISA' })).toBe('unknown')
    expect(toAuthFailure(null)).toBe('unknown')
    expect(toAuthFailure(undefined)).toBe('unknown')
    expect(toAuthFailure('erro')).toBe('unknown')
    expect(toAuthFailure(new Error('rede caiu'))).toBe('unknown')
  })
})

describe('authFailureMessage', () => {
  it('rate_limited tem a mesma mensagem em qualquer passo', () => {
    for (const c of [
      'enviar',
      'reenviar',
      'verificar',
      'entrar',
      'criar',
    ] as const) {
      expect(authFailureMessage('rate_limited', c)).toBe(
        'Muitas tentativas. Espere um minuto e tente de novo.',
      )
    }
  })

  it('unknown muda conforme o passo e nunca devolve texto do servidor', () => {
    expect(authFailureMessage('unknown', 'enviar')).toContain('enviar o código')
    expect(authFailureMessage('unknown', 'reenviar')).toContain('reenviar')
    expect(authFailureMessage('unknown', 'criar')).toContain('criar a conta')
    expect(authFailureMessage('unknown', 'verificar')).toContain(
      'Não deu certo',
    )
  })

  it('mensagens em pt-BR para os códigos conhecidos', () => {
    expect(authFailureMessage('invalid_otp', 'verificar')).toMatch(/incorreto/)
    expect(authFailureMessage('otp_expired', 'verificar')).toMatch(/expirou/)
    expect(authFailureMessage('account_closed', 'verificar')).toMatch(
      /encerrada/,
    )
    expect(authFailureMessage('invalid_credentials', 'entrar')).toMatch(/senha/)
  })
})
