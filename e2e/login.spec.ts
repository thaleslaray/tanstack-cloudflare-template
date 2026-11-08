import { expect, test } from '@playwright/test'
import { loginWithCode } from './helpers'

test('entra com o código enviado por e-mail e chega em /conta', async ({
  page,
}) => {
  const email = `e2e-${Date.now()}@exemplo.test`

  await page.goto('/login')
  await loginWithCode(page, email)

  await expect(page).toHaveURL(/\/conta$/)
  await expect(page.getByText(email).first()).toBeVisible()
})
