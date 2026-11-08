import { createFileRoute } from '@tanstack/react-router'
import { LandingBlocks } from '#/components/landing/render'
import { blocosCatalogo } from '#/content/blocos-exemplo'
import { seo } from '#/lib/seo'

// O catálogo: um exemplo de cada formato de bloco da landing, com dados de
// mentira (src/content/blocos-exemplo.ts). Serve para ver os 13 formatos no
// tema atual e copiar o objeto que quiser para src/content/landing.ts.
//
// É bancada, não página de produto: `noindex`, bloqueada no robots.txt
// (ROBOTS_DISALLOW em src/config/public-paths.ts) e fora da lista de
// pré-renderização, então nunca vira HTML estático nem entra no sitemap.
export const Route = createFileRoute('/blocos')({
  head: () => ({
    meta: seo({
      title: 'Catálogo de blocos',
      description: 'Um exemplo de cada formato de bloco da landing.',
      noindex: true,
    }),
  }),
  component: Catalogo,
})

function Catalogo() {
  return (
    <div className="w-full pb-16">
      <header className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-5 pt-16 sm:px-8 sm:pt-24">
        <p className="kicker">Catálogo</p>
        <h1 className="font-display max-w-3xl text-4xl leading-[1.02] tracking-[var(--tracking-display)] sm:text-6xl">
          Os {blocosCatalogo.length} blocos da landing.
        </h1>
        <p className="max-w-2xl text-lg leading-relaxed text-muted-foreground">
          Cada bloco abaixo é um objeto em{' '}
          <code>src/content/blocos-exemplo.ts</code>. Gostou de um? Copie o
          objeto para a lista em <code>src/content/landing.ts</code> e troque o
          texto. Troque o tema no topo da página para ver como cada um fica.
        </p>
        <nav aria-label="Formatos">
          <ul className="flex flex-wrap gap-2">
            {blocosCatalogo.map(({ type }) => (
              <li key={type}>
                <a
                  href={`#bloco-${type}`}
                  className="inline-block rounded-[var(--radius-btn)] border border-border bg-surface px-3 py-1 font-mono text-sm text-foreground transition-colors hover:bg-secondary"
                >
                  {type}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </header>

      {blocosCatalogo.map(({ type, descricao, exemplo }) => (
        <section
          key={type}
          id={`bloco-${type}`}
          aria-label={`Bloco ${type}`}
          className="scroll-mt-20"
        >
          <div className="mx-auto mt-16 w-full max-w-6xl px-5 sm:px-8">
            <div className="flex flex-col gap-2 border-t border-border pt-4 sm:flex-row sm:items-baseline sm:gap-4">
              <code className="w-fit rounded-md bg-secondary px-2 py-1 font-mono text-sm font-semibold">
                {type}
              </code>
              <p className="text-sm text-muted-foreground">{descricao}</p>
            </div>
          </div>
          <LandingBlocks blocks={[exemplo]} />
        </section>
      ))}
    </div>
  )
}
