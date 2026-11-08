// Gera public/sitemap.xml e public/robots.txt. Roda sozinho antes de todo
// `npm run build` (script `prebuild`); à mão: `npm run sitemap`.
//
// De onde vem cada coisa:
// - URL base: appConfig.url (src/config/app.ts). Troque lá antes de publicar.
// - Páginas fixas e o que o robots.txt bloqueia: src/config/public-paths.ts.
// - Posts, docs e páginas legais: os arquivos .mdx de content/ (o nome do
//   arquivo é o slug, igual às rotas). A data do frontmatter vira <lastmod>.
//
// Toda URL passa por isPrerenderable(): se alguma não for pública, o script
// falha em vez de anunciar aos buscadores uma página com sessão.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse } from 'yaml'

import { appConfig } from '../src/config/app.ts'
import {
  isPrerenderable,
  ROBOTS_DISALLOW,
  SITEMAP_STATIC_PATHS,
} from '../src/config/public-paths.ts'

const root = fileURLToPath(new URL('..', import.meta.url))
const base = appConfig.url.replace(/\/+$/, '')

type Page = { path: string; lastmod?: string }

// Lê o frontmatter (o bloco entre os dois `---` do topo) de cada .mdx.
function collection(
  dir: string,
): { slug: string; data: Record<string, unknown> }[] {
  const folder = join(root, 'content', dir)
  return readdirSync(folder)
    .filter((name) => name.endsWith('.mdx'))
    .sort()
    .map((name) => {
      const source = readFileSync(join(folder, name), 'utf8')
      const block = /^---\r?\n([\s\S]*?)\r?\n---/.exec(source)?.[1] ?? ''
      return { slug: name.replace(/\.mdx$/, ''), data: parse(block) ?? {} }
    })
}

const date = (value: unknown) =>
  typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? value
    : undefined

const posts = collection('blog').map(({ slug, data }) => ({
  path: `/blog/${slug}`,
  lastmod: date(data.date),
}))
const docs = collection('docs').map(({ slug }) => ({ path: `/docs/${slug}` }))
const legal = collection('legal').map(({ slug, data }) => ({
  path: `/${slug}`,
  lastmod: date(data.updated),
}))

const newestPost = posts
  .map((p) => p.lastmod)
  .filter(Boolean)
  .sort()
  .at(-1)

const pages: Page[] = [
  ...SITEMAP_STATIC_PATHS.map((path) => ({
    path,
    lastmod: path === '/blog' ? newestPost : undefined,
  })),
  ...posts,
  ...docs,
  ...legal,
]

const notPublic = pages.filter((p) => !isPrerenderable(p.path))
if (notPublic.length > 0) {
  throw new Error(
    `Estas páginas não são públicas (src/config/public-paths.ts) e não podem ir para o sitemap: ${notPublic.map((p) => p.path).join(', ')}`,
  )
}

const escapeXml = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

const urls = pages
  .map(({ path, lastmod }) =>
    [
      '  <url>',
      `    <loc>${escapeXml(base + path)}</loc>`,
      ...(lastmod ? [`    <lastmod>${lastmod}</lastmod>`] : []),
      '  </url>',
    ].join('\n'),
  )
  .join('\n')

writeFileSync(
  join(root, 'public/sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>
<!-- Gerado por scripts/generate-sitemap.ts (npm run sitemap). Não edite à mão. -->
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`,
)

writeFileSync(
  join(root, 'public/robots.txt'),
  [
    '# Gerado por scripts/generate-sitemap.ts (npm run sitemap). Não edite à mão:',
    '# a lista de bloqueios fica em src/config/public-paths.ts e a URL em src/config/app.ts.',
    'User-agent: *',
    ...ROBOTS_DISALLOW.map((path) => `Disallow: ${path}`),
    '',
    `Sitemap: ${base}/sitemap.xml`,
    '',
  ].join('\n'),
)

console.log(`sitemap.xml: ${pages.length} páginas (${base})`)
