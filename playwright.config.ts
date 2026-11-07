import { defineConfig, devices } from '@playwright/test'

// Testes ponta a ponta contra o servidor de desenvolvimento real (`vite dev`:
// workerd + D1 local). `npm run e2e` sobe o servidor sozinho. A saída vai para
// e2e/.dev.log: é dali que o teste de login lê o código impresso no terminal.
// Porta 3000 ocupada? `E2E_PORT=3001 npm run e2e` (e ponha
// BETTER_AUTH_URL=http://localhost:3001 no .dev.vars). Veja e2e/README.md.
const port = Number(process.env.E2E_PORT) || 3000
const baseURL = `http://localhost:${port}`

export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.ts',
  // Um servidor só, uma porta só: sem paralelismo entre arquivos.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL,
    actionTimeout: 15_000,
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    // `--strictPort`: se a porta estiver ocupada, falha em vez de pular para outra.
    command: `npx vite dev --port ${port} --strictPort > e2e/.dev.log 2>&1`,
    url: `${baseURL}/`,
    // Sempre sobe o próprio servidor: o login precisa do log em e2e/.dev.log.
    reuseExistingServer: false,
    timeout: 120_000,
  },
})
