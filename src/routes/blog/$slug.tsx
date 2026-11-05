import { createFileRoute, Link, notFound } from '@tanstack/react-router'
import { ArrowLeftIcon } from 'lucide-react'
import { appConfig } from '#/config/app'
import { formatDate, posts } from '#/lib/content/collections'
import { MDXContent } from '#/lib/content/mdx-content'

export const Route = createFileRoute('/blog/$slug')({
  loader: async ({ params }) => {
    const post = posts.find((p) => p.slug === params.slug)
    if (!post) throw notFound()
    // O corpo é um chunk próprio: busca junto com os dados, para a página
    // renderizar de uma vez.
    await post.load()
    return { title: post.title, description: post.description }
  },
  head: ({ loaderData }) => ({
    meta: loaderData
      ? [
          { title: `${loaderData.title} — ${appConfig.name}` },
          { name: 'description', content: loaderData.description },
          { property: 'og:title', content: loaderData.title },
          { property: 'og:description', content: loaderData.description },
          { property: 'og:type', content: 'article' },
        ]
      : [],
  }),
  component: PostPage,
})

function PostPage() {
  const { slug } = Route.useParams()
  const post = posts.find((p) => p.slug === slug)
  if (!post) return null
  const others = posts.filter((p) => p.slug !== slug).slice(0, 3)

  return (
    <div className="mx-auto w-full max-w-3xl px-5 py-16 sm:px-8 sm:py-24">
      <Link
        to="/blog"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground no-underline transition-colors hover:text-foreground"
      >
        <ArrowLeftIcon className="size-4" />
        Voltar para o blog
      </Link>
      <article className="mt-8">
        <header className="flex flex-col gap-4">
          <time dateTime={post.date} className="kicker">
            {formatDate(post.date)}
          </time>
          <h1 className="font-display text-4xl leading-[1.05] tracking-[var(--tracking-display)] sm:text-5xl">
            {post.title}
          </h1>
          <p className="text-lg leading-relaxed text-muted-foreground">
            {post.description}
          </p>
        </header>
        <div className="mt-10">
          <MDXContent load={post.load} />
        </div>
      </article>

      {others.length > 0 ? (
        <aside className="mt-20 border-t border-border pt-10">
          <p className="kicker">Mais posts</p>
          <ul className="mt-5 flex flex-col gap-3">
            {others.map((o) => (
              <li key={o.slug}>
                <Link
                  to="/blog/$slug"
                  params={{ slug: o.slug }}
                  className="flex flex-col gap-1 rounded-[var(--radius-card)] bg-secondary px-5 py-4 no-underline transition-colors hover:bg-surface"
                >
                  <span className="text-sm text-muted-foreground">
                    {formatDate(o.date)}
                  </span>
                  <span className="font-medium text-foreground">{o.title}</span>
                </Link>
              </li>
            ))}
          </ul>
        </aside>
      ) : null}
    </div>
  )
}
