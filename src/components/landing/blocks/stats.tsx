import type { BlockOf } from '../types'

/**
 * Faixa de números, sem título. Quatro números leem em um segundo e dizem
 * mais que o parágrafo que substituem. Use só número que dá para conferir no
 * próprio produto: número inventado envelhece mal e ninguém defende.
 *
 * Linhas finas em cima e embaixo marcam a faixa sem pintar um fundo, então
 * ela cabe colada no hero.
 */
export function StatsBlock({ block }: { block: BlockOf<'stats'> }) {
  return (
    <section className="mx-auto w-full max-w-6xl px-5 py-10 sm:px-8 sm:py-14">
      {block.label ? (
        <p className="mb-6 text-center text-sm text-muted-foreground">
          {block.label}
        </p>
      ) : null}
      <dl className="grid grid-cols-2 gap-x-6 gap-y-10 border-y border-border py-10 lg:grid-cols-4">
        {block.items.map((item) => (
          <div key={item.label} className="flex flex-col gap-2">
            <dt className="order-2 max-w-56 text-sm leading-relaxed text-muted-foreground">
              {item.label}
            </dt>
            <dd className="font-display order-1 text-5xl leading-none tracking-[var(--tracking-display)] tabular-nums sm:text-6xl">
              {item.value}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
