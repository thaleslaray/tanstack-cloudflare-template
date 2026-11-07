import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

// Arquivo separado do vite.config.ts de propósito: aquele carrega os plugins
// do Cloudflare, do TanStack Start e do MDX, que esperam o runtime workerd e
// geram código no build. Os testes unitários rodam em Node puro e só precisam
// do alias `#/` e de um substituto para `cloudflare:workers`.
export default defineConfig({
  resolve: {
    tsconfigPaths: true,
    alias: {
      // Só o workerd tem esse módulo; aqui entra um stub com `env` vazio.
      'cloudflare:workers': fileURLToPath(
        new URL('./src/test/cloudflare-workers.ts', import.meta.url),
      ),
    },
  },
  test: {
    environment: 'node',
    // e2e/ é do Playwright; .wrangler/ é estado local gerado.
    exclude: ['**/node_modules/**', 'e2e/**', '.wrangler/**'],
  },
})
