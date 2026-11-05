import { CheckIcon, PaletteIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useThemeStyle } from '#/components/theme-provider'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '#/components/ui/dropdown-menu'
import { type ThemeDef, themes } from '#/config/themes'

/**
 * Escolhe o VISUAL (qual dos quatro temas). O `ThemeToggle` ao lado escolhe
 * claro/escuro: são duas escolhas independentes (veja theme-provider.tsx).
 *
 * As cores da amostra vêm do registro como literais, nunca dos tokens vivos:
 * a linha precisa mostrar o tema para o qual vai trocar, e os tokens desse
 * tema não estão no documento.
 */
function Swatch({ theme }: { theme: ThemeDef }) {
  const [ground, brand, ink] = theme.swatch
  return (
    <span
      aria-hidden="true"
      className="inline-flex size-4 shrink-0 overflow-hidden rounded-full border border-border"
    >
      <span className="h-full w-1/3" style={{ background: ground }} />
      <span className="h-full w-1/3" style={{ background: brand }} />
      <span className="h-full w-1/3" style={{ background: ink }} />
    </span>
  )
}

export default function ThemePicker() {
  const { theme, setTheme } = useThemeStyle()
  // O tema aplicado só é conhecido depois que o provider lê o documento;
  // renderizar um check diferente no servidor e no cliente quebra a hidratação.
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger
        aria-label="Escolher visual"
        title="Escolher visual"
        className="inline-flex size-9 items-center justify-center rounded-[var(--radius-btn)] text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none"
      >
        <PaletteIcon className="size-4" aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-60">
        {themes.map((t) => (
          <DropdownMenuItem
            key={t.id}
            onSelect={() => setTheme(t.id)}
            className="gap-3"
          >
            <Swatch theme={t} />
            <span className="flex min-w-0 flex-col">
              <span className="text-sm">{t.label}</span>
              <span className="text-xs text-muted-foreground">{t.hint}</span>
            </span>
            {mounted && t.id === theme ? (
              <CheckIcon className="ml-auto size-4" aria-hidden="true" />
            ) : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
