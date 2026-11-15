import fs from 'node:fs'
import { describe, expect, it } from 'vitest'

import {
  mensagem404,
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
