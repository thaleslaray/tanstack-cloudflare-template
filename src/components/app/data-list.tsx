import type { ReactNode } from 'react'

// As duas molduras de uma tela de lista.
//
// <Toolbar>: a faixa acima da lista. À esquerda, busca e filtros; à direita,
// as ações (a principal com <Button variant="brand">). No celular vira uma
// coluna: filtros em cima, ações embaixo. Abas que não cabem em 375px de
// largura ganham `className="max-w-full overflow-x-auto"` na <TabsList>.
export function Toolbar({
  children,
  actions,
}: {
  children?: ReactNode
  actions?: ReactNode
}) {
  return (
    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        {children}
      </div>
      {actions ? (
        <div className="flex shrink-0 items-center gap-2">{actions}</div>
      ) : null}
    </div>
  )
}

// <TableFrame>: a borda arredondada em volta de uma <Table> de
// `#/components/ui/table`. A tabela rola de lado dentro dela no celular, em
// vez de empurrar a página.
export function TableFrame({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-[var(--radius-card)] border">
      {children}
    </div>
  )
}
