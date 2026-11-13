import { expect, test } from '@playwright/test'
import { loginWithCode } from './helpers'

// Guarda das rotas protegidas: o que nunca pode quebrar.

test('/app anônimo vai para /login com o redirect de volta', async ({
  page,
}) => {
  await page.goto('/app')
  await expect(page).toHaveURL(/\/login\?redirect=%2Fapp$/)
  await expect(page.getByPlaceholder('voce@exemplo.com')).toBeVisible()
})

test('depois do login, volta para a página que pediu', async ({ page }) => {
  // A query `?de=e2e` prova que o destino veio do `redirect`: sem ele o
  // login cairia no padrão, `/app` puro.
  await page.goto('/app/configuracoes?de=e2e')
  await expect(page).toHaveURL(
    /\/login\?redirect=%2Fapp%2Fconfiguracoes%3Fde%3De2e$/,
  )

  const email = `e2e-volta-${Date.now()}@exemplo.test`
  await loginWithCode(page, email)

  await expect(page).toHaveURL(/\/app\/configuracoes\?de=e2e$/)
  await expect(page.getByText(email).first()).toBeVisible()
})
