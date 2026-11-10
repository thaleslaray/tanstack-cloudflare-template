import type { ReactNode } from 'react'

// Estado de um item ("Ativo", "Pendente", "Falhou"). A cor vai numa bolinha
// preenchida; o texto fica neutro, porque texto nunca tem cor
// (src/CLAUDE.md, regra 1). Cor sozinha também não basta para quem não a
// distingue: o rótulo sempre acompanha.
const TONES = {
  neutral: 'bg-muted-foreground',
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-destructive',
} as const

export type StatusTone = keyof typeof TONES

export function StatusDot({
  tone = 'neutral',
  children,
}: {
  tone?: StatusTone
  children: ReactNode
}) {
  return (
    <span className="inline-flex items-center gap-2 text-sm whitespace-nowrap">
      <span
        aria-hidden="true"
        className={`size-2 shrink-0 rounded-full ${TONES[tone]}`}
      />
      {children}
    </span>
  )
}
