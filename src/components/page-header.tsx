import { Link, type LinkProps } from '@tanstack/react-router'
import { ArrowRightIcon } from 'lucide-react'
import type { ReactNode } from 'react'

// Título das páginas da área logada: h1, uma linha de descrição e ações à
// direita. Escala de painel, não de landing: as páginas ocupam a largura toda.
export function PageHeader({
  title,
  description,
  actions,
}: {
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description ? (
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 items-center gap-2">{actions}</div>
      ) : null}
    </div>
  )
}

// Uma fileira de números lado a lado, separados por linhas finas. Um número
// por área; cada um é um link para a área a que se refere.
export function StatStrip({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-wrap divide-x divide-border overflow-hidden rounded-[var(--radius-card)] border">
      {children}
    </div>
  )
}

export function StatCard({
  label,
  value,
  to,
  cta,
}: {
  label: string
  value: ReactNode
  to: LinkProps['to']
  cta: string
}) {
  return (
    <Link
      to={to}
      className="group flex min-w-48 flex-1 flex-col px-5 py-4 text-foreground no-underline transition-colors hover:bg-surface"
    >
      <span className="kicker">{label}</span>
      <span className="mt-1.5 text-2xl font-semibold tracking-tight tabular-nums">
        {value}
      </span>
      <span className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-muted-foreground group-hover:text-foreground">
        {cta}
        <ArrowRightIcon className="size-3.5 transition-transform group-hover:translate-x-0.5" />
      </span>
    </Link>
  )
}
