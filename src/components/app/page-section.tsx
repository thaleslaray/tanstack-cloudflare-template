import type { ReactNode } from 'react'

// Bloco de conteúdo das páginas da área logada: título e apoio à esquerda,
// o conteúdo à direita, uma linha fina em cima. Sem cartão em volta: a
// separação vem da linha e do espaço (src/CLAUDE.md, regra 4).
//
// Use um por assunto ("Perfil", "Acesso", "Seus dados"). No celular as duas
// colunas empilham sozinhas.
export function PageSection({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: ReactNode
}) {
  return (
    <section className="grid gap-4 border-t py-6 md:grid-cols-[16rem_1fr] md:gap-10">
      <div>
        <h2 className="text-sm font-semibold">{title}</h2>
        {description ? (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      <div className="grid max-w-xl gap-6">{children}</div>
    </section>
  )
}
