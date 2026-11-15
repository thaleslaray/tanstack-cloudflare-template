import { describe, expect, it } from 'vitest'

import {
  assertAuthSecret,
  DISABLED_PATHS,
  isLocalUrl,
  otpHasher,
  passwordEnabled,
  resolveBaseURL,
  resolveTrustedOrigins,
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

describe('resolveTrustedOrigins', () => {
  it('em produção, fixa a origem de BETTER_AUTH_URL', () => {
    expect(resolveTrustedOrigins('https://app.exemplo.com.br/')).toEqual([
      'https://app.exemplo.com.br',
    ])
    expect(resolveTrustedOrigins(' https://app.exemplo.com.br/x ')).toEqual([
      'https://app.exemplo.com.br',
    ])
  })

  it('no localhost ou sem variável, não fixa nada (comportamento de dev)', () => {
    expect(resolveTrustedOrigins('http://localhost:3001')).toBeUndefined()
    expect(resolveTrustedOrigins('')).toBeUndefined()
    expect(resolveTrustedOrigins(undefined)).toBeUndefined()
    expect(resolveTrustedOrigins('lixo')).toBeUndefined()
  })
})

describe('otpHasher', () => {
  it('é determinístico e depende da chave', async () => {
    const a = otpHasher('segredo-a'.repeat(4))
    const b = otpHasher('segredo-b'.repeat(4))
    expect(await a('123456')).toBe(await a('123456'))
    expect(await a('123456')).not.toBe(await a('123457'))
    expect(await a('123456')).not.toBe(await b('123456'))
    expect(await a('123456')).toMatch(/^[0-9a-f]{64}$/)
  })

  it('não é o SHA-256 puro do código', async () => {
    const plain = Array.from(
      new Uint8Array(
        await crypto.subtle.digest(
          'SHA-256',
          new TextEncoder().encode('123456'),
        ),
      ),
      (b) => b.toString(16).padStart(2, '0'),
    ).join('')
    expect(await otpHasher('x'.repeat(40))('123456')).not.toBe(plain)
  })
})
