import { expect, test } from '@playwright/test'

test('a home carrega em pt-BR com o título do hero', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('html')).toHaveAttribute('lang', 'pt-BR')
  await expect(page.locator('h1').first()).toContainText('Seu app completo')
})

test('o header leva ao blog, que lista posts', async ({ page }) => {
  await page.goto('/')
  const header = page.locator('header')
  await expect(header.getByRole('link', { name: 'Docs' }).first()).toBeVisible()
  await header.getByRole('link', { name: 'Blog' }).first().click()
  await expect(page).toHaveURL(/\/blog$/)
  await expect(page.locator('a[href^="/blog/"]').first()).toBeVisible()
})

test('/docs redireciona para /docs/comecando', async ({ page }) => {
  await page.goto('/docs')
  await expect(page).toHaveURL(/\/docs\/comecando$/)
  await expect(page.locator('h1').first()).toBeVisible()
})

test('rota inexistente responde 404 com a página própria', async ({ page }) => {
  const response = await page.goto('/nao-existe')
  expect(response?.status()).toBe(404)
  await expect(page.getByText('Página não encontrada')).toBeVisible()
})
