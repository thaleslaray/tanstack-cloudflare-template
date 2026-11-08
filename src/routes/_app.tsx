import { useQuery } from '@tanstack/react-query'
import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'
import { LogOutIcon, MenuIcon } from 'lucide-react'
import { useState } from 'react'

import { initials } from '#/components/account/avatar-upload'
import { AppSidebar, Brand, SidebarNav } from '#/components/app-sidebar'
import ThemeToggle from '#/components/ThemeToggle'
import { Avatar, AvatarFallback, AvatarImage } from '#/components/ui/avatar'
import { Button } from '#/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from '#/components/ui/sheet'
import { authClient } from '#/lib/auth-client'
import { sessionQuery } from '#/lib/auth-queries'
import { seo } from '#/lib/seo'

// Rota de LAYOUT (sem caminho próprio: o `_` no nome) de toda a área logada.
// O guard abaixo vale para cada página em src/routes/_app/: sem sessão, vai
// para /login e volta depois para onde a pessoa queria ir.
export const Route = createFileRoute('/_app')({
  beforeLoad: async ({ context, location }) => {
    const session = await context.queryClient.ensureQueryData(sessionQuery)
    if (!session) {
      throw redirect({ to: '/login', search: { redirect: location.href } })
    }
    return { session }
  },
  head: () => ({ meta: seo({ title: 'Painel', noindex: true }) }),
  component: AppLayout,
})

function AppLayout() {
  const { session } = Route.useRouteContext()
  // Sessão do cache: muda quando a pessoa troca nome ou foto.
  const { data } = useQuery(sessionQuery)
  const user = data?.user ?? session.user
  const [navOpen, setNavOpen] = useState(false)

  return (
    // Casca fixa na altura da tela: só o <main> rola, a barra lateral fica.
    <div className="flex h-dvh overflow-hidden bg-background">
      <AppSidebar footer={<ShellFooter user={user} />} />
      <Sheet open={navOpen} onOpenChange={setNavOpen}>
        <SheetContent side="left" className="w-72 gap-0 bg-sidebar p-0">
          <div className="flex h-14 items-center px-5">
            <SheetTitle asChild>
              <div>
                <Brand />
              </div>
            </SheetTitle>
          </div>
          <SheetDescription className="sr-only">
            Navegação da área logada
          </SheetDescription>
          <SidebarNav onNavigate={() => setNavOpen(false)} />
          <ShellFooter user={user} />
        </SheetContent>
        <div className="flex min-w-0 flex-1 flex-col">
          {/* Celular: barra fina com o botão da gaveta. */}
          <div className="flex h-14 shrink-0 items-center gap-2 border-b px-4 lg:hidden">
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Abrir menu">
                <MenuIcon className="size-5" />
              </Button>
            </SheetTrigger>
            <Brand />
          </div>
          <main id="app-main" className="min-h-0 flex-1 overflow-y-auto">
            <div className="px-4 py-6 sm:px-8 sm:py-8">
              <Outlet />
            </div>
          </main>
        </div>
      </Sheet>
    </div>
  )
}

// Rodapé da barra lateral (e da gaveta): quem está logado, tema e sair.
function ShellFooter({
  user,
}: {
  user: { name: string; email: string; image?: string | null }
}) {
  const [leaving, setLeaving] = useState(false)
  async function leave() {
    setLeaving(true)
    await authClient.signOut()
    window.location.assign('/')
  }
  return (
    <div className="flex shrink-0 items-center gap-3 border-t border-sidebar-border px-4 py-3">
      <Avatar className="size-8">
        {user.image ? <AvatarImage src={user.image} alt="" /> : null}
        <AvatarFallback className="text-xs">
          {initials(user.name, user.email)}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{user.name}</p>
        <p className="truncate text-xs text-muted-foreground">{user.email}</p>
      </div>
      <ThemeToggle />
      <Button
        variant="ghost"
        size="icon"
        aria-label="Sair"
        title="Sair"
        disabled={leaving}
        onClick={() => void leave()}
      >
        <LogOutIcon className="size-4" />
      </Button>
    </div>
  )
}
