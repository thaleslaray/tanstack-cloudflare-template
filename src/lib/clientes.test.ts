import { describe, expect, it } from 'vitest'

import { CampoInvalido, EMAIL_MAX, NOME_MAX, validarCliente } from './clientes'

const campoDe = (data: unknown) => {
  try {
    validarCliente(data)
  } catch (e) {
    return e instanceof CampoInvalido ? e.campo : 'outro'
  }
  return undefined
}

describe('validarCliente', () => {
  it('limpa o que veio do formulário', () => {
    expect(
      validarCliente({
        nome: '  Marina Duarte ',
        email: ' Marina@Exemplo.com.br ',
        situacao: 'ativo',
      }),
    ).toEqual({
      nome: 'Marina Duarte',
      email: 'marina@exemplo.com.br',
      situacao: 'ativo',
    })
  })

  it('aponta o campo errado, para a tela mostrar o erro junto dele', () => {
    expect(campoDe({ nome: '', email: 'a@b.co', situacao: 'ativo' })).toBe(
      'nome',
    )
    expect(campoDe({ nome: 'Ana', email: 'ana@', situacao: 'ativo' })).toBe(
      'email',
    )
    expect(campoDe({ nome: 'Ana', email: 'a@b.co', situacao: 'vip' })).toBe(
      'situacao',
    )
  })

  it('recusa nome e e-mail longos demais', () => {
    expect(
      campoDe({
        nome: 'a'.repeat(NOME_MAX + 1),
        email: 'a@b.co',
        situacao: 'ativo',
      }),
    ).toBe('nome')
    expect(
      campoDe({
        nome: 'Ana',
        email: `${'a'.repeat(EMAIL_MAX)}@b.co`,
        situacao: 'ativo',
      }),
    ).toBe('email')
  })

  it('não quebra com entrada que não é objeto', () => {
    expect(campoDe(null)).toBe('nome')
    expect(campoDe('texto')).toBe('nome')
  })
})
