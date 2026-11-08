import { appConfig } from '#/config/app'

// Metadados de SEO de uma página. O `__root.tsx` já põe os padrões do site
// inteiro (canonical, og:site_name, og:image, twitter:card); o router junta os
// `head` de todas as rotas da página, sem repetir `name`/`property`, e a rota
// mais funda vence. Por isso cada página só declara o que é dela:
//
//   head: () => ({ meta: seo({ title: 'Blog', description: '...' }) })
export function seo({
  title,
  description,
  article = false,
  image,
  noindex = false,
}: {
  /** Só o nome da página: o nome do app entra no fim sozinho. */
  title: string
  description?: string
  /** Post de blog: og:type vira "article". */
  article?: boolean
  /** URL ABSOLUTA de uma imagem própria; sem ela, vale o /og.png do site. */
  image?: string
  /** Páginas sem conteúdo para busca (login, conta): pede para não indexar. */
  noindex?: boolean
}) {
  const fullTitle =
    title === appConfig.name ? title : `${title} — ${appConfig.name}`
  return [
    { title: fullTitle },
    { property: 'og:title', content: fullTitle },
    { name: 'twitter:title', content: fullTitle },
    ...(description
      ? [
          { name: 'description', content: description },
          { property: 'og:description', content: description },
          { name: 'twitter:description', content: description },
        ]
      : []),
    ...(article ? [{ property: 'og:type', content: 'article' }] : []),
    ...(image
      ? [
          { property: 'og:image', content: image },
          { name: 'twitter:image', content: image },
        ]
      : []),
    ...(noindex ? [{ name: 'robots', content: 'noindex' }] : []),
  ]
}
