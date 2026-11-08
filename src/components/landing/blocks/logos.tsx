import type { BlockOf, LandingLogo } from '../types'

/** O desenho de um nome: o SVG (string ou componente), se houver. */
function Mark({ svg }: { svg: LandingLogo['svg'] }) {
  if (!svg) return null
  if (typeof svg === 'string') {
    return (
      <span
        aria-hidden
        className="flex size-5 shrink-0 items-center [&>svg]:size-full"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: SVG escrito por quem mantém o site, nos arquivos de dados; nunca texto vindo de usuário ou do banco
        dangerouslySetInnerHTML={{ __html: svg }}
      />
    )
  }
  const Svg = svg
  return <Svg aria-hidden className="size-5 shrink-0" />
}

function Name({ item }: { item: LandingLogo }) {
  return (
    <li className="flex items-center gap-2.5 whitespace-nowrap text-base font-semibold text-muted-foreground">
      <Mark svg={item.svg} />
      {item.name}
    </li>
  )
}

/**
 * Faixa de nomes, parada e centralizada. Não rola sozinha de propósito: uma
 * lista fixa de dez nomes rolando parece infinita, e quem não espera não vê
 * o resto. Tudo em `text-muted-foreground`, inclusive os SVGs com
 * `currentColor`, para a faixa não brigar com o título de ninguém.
 *
 * Com `groups`, cada grupo ganha um título curto e os nomes vão embaixo, em
 * até três colunas.
 */
export function LogosBlock({ block }: { block: BlockOf<'logos'> }) {
  return (
    <section className="mx-auto flex w-full max-w-6xl flex-col items-center gap-8 px-5 py-14 sm:px-8 sm:py-20">
      {block.label ? (
        <p className="text-center text-sm text-muted-foreground">
          {block.label}
        </p>
      ) : null}
      {block.groups ? (
        <div className="grid w-full grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
          {block.groups.map((group) => (
            <div
              key={group.title}
              className="flex flex-col gap-4 border-t border-border pt-5"
            >
              <h3 className="text-sm font-semibold text-foreground">
                {group.title}
              </h3>
              <ul className="flex flex-wrap gap-x-6 gap-y-3">
                {group.items.map((item) => (
                  <Name key={item.name} item={item} />
                ))}
              </ul>
            </div>
          ))}
        </div>
      ) : (
        <ul className="flex flex-wrap items-center justify-center gap-x-10 gap-y-5">
          {block.items.map((item) => (
            <Name key={item.name} item={item} />
          ))}
        </ul>
      )}
    </section>
  )
}
