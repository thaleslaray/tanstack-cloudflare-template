import { afterEach, describe, expect, it, vi } from 'vitest'

import { registrarErro } from './log-erro'

afterEach(() => vi.restoreAllMocks())

describe('registrarErro', () => {
  it('escreve UMA linha de console.error com o lugar e a mensagem', () => {
    const erro = vi.spyOn(console, 'error').mockImplementation(() => {})
    registrarErro('GET /app', new Error('Muitas requisições.'))
    expect(erro).toHaveBeenCalledTimes(1)
    const linha = String(erro.mock.calls[0]?.[0])
    expect(linha).toContain('GET /app')
    expect(linha).toContain('Muitas requisições.')
  })

  it('aceita o que não é Error (string, objeto)', () => {
    const erro = vi.spyOn(console, 'error').mockImplementation(() => {})
    registrarErro('x', 'texto solto')
    registrarErro('y', { a: 1 })
    expect(String(erro.mock.calls[0]?.[0])).toContain('texto solto')
    expect(String(erro.mock.calls[1]?.[0])).toContain('"a":1')
  })

  it('redirect e notFound do router não são erro: não registra', () => {
    const erro = vi.spyOn(console, 'error').mockImplementation(() => {})
    registrarErro(
      'GET /app',
      Object.assign(new Response(null, { status: 307 }), { isRedirect: true }),
    )
    registrarErro('GET /x', { isNotFound: true })
    expect(erro).not.toHaveBeenCalled()
  })
})
