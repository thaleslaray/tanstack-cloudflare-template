import { describe, expect, it } from 'vitest'

import { SECURITY_HEADERS, withSecurityHeaders } from './security-headers'

const http = new Request('http://localhost:3000/')
const https = new Request('https://app.exemplo.com/')

describe('withSecurityHeaders', () => {
  it('adiciona os cabeçalhos de segurança', () => {
    const res = withSecurityHeaders(new Response('ok'), http)
    for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
      expect(res.headers.get(name)).toBe(value)
    }
  })

  it('envia HSTS só em https', () => {
    expect(
      withSecurityHeaders(new Response('ok'), http).headers.get(
        'strict-transport-security',
      ),
    ).toBeNull()
    expect(
      withSecurityHeaders(new Response('ok'), https).headers.get(
        'strict-transport-security',
      ),
    ).toContain('max-age=')
  })

  it('mantém os demais cabeçalhos da resposta original', () => {
    const res = withSecurityHeaders(
      new Response('ok', { headers: { 'x-custom': 'sim' } }),
      http,
    )
    expect(res.headers.get('x-custom')).toBe('sim')
  })

  it('não sobrescreve um cabeçalho que a resposta já trazia', () => {
    const res = withSecurityHeaders(
      new Response('ok', { headers: { 'x-frame-options': 'SAMEORIGIN' } }),
      http,
    )
    expect(res.headers.get('x-frame-options')).toBe('SAMEORIGIN')
  })

  it('preserva status, statusText e corpo', async () => {
    const res = withSecurityHeaders(
      new Response('quebrou', { status: 418, statusText: 'Bule' }),
      http,
    )
    expect(res.status).toBe(418)
    expect(res.statusText).toBe('Bule')
    expect(await res.text()).toBe('quebrou')
  })
})
