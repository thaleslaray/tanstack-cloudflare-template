import { describe, expect, it } from 'vitest'

import { resumirIdas } from './d1-trace'

describe('resumirIdas', () => {
  it('conta idas em fila uma atrás da outra', () => {
    expect(
      resumirIdas([
        { start: 0, end: 10 },
        { start: 10, end: 20 },
        { start: 20, end: 30 },
      ]),
    ).toEqual({ idas: 3, emFila: 3 })
  })

  it('idas que se sobrepõem não aumentam a fila', () => {
    expect(
      resumirIdas([
        { start: 0, end: 10 },
        { start: 2, end: 12 },
        { start: 12, end: 20 },
      ]),
    ).toEqual({ idas: 3, emFila: 2 })
  })

  it('sem idas', () => {
    expect(resumirIdas([])).toEqual({ idas: 0, emFila: 0 })
  })
})
