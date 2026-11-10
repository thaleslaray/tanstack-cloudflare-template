import type { ReactNode } from 'react'
import { Label } from '#/components/ui/label'

// Um campo de formulário: rótulo em cima, o controle, e uma linha de ajuda
// ou de erro embaixo. O erro substitui a ajuda e é anunciado por leitores de
// tela (`role="alert"`).
//
// Passe o mesmo `id` para o controle (`<Input id="nome" />`) e, quando houver
// erro, `aria-invalid` no controle: a borda vermelha vem do próprio <Input>.
// A mensagem de erro leva um ponto vermelho ao lado; o texto continua neutro
// (src/CLAUDE.md, regra 1).
export function Field({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string
  label: string
  hint?: string
  error?: string
  children: ReactNode
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error ? (
        <p role="alert" className="flex items-center gap-2 text-sm">
          <span
            aria-hidden="true"
            className="size-1.5 shrink-0 rounded-full bg-destructive"
          />
          {error}
        </p>
      ) : hint ? (
        <p className="text-sm text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  )
}
