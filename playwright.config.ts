import { defineConfig, devices } from '@playwright/test'

// Testes ponta a ponta contra o servidor de desenvolvimento real (workerd + D1 local).
// `npm run e2e` sobe `npm run dev` sozinho. A saída vai para e2e/.dev.log: é dali que
// o teste de login lê o código que o `cf dev` imprime no terminal. Veja e2e/README.md.
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
    baseURL: 'http://localhost:3000',
    actionTimeout: 15_000,
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run dev > e2e/.dev.log 2>&1',
    url: 'http://localhost:3000/',
    // Sempre sobe o próprio servidor: o login precisa do log em e2e/.dev.log.
    reuseExistingServer: false,
    timeout: 120_000,
  },
})
