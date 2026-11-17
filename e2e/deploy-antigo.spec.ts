import { expect, test } from '@playwright/test'
import { previewURL } from './helpers'

// Aba aberta antes de um deploy: o HTML antigo cita arquivos com hash que não
// existem mais. Roda contra o `npm run preview` (a saída de produção, com a
// camada de assets). Veja src/lib/missing-asset.ts e src/lib/chunk-reload.ts.

test('arquivo de /assets/ que não existe: 404 de verdade, nunca o HTML do app', async ({
  request,
}) => {
  for (const nome of ['index-NaoExiste1.js', 'styles-NaoExiste2.css']) {
    const res = await request.get(`${previewURL}/assets/${nome}`)
    expect(res.status(), nome).toBe(404)
    expect(res.headers()['content-type'], nome).not.toContain('text/html')
    expect(res.headers()['cache-control'], nome).toBe('no-store')
    const corpo = await res.text()
    expect(corpo, nome).not.toContain('<html')
    expect(corpo, nome).not.toContain('<!DOCTYPE')
    // O 404 também leva os cabeçalhos de segurança.
    expect(res.headers()['x-content-type-options']).toBe('nosniff')
  }
})

test('rota que não é arquivo segue com a página própria de 404', async ({
  request,
}) => {
  const res = await request.get(`${previewURL}/nao-existe`)
  expect(res.status()).toBe(404)
  expect(res.headers()['content-type']).toContain('text/html')
})

const disparaErroDeChunk = (page: import('@playwright/test').Page) =>
  page.evaluate(() => {
    // O mesmo evento que o Vite dispara quando um chunk não carrega.
    window.dispatchEvent(new Event('vite:preloadError', { cancelable: true }))
  })

test('vite:preloadError recarrega a página UMA vez, sem laço', async ({
  page,
}) => {
  let cargas = 0
  page.on('load', () => {
    cargas += 1
  })
  await page.goto(`${previewURL}/`)
  await expect.poll(() => cargas).toBe(1)

  // 1º erro: recarrega (2ª carga) e grava a hora no sessionStorage.
  await disparaErroDeChunk(page)
  await expect.poll(() => cargas).toBe(2)
  await expect
    .poll(() => page.evaluate(() => 'chunk-reload-at' in sessionStorage))
    .toBe(true)

  // 2º erro, dentro da janela: o evento segue o caminho normal, sem recarregar.
  await disparaErroDeChunk(page)
  await page.waitForTimeout(1_500)
  expect(cargas).toBe(2)
})

test('chunk de rota que sumiu depois do deploy: a tela recarrega e para (sem laço)', async ({
  page,
}) => {
  // Como depois de um deploy: o chunk da rota /login "sumiu" (404).
  await page.route(/\/assets\/login-[^/]+\.js$/, (route) =>
    route.fulfill({ status: 404, contentType: 'text/plain', body: 'sumiu' }),
  )
  let cargas = 0
  page.on('load', () => {
    cargas += 1
  })
  await page.goto(`${previewURL}/`)
  await expect.poll(() => cargas).toBe(1)

  // O clique tenta a rota nova, falha e a página recarrega. Pode haver mais de
  // uma recarga (o `lazyRouteComponent` do próprio TanStack Router tem a dele,
  // guardada à parte), mas cada uma só acontece uma vez: o número de cargas
  // para de crescer, mesmo com novos cliques no link que continua quebrado.
  await page.locator('a[href="/login"]').first().click({ noWaitAfter: true })
  await expect
    .poll(() => page.evaluate(() => 'chunk-reload-at' in sessionStorage))
    .toBe(true)
  await page.waitForTimeout(3_000)
  const estavel = cargas
  expect(estavel).toBeGreaterThanOrEqual(2)
  expect(estavel).toBeLessThanOrEqual(4)
  await page.locator('a[href="/login"]').first().click({ noWaitAfter: true })
  await page.waitForTimeout(2_000)
  expect(cargas).toBe(estavel)
})
