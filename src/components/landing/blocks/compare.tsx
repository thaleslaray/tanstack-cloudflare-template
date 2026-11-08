import { CheckIcon, XIcon } from 'lucide-react'
import { Section, SectionHead } from '../section'
import type { BlockOf } from '../types'

/**
 * Duas colunas: o jeito antigo à esquerda, apagado; o seu à direita, com a
 * marca. O contraste fica na moldura e no marcador de cada linha, não no
 * texto: as duas colunas continuam fáceis de ler.
 *
 * O marcador é um círculo `bg-brand` com o ícone em `text-brand-foreground`,
 * e não um ícone na cor da marca solto no fundo: no tema brutal a marca é
 * amarela, e amarelo sobre branco some.
 */
export function CompareBlock({ block }: { block: BlockOf<'compare'> }) {
  return (
    <Section>
      <SectionHead
        kicker={block.kicker}
        title={block.title}
        lead={block.lead}
      />
      <div className="mt-12 grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-5 rounded-[var(--radius-card)] border border-border bg-surface p-6 sm:p-8">
          <h3 className="text-base font-semibold text-muted-foreground">
            {block.before.label}
          </h3>
          <ul className="flex flex-col gap-3.5">
            {block.before.items.map((text) => (
              <li
                key={text}
                className="flex gap-3 text-sm leading-relaxed text-muted-foreground"
              >
                <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-secondary">
                  <XIcon aria-hidden className="size-3" />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>
        <div className="flex flex-col gap-5 rounded-[var(--radius-card)] border-2 border-brand bg-card p-6 shadow-[var(--shadow-card)] sm:p-8">
          <h3 className="text-base font-bold">{block.after.label}</h3>
          <ul className="flex flex-col gap-3.5">
            {block.after.items.map((text) => (
              <li key={text} className="flex gap-3 text-sm leading-relaxed">
                <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-brand text-brand-foreground">
                  <CheckIcon aria-hidden className="size-3" strokeWidth={3} />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Section>
  )
}
