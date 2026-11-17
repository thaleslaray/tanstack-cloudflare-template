import { describe, expect, it } from 'vitest'

import { linhaDeDesempenho, perfLogLigado } from './perf-log'

describe('perfLogLigado', () => {
  it('liga só com 1, true ou on', () => {
    for (const v of ['1', 'true', 'TRUE', ' on ']) {
      expect(perfLogLigado(v), v).toBe(true)
    }
  })

  it('vazio, 0, ausente e outros textos desligam', () => {
    for (const v of ['', '0', 'false', 'off', 'sim', undefined, null, 1]) {
      expect(perfLogLigado(v), String(v)).toBe(false)
    }
  })
})

describe('linhaDeDesempenho', () => {
  const base = {
    method: 'GET',
    status: 200,
    ms: 412.6,
    colo: 'GIG',
  }

  it('uma linha JSON com caminho (sem a query), status, tempo, colo e as idas', () => {
    const linha = linhaDeDesempenho({
      ...base,
      url: 'https://app.exemplo.com/app/clientes?token=segredo',
      idas: [
        { sql: 'select session', start: 0.2, end: 180.4 },
        { sql: 'select clientes', start: 182, end: 392 },
      ],
    })
    expect(linha).not.toContain('\n')
    expect(linha).not.toContain('segredo')
    expect(JSON.parse(linha)).toEqual({
      perf: 1,
      method: 'GET',
      path: '/app/clientes',
      status: 200,
      ms: 413,
      colo: 'GIG',
      idas: 2,
      fila: 2,
      d1_regioes: [],
      d1: [
        { q: 'select session', at: 0, ms: 180 },
        { q: 'select clientes', at: 182, ms: 210 },
      ],
    })
  })

  it('Promise.all conta como uma ida em fila; batch é uma só', () => {
    const j = JSON.parse(
      linhaDeDesempenho({
        ...base,
        url: 'http://localhost/app',
        colo: undefined,
        idas: [
          { sql: 'select a', start: 0, end: 50 },
          { sql: 'select b', start: 1, end: 52 },
          { sql: 'batch(2)', start: 60, end: 100 },
        ],
      }),
    )
    expect(j.idas).toBe(3)
    expect(j.fila).toBe(2)
    expect(j.colo).toBeNull()
  })

  it('pedido sem consulta ao banco', () => {
    const j = JSON.parse(
      linhaDeDesempenho({ ...base, url: 'http://localhost/', idas: [] }),
    )
    expect(j).toMatchObject({ idas: 0, fila: 0, d1: [] })
  })

  it('traz a região do D1 que respondeu e se foi o primário', () => {
    const j = JSON.parse(
      linhaDeDesempenho({
        ...base,
        url: 'http://localhost/app',
        idas: [
          {
            sql: 'select a',
            start: 0,
            end: 10,
            regiao: 'ENAM',
            primario: false,
          },
          {
            sql: 'insert b',
            start: 12,
            end: 30,
            regiao: 'ENAM',
            primario: true,
          },
          { sql: 'select c', start: 31, end: 40 },
        ],
      }),
    )
    expect(j.d1_regioes).toEqual(['ENAM'])
    expect(j.d1[0]).toMatchObject({ r: 'ENAM', p: false })
    expect(j.d1[1]).toMatchObject({ r: 'ENAM', p: true })
    expect(j.d1[2]).not.toHaveProperty('r')
  })
})
