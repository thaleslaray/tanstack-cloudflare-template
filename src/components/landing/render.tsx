import {
  CtaBlock,
  FaqBlock,
  FeaturesBlock,
  HeroBlock,
  StackBlock,
  StepsBlock,
  TestimonialsBlock,
} from './blocks'
import type { LandingBlock } from './types'

/**
 * O renderizador: uma página é uma lista de blocos e isto vira markup. O
 * `switch` é exaustivo de propósito: um formato novo sem `case` aqui falha no
 * typecheck em vez de renderizar nada.
 */
function renderBlock(block: LandingBlock) {
  switch (block.type) {
    case 'hero':
      return <HeroBlock block={block} />
    case 'stack':
      return <StackBlock block={block} />
    case 'features':
      return <FeaturesBlock block={block} />
    case 'steps':
      return <StepsBlock block={block} />
    case 'testimonials':
      return <TestimonialsBlock block={block} />
    case 'faq':
      return <FaqBlock block={block} />
    case 'cta':
      return <CtaBlock block={block} />
    default: {
      const exhaustive: never = block
      return exhaustive
    }
  }
}

export function LandingBlocks({ blocks }: { blocks: readonly LandingBlock[] }) {
  return (
    <div className="w-full">
      {blocks.map((block, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: blocos estáticos da landing, sem reordenação; o mesmo tipo pode repetir
        <div key={`${block.type}-${i}`} className="contents">
          {renderBlock(block)}
        </div>
      ))}
    </div>
  )
}
