import { type APIResponse, expect, test } from '@playwright/test'
import { previewURL } from './helpers'

// Os mesmos cabeçalhos saem de dois lugares (mantenha os dois iguais):
// - src/lib/security-headers.ts, nas respostas do Worker (SSR, API, redirects);
// - public/_headers, nos arquivos que a camada de assets serve sem passar pelo
//   Worker (páginas pré-renderizadas, /assets/*, imagens). Isso só existe na
//   saída de produção, então esses casos rodam contra o `npm run preview`.

function expectSecurityHeaders(res: APIResponse) {
  const headers = res.headers()
  expect(headers['x-content-type-options']).toBe('nosniff')
  expect(headers['x-frame-options']).toBe('DENY')
  expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin')
  expect(headers['permissions-policy']).toContain('camera=()')
}

// Respostas do Worker no dev: página SSR, redirect do guard e API.
for (const path of ['/', '/login', '/conta', '/api/auth/ok']) {
  test(`Worker: cabeçalhos em ${path}`, async ({ request }) => {
    const res = await request.get(path, { maxRedirects: 0 })
    expect(res.status()).toBeLessThan(400)
    expectSecurityHeaders(res)
  })
}

test('estático: página pré-renderizada e arquivos de public/', async ({
  request,
}) => {
  for (const path of ['/blog', '/og.png', '/robots.txt']) {
    const res = await request.get(previewURL + path)
    expect(res.status(), path).toBe(200)
    expectSecurityHeaders(res)
  }
})

test('estático: arquivo com hash em /assets/ (e cache imutável)', async ({
  request,
}) => {
  const html = await (await request.get(`${previewURL}/`)).text()
  const asset = /\/assets\/[^"']+\.js/.exec(html)?.[0]
  expect(asset, 'a home deveria citar um /assets/*.js').toBeTruthy()

  const res = await request.get(previewURL + asset)
  expect(res.status()).toBe(200)
  expectSecurityHeaders(res)
  expect(res.headers()['cache-control']).toContain('immutable')
})
