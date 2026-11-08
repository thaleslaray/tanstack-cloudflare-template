import { createFileRoute, Link } from '@tanstack/react-router'
import { formatDate, posts } from '#/lib/content/collections'
import { seo } from '#/lib/seo'

export const Route = createFileRoute('/blog/')({
  head: () => ({
    meta: seo({
      title: 'Blog',
      description:
        'Textos curtos sobre Cloudflare, bancos de dados e como este template funciona.',
    }),
  }),
  component: BlogIndex,
})

function BlogIndex() {
  return (
    <section className="mx-auto w-full max-w-6xl px-5 py-20 sm:px-8 sm:py-28">
      <div className="flex flex-col gap-4">
        <p className="kicker">Blog</p>
        <h1 className="font-display max-w-3xl text-4xl leading-[1.02] tracking-[var(--tracking-display)] sm:text-5xl">
          Aprenda um passo de cada vez
        </h1>
        <p className="max-w-2xl text-lg leading-relaxed text-muted-foreground">
          Textos curtos sobre Cloudflare, bancos de dados e as escolhas por trás
          deste template.
        </p>
      </div>
      <ul className="mt-12 grid gap-4 sm:grid-cols-2">
        {posts.map((post) => (
          <li key={post.slug}>
            <Link
              to="/blog/$slug"
              params={{ slug: post.slug }}
              className="flex h-full flex-col gap-3 rounded-[var(--radius-card)] border border-border bg-card p-6 text-card-foreground no-underline shadow-[var(--shadow-card)] transition-colors hover:bg-surface"
            >
              <time dateTime={post.date} className="kicker">
                {formatDate(post.date)}
              </time>
              <h2 className="font-display text-2xl leading-tight tracking-[var(--tracking-display)]">
                {post.title}
              </h2>
              <p className="leading-relaxed text-muted-foreground">
                {post.description}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
