import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

// O que aparece quando uma lista ainda não tem nada: um ícone discreto, uma
// frase dizendo o que vai aparecer ali e a ação que cria o primeiro item.
// Toda lista precisa de um: tela vazia sem explicação parece erro.
//
// O ícone vem do `lucide-react`, em cinza. A ação é um <Button> (a principal
// da tela usa `variant="brand"`).
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon?: LucideIcon
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-[var(--radius-card)] border border-dashed px-6 py-12 text-center">
      {Icon ? (
        <span className="flex size-10 items-center justify-center rounded-full bg-secondary text-muted-foreground">
          <Icon className="size-[18px]" strokeWidth={1.5} />
        </span>
      ) : null}
      <div className="grid gap-1">
        <p className="text-sm font-semibold">{title}</p>
        {description ? (
          <p className="mx-auto max-w-sm text-sm text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  )
}
