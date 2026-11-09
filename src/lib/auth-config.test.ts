import { describe, expect, it } from 'vitest'

import {
  assertAuthSecret,
  DISABLED_PATHS,
  isLocalUrl,
  passwordEnabled,
  resolveBaseURL,
} from './auth-config'

describe('assertAuthSecret', () => {
  it('recusa segredo ausente, vazio ou só espaços', () => {
    expect(() => assertAuthSecret(undefined)).toThrow(/BETTER_AUTH_SECRET/)
    expect(() => assertAuthSecret('')).toThrow(/BETTER_AUTH_SECRET/)
    expect(() => assertAuthSecret('   ')).toThrow(/BETTER_AUTH_SECRET/)
  })

  it('recusa segredo com menos de 32 caracteres', () => {
    expect(() => assertAuthSecret('curto')).toThrow(/mínimo 32/)
    expect(() => assertAuthSecret('a'.repeat(31))).toThrow(/openssl rand/)
  })

  it('aceita 32 caracteres ou mais', () => {
    expect(() => assertAuthSecret('a'.repeat(32))).not.toThrow()
  })
})

describe('passwordEnabled', () => {
  it('só liga com true ou 1', () => {
    expect(passwordEnabled({})).toBe(false)
    expect(passwordEnabled({ PASSWORD_LOGIN_ENABLED: '' })).toBe(false)
    expect(passwordEnabled({ PASSWORD_LOGIN_ENABLED: 'false' })).toBe(false)
    expect(passwordEnabled({ PASSWORD_LOGIN_ENABLED: 'true' })).toBe(true)
    expect(passwordEnabled({ PASSWORD_LOGIN_ENABLED: ' 1 ' })).toBe(true)
  })
})

describe('isLocalUrl', () => {
  it('reconhece localhost e loopback', () => {
    expect(isLocalUrl('http://localhost:3000')).toBe(true)
    expect(isLocalUrl('http://127.0.0.1:3000')).toBe(true)
    expect(isLocalUrl('http://[::1]:3000')).toBe(true)
    expect(isLocalUrl('http://app.localhost:3000')).toBe(true)
  })

  it('não confunde domínio público com local', () => {
    expect(isLocalUrl('https://app.exemplo.com')).toBe(false)
    expect(isLocalUrl('https://localhost.exemplo.com')).toBe(false)
    expect(isLocalUrl('lixo')).toBe(false)
  })
})

describe('resolveBaseURL', () => {
  it('prefere a variável; senão usa a origem da requisição', () => {
    const request = new Request('https://app.exemplo.com/api/auth/x?y=1')
    expect(resolveBaseURL('https://fixa.com', request)).toBe('https://fixa.com')
    expect(resolveBaseURL('  ', request)).toBe('https://app.exemplo.com')
    expect(resolveBaseURL(undefined)).toBeUndefined()
  })
})

describe('DISABLED_PATHS', () => {
  it('desliga reset de senha, troca de e-mail e apagar conta', () => {
    for (const path of [
      '/forget-password/email-otp',
      '/email-otp/request-password-reset',
      '/email-otp/reset-password',
      '/request-password-reset',
      '/reset-password',
      '/change-email',
      '/delete-user',
      '/delete-user/callback',
      '/send-verification-email',
    ]) {
      expect(DISABLED_PATHS).toContain(path)
    }
  })
})
