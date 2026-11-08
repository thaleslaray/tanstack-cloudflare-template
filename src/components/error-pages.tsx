import { Link } from '@tanstack/react-router'

const primaryBtn =
  'inline-flex h-12 items-center justify-center rounded-[var(--radius-btn)] bg-brand px-6 text-sm font-semibold text-brand-foreground shadow-[var(--shadow-btn)] transition-colors hover:bg-brand-hover'

function Shell({
  kicker,
  title,
  children,
}: {
  kicker: string
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col items-center gap-6 px-5 py-28 text-center sm:px-8 sm:py-40">
      <p className="kicker">{kicker}</p>
      <h1 className="font-display text-4xl leading-[1.02] tracking-[var(--tracking-display)] sm:text-6xl">
        {title}
      </h1>
      {children}
    </section>
  )
}

export function NotFoundPage() {
  return (
    <Shell kicker="Erro 404" title="Página não encontrada">
      <p className="max-w-xl text-lg leading-relaxed text-muted-foreground">
        O endereço que você abriu não existe ou foi movido.
      </p>
      <Link to="/" className={primaryBtn}>
        Voltar para o início
      </Link>
    </Shell>
  )
}

export function ErrorPage({ error }: { error: unknown }) {
  const message = error instanceof Error ? error.message : String(error)
  return (
    <Shell kicker="Algo deu errado" title="Não conseguimos abrir esta página">
      <p className="max-w-xl text-lg leading-relaxed text-muted-foreground">
        Houve um erro inesperado. Tente de novo; se continuar, volte ao início.
      </p>
      {import.meta.env.DEV ? (
        <pre className="max-w-full overflow-x-auto rounded-[var(--radius-card)] bg-surface p-4 text-left text-sm">
          {message}
        </pre>
      ) : null}
      <div className="flex flex-wrap justify-center gap-3">
        <button
          type="button"
          onClick={() => window.location.reload()}
          className={primaryBtn}
        >
          Tentar de novo
        </button>
        <a
          href="/"
          className="inline-flex h-12 items-center justify-center rounded-[var(--radius-btn)] border border-border bg-background px-6 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
        >
          Ir para o início
        </a>
      </div>
    </Shell>
  )
}
