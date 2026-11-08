import type { ComponentType } from 'react'
import type { LandingIcon } from './icons'

/**
 * Os formatos de bloco que a landing aceita. Um tipo por formato,
 * discriminado em `type`. Para criar um formato novo: adicione um membro
 * aqui, um componente em `blocks/` e um `case` em `render.tsx`; o
 * TypeScript não deixa esquecer o terceiro, e o teste
 * `render.test.tsx` cobra um exemplo em `src/content/blocos-exemplo.ts`.
 *
 * Catálogo com um exemplo de cada formato: a página `/blocos`.
 */
export type LandingLink = { label: string; to: string }

export type { LandingIcon }

/**
 * Um nome na faixa de logos. Sem imagem externa: o nome em texto basta.
 * `svg` é opcional e aceita duas formas:
 *   - uma string com o `<svg>...</svg>` (use `fill="currentColor"` para
 *     herdar a cor do tema; nunca cole aqui texto que veio de usuário);
 *   - um componente React que recebe `className` (um ícone do lucide, ou o
 *     seu próprio logo como componente).
 */
export type LandingLogo = {
  name: string
  svg?: string | ComponentType<{ className?: string }>
}

/**
 * Uma linha do bloco `terminal`:
 *   'npm run dev'        texto puro é um comando (ganha o `$` na frente e é
 *                        "digitado" na animação)
 *   { out: '...' }       o que o comando respondeu, em cinza
 *   { ok: '...' }        uma resposta de sucesso, em verde
 */
export type TerminalLine = string | { out: string } | { ok: string }

export type LandingBlock =
  /** A primeira tela: a promessa, uma linha do que é e duas ações. */
  | {
      type: 'hero'
      kicker?: string
      title: string
      subtitle: string
      primary: LandingLink
      secondary?: LandingLink
      /** Uma linha pequena abaixo dos botões. */
      note?: string
    }
  /** Uma fileira de nomes (a stack) logo abaixo do hero. */
  | { type: 'stack'; label?: string; items: string[] }
  /** Cartões, três por linha. `path` é o arquivo onde a peça mora. */
  | {
      type: 'features'
      kicker: string
      title: string
      items: { title: string; body: string; path?: string }[]
    }
  /** Passos numerados, cada um com um bloco de comandos. */
  | {
      type: 'steps'
      kicker: string
      title: string
      steps: { title: string; body: string; lines: string[] }[]
    }
  /** Depoimentos. Sem foto: iniciais num círculo. */
  | {
      type: 'testimonials'
      kicker: string
      title: string
      items: { quote: string; name: string; role: string; initials: string }[]
    }
  /** Perguntas que abrem. */
  | {
      type: 'faq'
      kicker: string
      title: string
      items: { q: string; a: string }[]
    }
  /** A última coisa que a página diz, e a ação que vem junto. */
  | {
      type: 'cta'
      title: string
      primary: LandingLink
      secondary?: LandingLink
    }
  /**
   * Grade de cartões de tamanhos diferentes. No computador são 6 colunas:
   * `span` diz quantas o cartão ocupa (2, 3, 4 ou 6; padrão 2) e cada linha
   * deve somar 6. `featured` pinta o cartão no contraste do tema, para o
   * argumento principal. `icon` é um nome de `icons.ts`.
   */
  | {
      type: 'bento'
      kicker: string
      title: string
      lead?: string
      items: {
        title: string
        body: string
        span?: 2 | 3 | 4 | 6
        icon?: LandingIcon
        featured?: boolean
        path?: string
      }[]
    }
  /**
   * Duas colunas lado a lado: "antes / depois" ou "eles / nós". `before` é a
   * coluna da esquerda, sem destaque; `after` é a da direita, com a marca.
   * No celular uma fica embaixo da outra.
   */
  | {
      type: 'compare'
      kicker: string
      title: string
      lead?: string
      before: { label: string; items: string[] }
      after: { label: string; items: string[] }
    }
  /**
   * Faixa de números grandes, sem título. `value` é texto ('4', 'R$ 0',
   * '99%') para aceitar qualquer formato. Use número que dá para conferir.
   */
  | {
      type: 'stats'
      label?: string
      items: { value: string; label: string }[]
    }
  /**
   * Faixa de nomes (clientes, parceiros, tecnologias). Passe `items` para
   * uma fileira só, OU `groups` para separar por assunto. Cada nome é um
   * `LandingLogo`: texto, com SVG opcional.
   */
  | ({ type: 'logos'; label?: string } & (
      | { items: LandingLogo[]; groups?: never }
      | {
          groups: { title: string; items: LandingLogo[] }[]
          items?: never
        }
    ))
  /**
   * Uma janela de terminal com comandos e saídas. `label` é o texto
   * pequeno do topo (a pasta, por exemplo). Os comandos são "digitados"
   * quando o bloco aparece na tela; quem pediu menos movimento no sistema
   * (`prefers-reduced-motion`) vê tudo pronto. `animate: false` desliga.
   * `kicker` e `title` são opcionais: sem eles, só a janela.
   */
  | {
      type: 'terminal'
      kicker?: string
      title?: string
      lead?: string
      label?: string
      lines: TerminalLine[]
      animate?: boolean
    }
  /**
   * Grade de imagens com legenda. `src` é um caminho em `public/`
   * (`/galeria/painel.svg` = `public/galeria/painel.svg`); `width` e
   * `height` são o tamanho real do arquivo, para a página não pular enquanto
   * carrega. `alt` descreve a imagem para quem não vê. `wide` faz a imagem
   * ocupar duas colunas.
   */
  | {
      type: 'gallery'
      kicker: string
      title: string
      lead?: string
      items: {
        src: string
        alt: string
        width: number
        height: number
        caption?: string
        wide?: boolean
      }[]
    }

/** O membro de `LandingBlock` de um `type`: `BlockOf<'faq'>`. */
export type BlockOf<T extends LandingBlock['type']> = Extract<
  LandingBlock,
  { type: T }
>
