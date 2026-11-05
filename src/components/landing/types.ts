/**
 * Os formatos de bloco que a landing aceita. Um tipo por formato,
 * discriminado em `type`. Para criar um formato novo: adicione um membro
 * aqui, um componente em `blocks.tsx` e um `case` em `render.tsx`; o
 * TypeScript não deixa esquecer o terceiro.
 */
export type LandingLink = { label: string; to: string }

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
