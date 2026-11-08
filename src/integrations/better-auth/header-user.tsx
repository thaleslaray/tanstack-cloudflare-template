import { Link } from '@tanstack/react-router'

import { Avatar, AvatarFallback, AvatarImage } from '#/components/ui/avatar'
import { Button } from '#/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '#/components/ui/dropdown-menu'
import { authClient } from '#/lib/auth-client'

export default function BetterAuthHeader() {
  const { data: session, isPending } = authClient.useSession()

  if (isPending) {
    return <div className="size-8 animate-pulse rounded-full bg-muted" />
  }

  if (session?.user) {
    const { user } = session
    return (
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger
          aria-label="Abrir menu da conta"
          className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Avatar className="size-8">
            {user.image ? <AvatarImage src={user.image} alt="" /> : null}
            <AvatarFallback className="text-xs">
              {(user.name || user.email).charAt(0).toUpperCase() || 'U'}
            </AvatarFallback>
          </Avatar>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-48">
          <DropdownMenuLabel className="truncate font-normal text-muted-foreground">
            {user.email}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link to="/app">Painel</Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link to="/app/configuracoes">Configurações</Link>
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => {
              void authClient.signOut().then(() => window.location.assign('/'))
            }}
          >
            Sair
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }

  return (
    <Button asChild variant="outline" size="sm">
      <Link to="/login">Entrar</Link>
    </Button>
  )
}
