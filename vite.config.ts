import { defineConfig } from 'vite'
import { devtools } from '@tanstack/devtools-vite'

import { tanstackStart } from '@tanstack/react-start/plugin/vite'

import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { cloudflare } from '@cloudflare/vite-plugin'

const config = defineConfig({
  resolve: { tsconfigPaths: true },
  // `cf dev` não aceita --port: a porta vem daqui. `PORT=3001 npm run dev`
  // quando a 3000 estiver ocupada (lembre de ajustar BETTER_AUTH_URL no .dev.vars).
  server: { port: Number(process.env.PORT) || 3000 },
  plugins: [
    devtools(),
    cloudflare(),
    tailwindcss(),
    tanstackStart(),
    viteReact(),
  ],
})

export default config
