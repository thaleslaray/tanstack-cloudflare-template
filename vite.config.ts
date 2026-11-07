import { cloudflare } from '@cloudflare/vite-plugin'
import mdx from '@mdx-js/rollup'
import tailwindcss from '@tailwindcss/vite'
import { devtools } from '@tanstack/devtools-vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import remarkFrontmatter from 'remark-frontmatter'
import remarkGfm from 'remark-gfm'
import remarkMdxFrontmatter from 'remark-mdx-frontmatter'
import { defineConfig } from 'vite'

import { isPrerenderable } from './src/config/public-paths.ts'
import { mdxMeta } from './src/lib/content/mdx-meta-plugin.ts'
import { remarkHeadings } from './src/lib/content/remark-headings.ts'

const config = defineConfig({
  resolve: { tsconfigPaths: true },
  server: {
    // O D1/R2/DO locais gravam em .wrangler/state; sem isto, cada escrita no
    // banco recarregaria a página. A porta vem do script (`vite dev --port 3000`).
    watch: { ignored: ['**/.wrangler/**'] },
  },
  plugins: [
    devtools(),
    // MDX compila para módulos ES no build: sem `eval` em runtime (o workerd
    // proíbe). `enforce: 'pre'` para rodar antes dos plugins do React/Start.
    {
      ...mdx({
        // Só .mdx; .md continua texto puro.
        include: /\.mdx$/,
        remarkPlugins: [
          remarkFrontmatter,
          remarkMdxFrontmatter,
          remarkGfm,
          // ids nos `##`/`###` e o export `headings` do sumário.
          remarkHeadings,
        ],
      }),
      enforce: 'pre',
    },
    // `arquivo.mdx?meta`: só o frontmatter, sem o corpo da página.
    mdxMeta(),
    // O ambiente `ssr` do Vite vira o Worker (config em wrangler.jsonc).
    // Sempre antes de tanstackStart(), senão "server-entry not found".
    cloudflare({ viteEnvironment: { name: 'ssr' } }),
    tailwindcss(),
    tanstackStart({
      // Páginas públicas de conteúdo viram HTML estático no build e saem da
      // camada de assets da Cloudflare. Login, conta, demo e api NUNCA entram:
      // dependem de sessão e bindings. A allow-list fica em
      // src/config/public-paths.ts.
      prerender: {
        enabled: true,
        crawlLinks: true,
        failOnError: true,
        filter: (page) => isPrerenderable(page.path),
      },
    }),
    viteReact(),
  ],
})

export default config
