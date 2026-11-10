// Quais caminhos podem ser PRÉ-RENDERIZADOS (HTML estático gerado no build).
//
// Este arquivo é importado pelo `vite.config.ts` (Node), então NÃO importe nada
// do app aqui (nem `#/`, nem React, nem `cloudflare:workers`).
//
// Páginas com sessão ou bindings (login, app, demo, api) NUNCA podem ser
// pré-renderizadas: o HTML sairia congelado no build, sem cookie nem banco, e
// seria servido como estático para todo mundo, pulando a verificação de
// sessão. Por isso a regra é uma lista de PERMISSÃO (allow-list): o que não
// está aqui não vira HTML estático, mesmo que uma rota nova apareça.
//
// Rota pública nova de conteúdo? Acrescente o padrão aqui.

const PUBLIC_PATTERNS: RegExp[] = [
  /^\/$/,
  /^\/blog$/,
  /^\/blog\/[a-z0-9-]+$/,
  /^\/docs$/,
  /^\/docs\/[a-z0-9-]+$/,
  /^\/termos$/,
  /^\/privacidade$/,
]

export function isPrerenderable(path: string): boolean {
  // Query string não é página: `/blog?x=1` escreveria o mesmo blog/index.html.
  if (path.includes('?')) return false
  const clean = path.length > 1 ? path.replace(/\/+$/, '') : path
  return PUBLIC_PATTERNS.some((re) => re.test(clean))
}

// Páginas fixas que entram no sitemap.xml (scripts/generate-sitemap.ts). Posts,
// docs e páginas legais entram sozinhos, a partir de content/. `/docs` fica de
// fora porque só redireciona para a primeira página das docs.
export const SITEMAP_STATIC_PATHS = ['/', '/blog'] as const

// Caminhos que os buscadores não devem visitar (robots.txt). São as áreas com
// sessão ou sem conteúdo: o oposto da lista de cima. `/app` é a área logada
// (e `/app/...`); `/conta` é o endereço antigo, que só redireciona para lá;
// `/blocos` é o catálogo de blocos da landing e `/estilo` a bancada das peças
// de tela: bancadas sem conteúdo próprio.
export const ROBOTS_DISALLOW = [
  '/api/',
  '/app',
  '/blocos',
  '/conta',
  '/estilo',
  '/demo/', // as demos só existem no `npm run dev`; em produção dão 404
] as const
