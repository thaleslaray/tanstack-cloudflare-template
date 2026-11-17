import fs from 'node:fs'
import { describe, expect, it } from 'vitest'

import {
  mensagem404,
  numeroDaRodada,
  preencherCampos,
  rotasParaConferir,
  validarRotas,
} from './rotas.js'

const padrao = JSON.parse(
  fs.readFileSync(new URL('./rotas.json', import.meta.url), 'utf8'),
)

describe('load/rotas.json', () => {
  it('o arquivo padrão é válido e traz a escrita de clientes', () => {
    const c = validarRotas(padrao)
    expect(c.publicasEstaticas).toEqual(['/', '/blog'])
    expect(c.logadas).toContain('/app/clientes')
    expect(c.escrita?.criar.funcao).toBe('createClienteFn')
  })

  it('escrita é opcional', () => {
    expect(validarRotas({ ...padrao, escrita: null }).escrita).toBeNull()
    const { escrita: _, ...semEscrita } = padrao
    expect(validarRotas(semEscrita).escrita).toBeNull()
  })

  it('recusa arquivo sem nenhuma rota', () => {
    expect(() => validarRotas({})).toThrow(/nenhuma rota configurada/)
  })

  it('recusa caminho sem barra e lista que não é lista', () => {
    expect(() => validarRotas({ logadas: ['app'] })).toThrow(/inválido/)
    expect(() => validarRotas({ logadas: '/app' })).toThrow(/lista/)
  })

  it('recusa escrita incompleta', () => {
    expect(() =>
      validarRotas({ logadas: ['/app'], escrita: { pagina: '/x' } }),
    ).toThrow(/escrita\.criar\.campos/)
  })

  it('preenche {n} nos campos', () => {
    expect(preencherCampos({ nome: 'Cliente {n}', s: 'ativo' }, '2-5')).toEqual(
      { nome: 'Cliente 2-5', s: 'ativo' },
    )
  })

  it('{num} vira só dígitos (campo como telefone), {n} leva hífen', () => {
    const c = preencherCampos(
      { telefone: '11987{num}', nome: 'Cliente {n}' },
      '2-5',
      numeroDaRodada(2, 5),
    )
    expect(c.telefone).toBe('11987020005')
    expect(c.telefone).toMatch(/^\d{11}$/)
    expect(c.nome).toBe('Cliente 2-5')
  })

  it('numeroDaRodada tem 6 dígitos e não repete entre VUs e rodadas', () => {
    expect(numeroDaRodada(1, 0)).toBe('010000')
    expect(numeroDaRodada(20, 9999)).toBe('209999')
    const vistos = new Set<string>()
    for (let vu = 1; vu <= 20; vu++)
      for (let r = 0; r < 200; r++) vistos.add(numeroDaRodada(vu, r))
    expect(vistos.size).toBe(20 * 200)
  })

  it('lista as rotas a conferir sem repetir', () => {
    const lista = rotasParaConferir(validarRotas(padrao))
    const caminhos = lista.map((r) => `${r.logada ? 'L' : 'P'}${r.caminho}`)
    expect(caminhos).toEqual([
      'P/',
      'P/blog',
      'P/login',
      'L/app',
      'L/app/clientes',
    ])
  })

  it('a mensagem do 404 diz a rota e o arquivo', () => {
    expect(mensagem404('/app/clientes')).toMatch(
      /\/app\/clientes.*404.*rotas\.json/,
    )
  })
})
