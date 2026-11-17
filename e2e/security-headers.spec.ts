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
for (const path of ['/', '/login', '/app', '/api/auth/ok']) {
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

// Cache dos arquivos com hash (public/_headers): imutável por um ano, só em /assets/.
const IMUTAVEL = 'public, max-age=31536000, immutable'

test('estático: arquivos com hash em /assets/ (JS e CSS) têm cache imutável', async ({
  request,
}) => {
  const html = await (await request.get(`${previewURL}/`)).text()
  const js = /\/assets\/[^"']+\.js/.exec(html)?.[0]
  const css = /\/assets\/[^"']+\.css/.exec(html)?.[0]
  expect(js, 'a home deveria citar um /assets/*.js').toBeTruthy()
  expect(css, 'a home deveria citar um /assets/*.css').toBeTruthy()

  for (const asset of [js, css]) {
    const res = await request.get(previewURL + asset)
    expect(res.status(), String(asset)).toBe(200)
    expectSecurityHeaders(res)
    expect(res.headers()['cache-control'], String(asset)).toBe(IMUTAVEL)
  }
})

test('o cache imutável NÃO vaza para o HTML nem para o que não tem hash', async ({
  request,
}) => {
  // Páginas pré-renderizadas e arquivos de public/ sem hash: revalidam sempre.
  for (const path of ['/', '/blog', '/og.png', '/robots.txt']) {
    const res = await request.get(previewURL + path)
    expect(res.status(), path).toBe(200)
    const cache = res.headers()['cache-control'] ?? ''
    expect(cache, path).not.toContain('immutable')
    expect(cache, path).not.toContain('max-age=31536000')
  }
  // Rota dinâmica (Worker): a de erro também não herda o cache imutável.
  const naoAchou = await request.get(`${previewURL}/nao-existe`)
  expect(naoAchou.headers()['cache-control'] ?? '').not.toContain('immutable')
})
