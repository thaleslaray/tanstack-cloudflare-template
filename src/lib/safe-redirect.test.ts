import { describe, expect, it } from 'vitest'

import { safeRedirect } from './safe-redirect'

describe('safeRedirect', () => {
  it('usa /conta quando não há valor', () => {
    expect(safeRedirect(undefined)).toBe('/conta')
    expect(safeRedirect('')).toBe('/conta')
  })

  it('aceita caminhos do próprio site', () => {
    expect(safeRedirect('/x')).toBe('/x')
    expect(safeRedirect('/conta?aba=1')).toBe('/conta?aba=1')
  })

  it('recusa // (protocolo relativo)', () => {
    expect(safeRedirect('//evil.com')).toBe('/conta')
  })

  it('recusa URL absoluta', () => {
    expect(safeRedirect('https://evil.com')).toBe('/conta')
    expect(safeRedirect('javascript:alert(1)')).toBe('/conta')
  })
})
