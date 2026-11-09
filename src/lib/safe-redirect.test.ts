import { describe, expect, it } from 'vitest'

import { safeRedirect } from './safe-redirect'

describe('safeRedirect', () => {
  it('usa /app quando não há valor', () => {
    expect(safeRedirect(undefined)).toBe('/app')
    expect(safeRedirect('')).toBe('/app')
  })

  it('aceita caminhos do próprio site', () => {
    expect(safeRedirect('/x')).toBe('/x')
    expect(safeRedirect('/app/configuracoes?aba=1')).toBe(
      '/app/configuracoes?aba=1',
    )
  })

  it('recusa // (protocolo relativo)', () => {
    expect(safeRedirect('//evil.com')).toBe('/app')
  })

  it('recusa URL absoluta', () => {
    expect(safeRedirect('https://evil.com')).toBe('/app')
    expect(safeRedirect('javascript:alert(1)')).toBe('/app')
  })

  it('recusa barra invertida e caracteres de controle', () => {
    expect(safeRedirect('/\\evil.com')).toBe('/app')
    expect(safeRedirect('/\t/evil.com')).toBe('/app')
    expect(safeRedirect('/\n/evil.com')).toBe('/app')
    expect(safeRedirect('/app\\x')).toBe('/app')
  })

  it('não decodifica: %5C literal passa como caminho local', () => {
    expect(safeRedirect('/%5Cevil.com')).toBe('/%5Cevil.com')
  })

  it('devolve caminho, query e hash', () => {
    expect(safeRedirect('/app/configuracoes?x=1#y')).toBe(
      '/app/configuracoes?x=1#y',
    )
  })
})
