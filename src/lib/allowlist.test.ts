import { describe, expect, it, vi } from 'vitest'

import {
  hasAccess,
  isEmailAllowed,
  normalizeEmail,
  parseAllowlist,
} from './allowlist'

describe('lista de acesso', () => {
  it('libera e-mail da lista e recusa o de fora', () => {
    const lista = 'ana@exemplo.test,bia@exemplo.test'
    expect(isEmailAllowed('ana@exemplo.test', lista)).toBe(true)
    expect(isEmailAllowed('cris@exemplo.test', lista)).toBe(false)
  })

  it('lista vazia, ausente ou só com vírgulas: ninguém entra', () => {
    for (const raw of ['', '  ', ',,,', undefined, null, 42]) {
      expect(isEmailAllowed('ana@exemplo.test', raw)).toBe(false)
    }
  })

  it('ignora maiúsculas e espaços, dos dois lados', () => {
    const lista = '  Ana@Exemplo.TEST , bia@exemplo.test  '
    expect(isEmailAllowed(' ANA@exemplo.test ', lista)).toBe(true)
    expect(isEmailAllowed('BIA@EXEMPLO.TEST', lista)).toBe(true)
    expect(normalizeEmail('  X@Y.Z ')).toBe('x@y.z')
  })

  it('aceita vários e-mails e descarta entradas vazias', () => {
    expect([...parseAllowlist('a@x.y,, b@x.y ,')]).toEqual(['a@x.y', 'b@x.y'])
  })

  it('não casa por pedaço do e-mail nem por curinga', () => {
    expect(
      isEmailAllowed('ana@exemplo.test.evil.com', 'ana@exemplo.test'),
    ).toBe(false)
    expect(isEmailAllowed('ana@exemplo.test', '*@exemplo.test')).toBe(false)
  })

  it('e-mail que não é texto não entra', () => {
    expect(isEmailAllowed(undefined, 'a@x.y')).toBe(false)
    expect(isEmailAllowed('', ',')).toBe(false)
  })

  it('padrão qa-*@exemplo.test só vale ligado', () => {
    expect(isEmailAllowed('qa-um@exemplo.test', '')).toBe(false)
    expect(isEmailAllowed('qa-um@exemplo.test', '', { qaPattern: true })).toBe(
      true,
    )
    expect(isEmailAllowed('QA-Um@exemplo.test', '', { qaPattern: true })).toBe(
      true,
    )
    expect(isEmailAllowed('fora@exemplo.test', '', { qaPattern: true })).toBe(
      false,
    )
    expect(isEmailAllowed('qa-um@outro.com', '', { qaPattern: true })).toBe(
      false,
    )
  })

  describe('hasAccess (interruptor appConfig.accessMode)', () => {
    it('modo aberto: qualquer e-mail, com lista vazia ou não', () => {
      expect(hasAccess('qualquer@x.y', '', 'open')).toBe(true)
      expect(hasAccess('qualquer@x.y', undefined, 'open')).toBe(true)
    })

    it('modo lista: só quem está nela; vazia ou ausente = ninguém (falha fechada)', () => {
      expect(hasAccess('ana@x.y', 'ana@x.y', 'allowlist')).toBe(true)
      expect(hasAccess('bia@x.y', 'ana@x.y', 'allowlist')).toBe(false)
      expect(hasAccess('ana@x.y', '', 'allowlist')).toBe(false)
      expect(hasAccess('ana@x.y', undefined, 'allowlist')).toBe(false)
    })

    it('o padrão do template é o modo aberto', () => {
      expect(hasAccess('qualquer@x.y', '')).toBe(true)
    })

    it('o padrão qa- não vale no build de produção (import.meta.env.DEV falso)', () => {
      vi.stubEnv('DEV', false)
      vi.stubEnv('VITE_E2E_SEM_LIMITE', '1')
      expect(hasAccess('qa-um@exemplo.test', '', 'allowlist')).toBe(false)
      vi.unstubAllEnvs()
    })

    it('o padrão qa- vale no dev do Playwright, só no modo lista', () => {
      vi.stubEnv('DEV', true)
      vi.stubEnv('VITE_E2E_SEM_LIMITE', '1')
      expect(hasAccess('qa-um@exemplo.test', '', 'allowlist')).toBe(true)
      expect(hasAccess('fora@exemplo.test', '', 'allowlist')).toBe(false)
      vi.unstubAllEnvs()
    })
  })
})
