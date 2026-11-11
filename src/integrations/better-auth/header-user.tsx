import { useQuery } from '@tanstack/react-query'
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
import { sessionQuery } from '#/lib/auth-queries'

// Carrega o cliente do Better Auth só aqui, sob demanda.
async function signOut() {
  const { authClient } = await import('#/lib/auth-client')
  await authClient.signOut()
  window.location.assign('/')
}

// A sessão vem do mesmo cache do resto do app (`sessionQuery`, uma server
// function), NÃO do cliente do Better Auth: o `authClient` pesa e este
// cabeçalho entra em toda página. Ele só é carregado quando a pessoa clica em
// "Sair". As páginas públicas são pré-renderizadas (HTML sem dono), então o
// avatar chega depois da hidratação; nas páginas renderizadas no servidor com
// a sessão já no cache, ele vai no HTML.
export default function BetterAuthHeader() {
  const { data: session, isPending } = useQuery(sessionQuery)

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
              void signOut()
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
