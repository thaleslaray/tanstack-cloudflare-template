import { describe, expect, it } from 'vitest'

import { d1ComAtraso, filaMaxima } from './d1-fila'

// D1 de mentira: só precisa de prepare/batch que respondam.
const real = {
  prepare: () => ({
    bind() {
      return this
    },
    first: async () => ({}),
    run: async () => ({}),
    all: async () => ({ results: [] }),
    raw: async () => [],
  }),
  batch: async (d: unknown[]) => d.map(() => ({})),
} as unknown as D1Database

describe('d1ComAtraso', () => {
  it('uma consulta depois da outra empilha', async () => {
    const m = d1ComAtraso(real, 5)
    await m.sessao.prepare('select a').all()
    await m.sessao.prepare('select b').all()
    await m.sessao.prepare('select c').all()
    expect(m.filaMax()).toBe(3)
    expect(m.total()).toBe(3)
  })

  it('Promise.all conta como um nível só', async () => {
    const m = d1ComAtraso(real, 5)
    await Promise.all([
      m.sessao.prepare('select a').all(),
      m.sessao.prepare('select b').all(),
      m.sessao.prepare('select c').all(),
    ])
    expect(m.filaMax()).toBe(1)
    expect(m.total()).toBe(3)
  })

  it('db.batch é uma ida, e o que vem depois dele empilha', async () => {
    const m = d1ComAtraso(real, 5)
    const a = m.sessao.prepare('insert a')
    const b = m.sessao.prepare('insert b')
    await m.sessao.batch([a, b])
    await m.sessao.prepare('select c').first()
    expect(m.total()).toBe(2)
    expect(m.filaMax()).toBe(2)
    expect(m.consultas()).toEqual(['batch(2)', 'select c'])
  })

  it('em paralelo e depois em fila: 1 + 1 = 2', async () => {
    const m = d1ComAtraso(real, 5)
    await Promise.all([
      m.sessao.prepare('select a').all(),
      m.sessao.prepare('select b').all(),
    ])
    await m.sessao.prepare('select c').all()
    expect(m.filaMax()).toBe(2)
  })
})

describe('filaMaxima', () => {
  it('sem idas é zero', () => {
    expect(filaMaxima([])).toBe(0)
  })
})
