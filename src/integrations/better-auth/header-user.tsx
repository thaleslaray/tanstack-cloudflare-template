import { authClient } from '#/lib/auth-client'
import { Link } from '@tanstack/react-router'
import { Avatar, AvatarFallback, AvatarImage } from '#/components/ui/avatar'
import { Button } from '#/components/ui/button'

export default function BetterAuthHeader() {
  const { data: session, isPending } = authClient.useSession()

  if (isPending) {
    return <div className="h-8 w-8 animate-pulse rounded-full bg-muted" />
  }

  if (session?.user) {
    return (
      <div className="flex items-center gap-2">
        <Avatar className="h-8 w-8">
          {session.user.image && (
            <AvatarImage src={session.user.image} alt="" />
          )}
          <AvatarFallback className="text-xs">
            {session.user.name?.charAt(0).toUpperCase() || 'U'}
          </AvatarFallback>
        </Avatar>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            void authClient.signOut()
          }}
        >
          Sair
        </Button>
      </div>
    )
  }

  return (
    <Button asChild variant="outline" size="sm">
      <Link to="/demo/better-auth">Entrar</Link>
    </Button>
  )
}
