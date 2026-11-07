import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, test } from '@playwright/test'

const logPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '.dev.log',
)

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// Sem provedor de e-mail, o servidor de dev imprime o código no terminal; o Playwright
// redireciona essa saída para e2e/.dev.log. Lemos o arquivo até o código aparecer.
async function readLoginCode(email: string): Promise<string> {
  if (!fs.existsSync(logPath)) {
    throw new Error(
      'e2e/.dev.log não existe: este teste precisa que o Playwright suba o `vite dev` ' +
        '(webServer com reuseExistingServer: false). Pare qualquer servidor na porta 3000 ' +
        'e rode `npm run e2e`.',
    )
  }
  const pattern = new RegExp(
    `\\[auth\\] código de login para ${escapeRegExp(email)}: (\\d{6})`,
  )
  const deadline = Date.now() + 15_000
  while (Date.now() < deadline) {
    const match = pattern.exec(fs.readFileSync(logPath, 'utf8'))
    if (match) return match[1]
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  throw new Error(
    `O código de login para ${email} não apareceu em e2e/.dev.log em 15 s.`,
  )
}

test('entra com o código enviado por e-mail e chega em /conta', async ({
  page,
}) => {
  const email = `e2e-${Date.now()}@exemplo.test`

  await page.goto('/login')
  const emailInput = page.getByPlaceholder('voce@exemplo.com')
  const continuar = page.getByRole('button', { name: 'Continuar com e-mail' })

  // O SSR entrega o HTML antes da hidratação: um fill feito cedo demais some
  // quando o React assume o campo. Em dev a primeira hidratação é lenta (o Vite
  // compila os módulos sob demanda), então esperamos o React anexar as props.
  await emailInput.waitFor()
  await emailInput.evaluate(
    (el) =>
      new Promise<void>((resolve) => {
        const check = () =>
          Object.keys(el).some((key) => key.startsWith('__reactProps'))
            ? resolve()
            : setTimeout(check, 100)
        check()
      }),
    undefined,
    { timeout: 45_000 },
  )
  await emailInput.fill(email)
  await expect(continuar).toBeEnabled()
  await continuar.click()

  const codeInput = page.getByPlaceholder('000000')
  await expect(codeInput).toBeVisible()

  const code = await readLoginCode(email)
  await codeInput.fill(code)
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()

  await expect(page).toHaveURL(/\/conta$/)
  await expect(page.getByText(email).first()).toBeVisible()
})
