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

  describe('Cache-Control das áreas privadas', () => {
    const html = () =>
      new Response('<p>oi</p>', { headers: { 'content-type': 'text/html' } })
    const at = (path: string) => new Request(`http://localhost:3000${path}`)

    it('HTML em /app e /app/... sai com no-store', () => {
      for (const path of ['/app', '/app/', '/app/configuracoes']) {
        expect(
          withSecurityHeaders(html(), at(path)).headers.get('cache-control'),
        ).toBe('no-store')
      }
    })

    it('server functions saem com no-store', () => {
      const res = withSecurityHeaders(
        Response.json({ a: 1 }),
        at('/_serverFn/abc'),
      )
      expect(res.headers.get('cache-control')).toBe('no-store')
    })

    it('páginas públicas e /application não mudam', () => {
      for (const path of ['/', '/blog', '/application']) {
        expect(
          withSecurityHeaders(html(), at(path)).headers.get('cache-control'),
        ).toBeNull()
      }
    })

    it('HTML fora de /app e não-HTML em /app não mudam', () => {
      const res = withSecurityHeaders(Response.json({}), at('/app/x'))
      expect(res.headers.get('cache-control')).toBeNull()
    })

    it('não sobrescreve um Cache-Control que a resposta já trazia', () => {
      const res = withSecurityHeaders(
        new Response('x', {
          headers: { 'content-type': 'text/html', 'cache-control': 'private' },
        }),
        at('/app'),
      )
      expect(res.headers.get('cache-control')).toBe('private')
    })
  })
})
