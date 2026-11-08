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
})
