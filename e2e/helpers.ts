import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, type Locator, type Page } from '@playwright/test'

// Portas dos dois servidores que o playwright.config.ts sobe:
// - dev (`vite dev`): o app de verdade, com o log em e2e/.dev.log;
// - preview (`npm run preview`): a saída de produção, onde a camada de assets
//   aplica o public/_headers aos arquivos estáticos (o `vite dev` não aplica).
export const devPort = Number(process.env.E2E_PORT) || 3000
export const previewPort = Number(process.env.E2E_PREVIEW_PORT) || 4173
export const previewURL = `http://localhost:${previewPort}`

const logPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '.dev.log',
)

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// Sem provedor de e-mail, o servidor de dev imprime o código no terminal; o Playwright
// redireciona essa saída para e2e/.dev.log. Lemos o arquivo até o código aparecer.
export async function readLoginCode(email: string): Promise<string> {
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

// O SSR entrega o HTML antes da hidratação: um fill feito cedo demais some
// quando o React assume o campo. Em dev a primeira hidratação é lenta (o Vite
// compila os módulos sob demanda), então esperamos o React anexar as props.
export async function waitForHydration(field: Locator) {
  await field.waitFor()
  await field.evaluate(
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
}

// Faz o login por código na página /login já aberta (com ou sem ?redirect).
export async function loginWithCode(page: Page, email: string) {
  const emailInput = page.getByPlaceholder('voce@exemplo.com')
  const continuar = page.getByRole('button', { name: 'Continuar com e-mail' })

  await waitForHydration(emailInput)
  await emailInput.fill(email)
  await expect(continuar).toBeEnabled()
  await continuar.click()

  const codeInput = page.getByPlaceholder('000000')
  await expect(codeInput).toBeVisible()

  const code = await readLoginCode(email)
  await codeInput.fill(code)
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
}
