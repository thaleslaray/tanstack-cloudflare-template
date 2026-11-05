import { createFileRoute, Link, notFound } from '@tanstack/react-router'
import { ArrowLeftIcon, ArrowRightIcon } from 'lucide-react'
import { MDXContent } from '#/lib/content/mdx-content'
import { docs } from '#/lib/content/collections'
import { appConfig } from '#/config/app'
import { cn } from '#/lib/utils'

export const Route = createFileRoute('/docs/$slug')({
  loader: async ({ params }) => {
    const doc = docs.find((d) => d.slug === params.slug)
    if (!doc) throw notFound()
    const { headings = [] } = await doc.load()
    return { title: doc.title, description: doc.description, headings }
  },
  head: ({ loaderData }) => ({
    meta: loaderData
      ? [
          { title: `${loaderData.title} — Docs — ${appConfig.name}` },
          { name: 'description', content: loaderData.description },
        ]
      : [],
  }),
  component: DocPage,
})

// Docs na largura do site: lista de páginas à esquerda (fixa no desktop, fila
// de pílulas no celular), a página no meio, anterior/próximo embaixo e, em
// tela larga, os títulos da própria página à direita.
function DocPage() {
  const { slug } = Route.useParams()
  const { headings } = Route.useLoaderData()
  const index = docs.findIndex((d) => d.slug === slug)
  const doc = docs[index]
  if (!doc) return null
  const prev = docs[index - 1]
  const next = docs[index + 1]

  return (
    <div className="mx-auto grid w-full max-w-7xl grid-cols-1 gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[14rem_minmax(0,1fr)] lg:gap-16 lg:py-16 xl:grid-cols-[14rem_minmax(0,1fr)_12rem]">
      <aside>
        <nav
          aria-label="Documentação"
          className="lg:sticky lg:top-24 lg:max-h-[calc(100vh-8rem)] lg:overflow-y-auto"
        >
          <p className="kicker mb-3 hidden lg:block">Documentação</p>
          <ul className="-mx-4 flex gap-2 overflow-x-auto px-4 sm:-mx-6 sm:px-6 lg:mx-0 lg:flex-col lg:gap-0.5 lg:overflow-visible lg:px-0">
            {docs.map((d) => (
              <li key={d.slug} className="shrink-0">
                <Link
                  to="/docs/$slug"
                  params={{ slug: d.slug }}
                  aria-current={d.slug === slug ? 'page' : undefined}
                  className={cn(
                    'block rounded-[var(--radius-btn)] px-4 py-2 text-sm whitespace-nowrap no-underline transition-colors lg:rounded-lg lg:px-3 lg:py-1.5 lg:whitespace-normal',
                    d.slug === slug
                      ? 'bg-secondary font-medium text-foreground'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {d.title}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </aside>

      <article className="min-w-0 max-w-3xl">
        <header className="flex flex-col gap-3">
          <h1 className="font-display text-3xl leading-tight tracking-[var(--tracking-display)] sm:text-4xl">
            {doc.title}
          </h1>
          <p className="text-lg leading-relaxed text-muted-foreground">
            {doc.description}
          </p>
        </header>
        <div className="mt-10">
          <MDXContent load={doc.load} />
        </div>

        {prev || next ? (
          <nav
            aria-label="Páginas vizinhas"
            className="mt-16 grid grid-cols-1 gap-3 sm:grid-cols-2"
          >
            {prev ? (
              <PageLink slug={prev.slug} title={prev.title} dir="prev" />
            ) : (
              <span className="hidden sm:block" />
            )}
            {next ? (
              <PageLink slug={next.slug} title={next.title} dir="next" />
            ) : null}
          </nav>
        ) : null}
      </article>

      <aside className="hidden xl:block">
        {headings.length > 0 ? (
          <div className="sticky top-24 max-h-[calc(100vh-8rem)] overflow-y-auto">
            <p className="kicker mb-3">Nesta página</p>
            <ul className="flex flex-col gap-1.5 border-l border-border">
              {headings.map((h) => (
                <li key={h.id}>
                  <a
                    href={`#${h.id}`}
                    className={cn(
                      'block text-sm leading-snug text-muted-foreground no-underline transition-colors hover:text-foreground',
                      h.depth === 3 ? 'pl-7' : 'pl-4',
                    )}
                  >
                    {h.text}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </aside>
    </div>
  )
}

function PageLink({
  slug,
  title,
  dir,
}: {
  slug: string
  title: string
  dir: 'prev' | 'next'
}) {
  const label = dir === 'prev' ? 'Anterior' : 'Próximo'
  return (
    <Link
      to="/docs/$slug"
      params={{ slug }}
      aria-label={`${label}: ${title}`}
      className={cn(
        'flex flex-col gap-1 rounded-[var(--radius-card)] bg-secondary px-5 py-4 no-underline transition-colors hover:bg-surface',
        dir === 'next' && 'sm:items-end sm:text-right',
      )}
    >
      <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
        {dir === 'prev' ? <ArrowLeftIcon className="size-4" /> : null}
        {label}
        {dir === 'next' ? <ArrowRightIcon className="size-4" /> : null}
      </span>
      <span className="font-medium text-foreground">{title}</span>
    </Link>
  )
}
