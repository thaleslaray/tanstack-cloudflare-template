import { MoonIcon, SunIcon } from 'lucide-react'
import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'

/**
 * Um botão, um trabalho: clicar alterna claro ↔ escuro. A escolha é lida de
 * `resolvedTheme`, então o primeiro clique saindo de "sistema" vai para o
 * oposto do que o visitante está vendo. `resolvedTheme` é indefinido até o
 * next-themes ler o localStorage (e o servidor não o conhece), por isso o
 * botão segura um espaço fixo até montar: o cabeçalho não pula.
 */
export default function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const isDark = resolvedTheme === 'dark'
  const label = isDark ? 'Mudar para o modo claro' : 'Mudar para o modo escuro'

  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      className="inline-flex size-9 items-center justify-center rounded-[var(--radius-btn)] text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none"
    >
      {mounted ? (
        isDark ? (
          <SunIcon className="size-4" aria-hidden="true" />
        ) : (
          <MoonIcon className="size-4" aria-hidden="true" />
        )
      ) : (
        <span className="size-4" />
      )}
    </button>
  )
}
