// As peças que todo bloco da landing usa: a moldura da seção, o cabeçalho
// (etiqueta + título + linha de apoio) e os dois estilos de botão. Ficam num
// arquivo só para que um bloco novo herde o mesmo ritmo sem copiar classe.

// Os destinos vêm de dados (strings), então os links são <a> comuns: o
// `Link` tipado do TanStack só aceita rotas conhecidas em tempo de compilação.

/**
 * A moldura de toda seção: uma largura máxima, um ritmo vertical. `tone`
 * escolhe o chão: `plain` é o fundo da página; `sheet` deita uma folha
 * `--surface` arredondada sob a seção. Alternar os dois dá ritmo a uma
 * página longa sem precisar de imagem.
 */
export function Section({
  tone = 'plain',
  id,
  children,
}: {
  tone?: 'plain' | 'sheet'
  id?: string
  children: React.ReactNode
}) {
  if (tone === 'sheet') {
    return (
      <section id={id} className="w-full px-4 py-4 sm:px-6">
        <div className="mx-auto w-full max-w-6xl rounded-[var(--radius-card)] bg-surface px-6 py-14 sm:px-12 sm:py-20">
          {children}
        </div>
      </section>
    )
  }
  return (
    <section
      id={id}
      className="mx-auto w-full max-w-6xl px-5 py-20 sm:px-8 sm:py-28"
    >
      {children}
    </section>
  )
}

/**
 * Etiqueta + título, o mesmo ritmo em toda seção com cabeçalho. `lead` é uma
 * linha de apoio opcional, em cinza, abaixo do título.
 */
export function SectionHead({
  kicker,
  title,
  lead,
  align = 'start',
}: {
  kicker: string
  title: string
  lead?: string
  align?: 'start' | 'center'
}) {
  return (
    <div
      className={`flex flex-col gap-4 ${align === 'center' ? 'items-center text-center' : ''}`}
    >
      <p className="kicker">{kicker}</p>
      <h2 className="font-display max-w-3xl text-4xl leading-[1.02] tracking-[var(--tracking-display)] sm:text-5xl">
        {title}
      </h2>
      {lead ? (
        <p className="max-w-2xl text-lg leading-relaxed text-muted-foreground">
          {lead}
        </p>
      ) : null}
    </div>
  )
}

// Botões do hero e das seções: 48px de altura, pílula pelo token, hover só
// muda a cor (nada sobe nem cresce), foco visível para teclado.
export const primaryBtn =
  'inline-flex h-12 items-center justify-center rounded-[var(--radius-btn)] bg-brand px-6 text-sm font-semibold text-brand-foreground shadow-[var(--shadow-btn)] transition-colors hover:bg-brand-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring'
export const secondaryBtn =
  'inline-flex h-12 items-center justify-center rounded-[var(--radius-btn)] border border-border bg-background px-6 text-sm font-medium text-foreground transition-colors hover:bg-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring'
