import { expect, test } from '@playwright/test'
import { loginWithCode } from './helpers'

// Guarda das rotas protegidas: o que nunca pode quebrar.

test('/conta anônimo vai para /login com o redirect de volta', async ({
  page,
}) => {
  await page.goto('/conta')
  await expect(page).toHaveURL(/\/login\?redirect=%2Fconta$/)
  await expect(page.getByPlaceholder('voce@exemplo.com')).toBeVisible()
})

test('depois do login, volta para a página que pediu', async ({ page }) => {
  // A query `?de=e2e` prova que o destino veio do `redirect`: sem ele o
  // login cairia no padrão, `/conta` puro.
  await page.goto('/conta?de=e2e')
  await expect(page).toHaveURL(/\/login\?redirect=%2Fconta%3Fde%3De2e$/)

  const email = `e2e-volta-${Date.now()}@exemplo.test`
  await loginWithCode(page, email)

  await expect(page).toHaveURL(/\/conta\?de=e2e$/)
  await expect(page.getByText(email).first()).toBeVisible()
})
