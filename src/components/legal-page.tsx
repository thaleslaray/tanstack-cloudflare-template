import { formatDate, type legal } from '#/lib/content/collections'
import { MDXContent } from '#/lib/content/mdx-content'

type LegalEntry = (typeof legal)[number]

/** Artigo simples das páginas legais (termos e privacidade). */
export function LegalPage({ entry }: { entry: LegalEntry }) {
  return (
    <article className="mx-auto w-full max-w-3xl px-5 py-16 sm:px-8 sm:py-24">
      <header className="flex flex-col gap-4">
        <p className="kicker">Atualizado em {formatDate(entry.updated)}</p>
        <h1 className="font-display text-4xl leading-[1.05] tracking-[var(--tracking-display)] sm:text-5xl">
          {entry.title}
        </h1>
      </header>
      <div className="mt-10">
        <MDXContent load={entry.load} />
      </div>
    </article>
  )
}
