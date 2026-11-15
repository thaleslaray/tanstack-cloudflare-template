import { describe, expect, it } from 'vitest'

import { assertPasswordNotCommon, isCommonPassword } from './password-policy'

describe('isCommonPassword', () => {
  it('reconhece senhas comuns, sem diferenciar maiúsculas', () => {
    expect(isCommonPassword('12345678')).toBe(true)
    expect(isCommonPassword('Password123')).toBe(true)
    expect(isCommonPassword('QWERTYUIOP')).toBe(true)
    expect(isCommonPassword('senha123')).toBe(true)
  })

  it('aceita senha fora da lista', () => {
    expect(isCommonPassword('cavalo-bateria-grampo-7')).toBe(false)
  })
})

describe('assertPasswordNotCommon', () => {
  it('recusa senha comum no cadastro quando a senha está ligada', () => {
    expect(() =>
      assertPasswordNotCommon(
        '/sign-up/email',
        { email: 'a@b.co', password: 'password123' },
        true,
      ),
    ).toThrow(/comum demais/)
  })

  it('recusa também newPassword (troca e redefinição)', () => {
    expect(() =>
      assertPasswordNotCommon(
        '/change-password',
        { newPassword: '12345678' },
        true,
      ),
    ).toThrow()
  })

  it('aceita senha boa', () => {
    expect(() =>
      assertPasswordNotCommon(
        '/sign-up/email',
        { password: 'cavalo-bateria-grampo-7' },
        true,
      ),
    ).not.toThrow()
  })

  it('não faz nada com a senha desligada nem em outro caminho', () => {
    expect(() =>
      assertPasswordNotCommon(
        '/sign-up/email',
        { password: '12345678' },
        false,
      ),
    ).not.toThrow()
    expect(() =>
      assertPasswordNotCommon('/sign-in/email', { password: '12345678' }, true),
    ).not.toThrow()
  })
})
