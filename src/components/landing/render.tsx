import { BentoBlock } from './blocks/bento'
import { CompareBlock } from './blocks/compare'
import {
  CtaBlock,
  FaqBlock,
  FeaturesBlock,
  HeroBlock,
  StackBlock,
  StepsBlock,
  TestimonialsBlock,
} from './blocks/core'
import { GalleryBlock } from './blocks/gallery'
import { LogosBlock } from './blocks/logos'
import { StatsBlock } from './blocks/stats'
import { TerminalBlock } from './blocks/terminal'
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
    case 'bento':
      return <BentoBlock block={block} />
    case 'compare':
      return <CompareBlock block={block} />
    case 'stats':
      return <StatsBlock block={block} />
    case 'logos':
      return <LogosBlock block={block} />
    case 'terminal':
      return <TerminalBlock block={block} />
    case 'gallery':
      return <GalleryBlock block={block} />
    default: {
      const exhaustive: never = block
      return exhaustive
    }
  }
}

/**
 * Cada bloco vai num invólucro sem caixa (`contents`) marcado com
 * `data-block="<tipo>"`: não muda o layout e deixa teste, e2e e DevTools
 * acharem um bloco pelo formato.
 */
export function LandingBlocks({ blocks }: { blocks: readonly LandingBlock[] }) {
  return (
    <div className="w-full">
      {blocks.map((block, i) => (
        <div
          // biome-ignore lint/suspicious/noArrayIndexKey: blocos estáticos da landing, sem reordenação; o mesmo tipo pode repetir
          key={`${block.type}-${i}`}
          data-block={block.type}
          className="contents"
        >
          {renderBlock(block)}
        </div>
      ))}
    </div>
  )
}
