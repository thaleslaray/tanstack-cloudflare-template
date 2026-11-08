import { landingIcons } from '../icons'
import { Section, SectionHead } from '../section'
import type { BlockOf } from '../types'

// O Tailwind só gera a classe que aparece INTEIRA no código, então o tamanho
// vira uma tabela, e não `lg:col-span-${span}`. No tablet (2 colunas), cartão
// de 4 ou 6 ocupa a linha toda.
const SPAN = {
  2: 'lg:col-span-2',
  3: 'lg:col-span-3',
  4: 'sm:col-span-2 lg:col-span-4',
  6: 'sm:col-span-2 lg:col-span-6',
} as const

/**
 * Grade irregular de cartões. A irregularidade é o ponto: seis cartões
 * iguais leem como lista e o olho pula; o cartão largo (ou o `featured`)
 * diz onde começar.
 */
export function BentoBlock({ block }: { block: BlockOf<'bento'> }) {
  return (
    <Section>
      <SectionHead
        kicker={block.kicker}
        title={block.title}
        lead={block.lead}
      />
      <ul className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-6">
        {block.items.map((item) => {
          const Icon = item.icon ? landingIcons[item.icon] : null
          return (
            <li
              key={item.title}
              className={`${SPAN[item.span ?? 2]} flex flex-col gap-3 lg:min-h-48 rounded-[var(--radius-card)] border p-6 shadow-[var(--shadow-card)] ${
                item.featured
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-card text-card-foreground'
              }`}
            >
              {Icon ? (
                <span
                  className={`flex size-10 items-center justify-center rounded-[var(--radius)] ${
                    item.featured
                      ? 'bg-brand text-brand-foreground'
                      : 'bg-secondary text-foreground'
                  }`}
                >
                  <Icon aria-hidden className="size-5" />
                </span>
              ) : null}
              <h3 className="text-lg font-semibold tracking-tight">
                {item.title}
              </h3>
              <p
                className={`max-w-xl text-sm leading-relaxed ${
                  item.featured
                    ? 'text-primary-foreground/75'
                    : 'text-muted-foreground'
                }`}
              >
                {item.body}
              </p>
              {item.path ? (
                <code
                  className={`mt-auto w-fit rounded-md px-2 py-1 font-mono text-xs ${
                    item.featured
                      ? 'bg-primary-foreground/10 text-primary-foreground/75'
                      : 'bg-secondary text-muted-foreground'
                  }`}
                >
                  {item.path}
                </code>
              ) : null}
            </li>
          )
        })}
      </ul>
    </Section>
  )
}
