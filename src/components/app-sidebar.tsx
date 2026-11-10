import { Link } from '@tanstack/react-router'
import { LayoutDashboardIcon, SettingsIcon, UsersIcon } from 'lucide-react'

import { Logo } from '#/components/logo'
import { appConfig } from '#/config/app'

// Navegação da área logada. `mainNav` é a ÚNICA lista de entradas: a barra
// lateral do desktop e a gaveta (sheet) do celular leem daqui
// (src/routes/_app.tsx). Página nova em src/routes/_app/? Acrescente uma linha.
export const mainNav = [
  { to: '/app', label: 'Painel', icon: LayoutDashboardIcon, exact: true },
  { to: '/app/clientes', label: 'Clientes', icon: UsersIcon, exact: false },
  {
    to: '/app/configuracoes',
    label: 'Configurações',
    icon: SettingsIcon,
    exact: false,
  },
] as const

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav
      aria-label="Área logada"
      className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto py-4"
    >
      {mainNav.map((item) => (
        <Link
          key={item.to}
          to={item.to}
          activeOptions={{ exact: item.exact }}
          onClick={onNavigate}
          // Estilo pelo `data-status` que o router põe no link ativo.
          className="group/nav flex items-center gap-3 border-l-2 border-transparent px-5 py-2 text-sm text-sidebar-foreground transition-colors hover:bg-sidebar-accent data-[status=active]:border-sidebar-primary data-[status=active]:font-semibold"
        >
          <item.icon className="size-4 shrink-0 text-muted-foreground group-data-[status=active]/nav:text-sidebar-foreground" />
          <span className="truncate">{item.label}</span>
        </Link>
      ))}
    </nav>
  )
}

export function Brand() {
  return (
    <Link
      to="/"
      className="flex items-center gap-2 text-base font-semibold tracking-tight whitespace-nowrap text-foreground no-underline"
    >
      <Logo className="size-6" />
      {appConfig.name}
    </Link>
  )
}

// Barra lateral do desktop: altura toda, só a navegação rola; marca em cima e
// o rodapé (usuário) embaixo ficam fixos. No celular ela some e entra a gaveta.
export function AppSidebar({ footer }: { footer?: React.ReactNode }) {
  return (
    <aside className="hidden h-full w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar lg:flex">
      <div className="flex h-14 shrink-0 items-center px-5">
        <Brand />
      </div>
      <SidebarNav />
      {footer}
    </aside>
  )
}
