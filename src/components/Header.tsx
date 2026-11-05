import { Link } from '@tanstack/react-router'
import { MenuIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Logo } from '#/components/logo'
import ThemeToggle from '#/components/ThemeToggle'
import ThemePicker from '#/components/theme-picker'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '#/components/ui/dropdown-menu'
import { appConfig } from '#/config/app'
import BetterAuthHeader from '#/integrations/better-auth/header-user'

// Os links públicos do site. `/docs`, `/blog`, `/termos` e `/privacidade`
// são rotas de conteúdo (MDX); as demos mostram cada peça da stack.
const NAV = [
  { href: '/docs', label: 'Docs' },
  { href: '/blog', label: 'Blog' },
] as const

const DEMOS = [
  { href: '/demo/drizzle', label: 'Banco (D1 + Drizzle)' },
  { href: '/demo/r2', label: 'Arquivos (R2)' },
  { href: '/demo/durable-object', label: 'Durable Object' },
  { href: '/demo/tanstack-query', label: 'TanStack Query' },
] as const

const navLink =
  'rounded-[var(--radius-btn)] px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground'

function useScrolled() {
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])
  return scrolled
}

export default function Header() {
  const scrolled = useScrolled()
  return (
    // Fixo, não sticky: um elemento sticky acompanha o "rubber band" do
    // trackpad; fixo fica parado enquanto a página balança embaixo. O <main>
    // compensa a altura com padding-top (veja __root.tsx).
    // A linha de baixo só aparece depois de rolar: no topo, a barra está no
    // mesmo chão do conteúdo e uma linha ali separaria nada de nada.
    <header
      className={`fixed inset-x-0 top-0 z-40 border-b bg-background transition-colors duration-200 supports-[backdrop-filter]:bg-background/80 supports-[backdrop-filter]:backdrop-blur-xl ${
        scrolled ? 'border-border' : 'border-transparent'
      }`}
    >
      <div className="mx-auto grid h-16 w-full max-w-6xl grid-cols-[1fr_auto] items-center px-4 sm:grid-cols-[1fr_auto_1fr] sm:px-6">
        <Link
          to="/"
          className="flex w-fit items-center gap-2 py-2 text-base font-extrabold tracking-tight text-foreground no-underline"
        >
          <Logo className="size-7" />
          {appConfig.name}
        </Link>

        <nav className="hidden items-center gap-1 sm:flex">
          {NAV.map((item) => (
            <a key={item.href} href={item.href} className={navLink}>
              {item.label}
            </a>
          ))}
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger
              className={`${navLink} focus-visible:outline-none`}
            >
              Demos
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center" className="min-w-56">
              {DEMOS.map((item) => (
                <DropdownMenuItem key={item.href} asChild>
                  <a href={item.href}>{item.label}</a>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </nav>

        <div className="flex items-center justify-end gap-1 sm:gap-2">
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger
              aria-label="Abrir menu"
              className="inline-flex size-9 items-center justify-center rounded-[var(--radius-btn)] text-muted-foreground hover:bg-secondary hover:text-foreground focus-visible:outline-none sm:hidden"
            >
              <MenuIcon className="size-5" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="min-w-48">
              {NAV.map((item) => (
                <DropdownMenuItem key={item.href} asChild>
                  <a href={item.href}>{item.label}</a>
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Demos</DropdownMenuLabel>
              {DEMOS.map((item) => (
                <DropdownMenuItem key={item.href} asChild>
                  <a href={item.href}>{item.label}</a>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <ThemePicker />
          <ThemeToggle />
          <BetterAuthHeader />
        </div>
      </div>
    </header>
  )
}
