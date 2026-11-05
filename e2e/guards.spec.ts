import { expect, test } from '@playwright/test'

test('/conta anônimo vai para /login com o redirect de volta', async ({
  page,
}) => {
  await page.goto('/conta')
  await expect(page).toHaveURL(/\/login\?redirect=%2Fconta$/)
  await expect(page.getByPlaceholder('voce@exemplo.com')).toBeVisible()
})

test('as respostas trazem os cabeçalhos de segurança', async ({ request }) => {
  const response = await request.get('/')
  expect(response.headers()['x-content-type-options']).toBe('nosniff')
  expect(response.headers()['x-frame-options']).toBe('DENY')
})
