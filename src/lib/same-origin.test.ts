import { describe, expect, it } from 'vitest'

import { isCrossSiteRequest, isCrossSiteServerFnCall } from './same-origin'

const call = (path: string, headers: Record<string, string> = {}) =>
  isCrossSiteServerFnCall(
    new Request(`https://app.exemplo.com${path}`, { headers }),
  )

describe('isCrossSiteServerFnCall', () => {
  it('aceita chamada da própria origem', () => {
    expect(call('/_serverFn/abc', { 'sec-fetch-site': 'same-origin' })).toBe(
      false,
    )
    expect(call('/_serverFn/abc', { 'sec-fetch-site': 'none' })).toBe(false)
  })

  it('recusa cross-site e same-site pelo Sec-Fetch-Site', () => {
    expect(call('/_serverFn/abc', { 'sec-fetch-site': 'cross-site' })).toBe(
      true,
    )
    expect(call('/_serverFn/abc', { 'sec-fetch-site': 'same-site' })).toBe(true)
  })

  it('usa o Origin quando não há Sec-Fetch-Site', () => {
    expect(call('/_serverFn/abc', { origin: 'https://evil.example' })).toBe(
      true,
    )
    expect(call('/_serverFn/abc', { origin: 'https://app.exemplo.com' })).toBe(
      false,
    )
  })

  it('deixa passar quem não é navegador (sem cabeçalhos)', () => {
    expect(call('/_serverFn/abc')).toBe(false)
  })

  it('ignora caminhos fora de /_serverFn/', () => {
    expect(call('/api/webhooks/x', { 'sec-fetch-site': 'cross-site' })).toBe(
      false,
    )
  })
})

describe('isCrossSiteRequest (rotas de API com cookie)', () => {
  const req = (headers: Record<string, string> = {}) =>
    isCrossSiteRequest(
      new Request('https://app.exemplo.com/api/avatar', {
        method: 'POST',
        headers,
      }),
    )

  it('vale para qualquer caminho, não só /_serverFn/', () => {
    expect(req({ 'sec-fetch-site': 'cross-site' })).toBe(true)
    expect(req({ 'sec-fetch-site': 'same-origin' })).toBe(false)
    expect(req({ origin: 'https://evil.example' })).toBe(true)
    expect(req({ origin: 'https://app.exemplo.com' })).toBe(false)
    expect(req()).toBe(false)
  })
})
