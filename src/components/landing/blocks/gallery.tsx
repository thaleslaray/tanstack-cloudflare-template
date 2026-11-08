import { Section, SectionHead } from '../section'
import type { BlockOf } from '../types'

/**
 * Grade de imagens com legenda. As imagens moram em `public/` e são servidas
 * como arquivo estático. `loading="lazy"` só baixa a imagem quando ela chega
 * perto da tela; `width`/`height` reservam o espaço antes, para o texto não
 * pular. Lista vazia não desenha nada (melhor que uma grade de mentira).
 */
export function GalleryBlock({ block }: { block: BlockOf<'gallery'> }) {
  if (block.items.length === 0) return null
  return (
    <Section>
      <SectionHead
        kicker={block.kicker}
        title={block.title}
        lead={block.lead}
      />
      <ul className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {block.items.map((item) => (
          <li key={item.src} className={item.wide ? 'sm:col-span-2' : ''}>
            <figure className="flex flex-col gap-3">
              <img
                src={item.src}
                alt={item.alt}
                width={item.width}
                height={item.height}
                loading="lazy"
                decoding="async"
                className="h-auto w-full rounded-[var(--radius-card)] border border-border bg-surface object-cover shadow-[var(--shadow-card)]"
              />
              {item.caption ? (
                <figcaption className="text-sm leading-relaxed text-muted-foreground">
                  {item.caption}
                </figcaption>
              ) : null}
            </figure>
          </li>
        ))}
      </ul>
    </Section>
  )
}
