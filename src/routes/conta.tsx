import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, redirect } from '@tanstack/react-router'
import { useState } from 'react'
import { toast } from 'sonner'

import { Avatar, AvatarFallback, AvatarImage } from '#/components/ui/avatar'
import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '#/components/ui/card'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { Separator } from '#/components/ui/separator'
import { authClient } from '#/lib/auth-client'
import { sessionQuery } from '#/lib/auth-queries'
import { seo } from '#/lib/seo'

export const Route = createFileRoute('/conta')({
  beforeLoad: async ({ context, location }) => {
    const session = await context.queryClient.ensureQueryData(sessionQuery)
    if (!session) {
      throw redirect({ to: '/login', search: { redirect: location.href } })
    }
    return { session }
  },
  head: () => ({ meta: seo({ title: 'Sua conta', noindex: true }) }),
  component: AccountPage,
})

const PROVIDER_LABELS: Record<string, string> = {
  credential: 'Senha',
  google: 'Google',
  github: 'GitHub',
}

function initials(name: string, email: string) {
  const source = name.trim() || email
  return source.charAt(0).toUpperCase() || 'U'
}

// Contas vinculadas. Quem entra só por código não tem registro aqui.
function useProviderLabel() {
  const { data } = useQuery({
    queryKey: ['auth', 'accounts'],
    queryFn: async () => {
      const result = await authClient.listAccounts()
      return result.data ?? []
    },
    staleTime: 60_000,
  })
  if (!data) return null
  if (data.length === 0) return 'Código por e-mail'
  return data
    .map((account) => PROVIDER_LABELS[account.providerId] ?? account.providerId)
    .join(' + ')
}

function AccountPage() {
  const { session } = Route.useRouteContext()
  const queryClient = useQueryClient()
  const user = session.user
  const provider = useProviderLabel()
  const [name, setName] = useState(user.name)
  const [saving, setSaving] = useState(false)
  const [leaving, setLeaving] = useState(false)

  async function saveName(event: React.FormEvent) {
    event.preventDefault()
    const next = name.trim()
    if (!next || next === user.name) return
    setSaving(true)
    const { error } = await authClient.updateUser({ name: next })
    setSaving(false)
    if (error) {
      toast.error('Não foi possível atualizar o nome.')
      return
    }
    await queryClient.invalidateQueries({ queryKey: ['session'] })
    toast.success('Nome atualizado')
  }

  async function leave() {
    setLeaving(true)
    await authClient.signOut()
    await queryClient.invalidateQueries({ queryKey: ['session'] })
    window.location.assign('/')
  }

  return (
    <div className="mx-auto w-full max-w-lg px-4 py-12">
      <h1 className="mb-6 text-2xl font-bold tracking-tight">Sua conta</h1>
      <Card className="rounded-[var(--radius-card)]">
        <CardHeader>
          <div className="flex items-center gap-4">
            <Avatar size="lg" className="size-14">
              {user.image ? <AvatarImage src={user.image} alt="" /> : null}
              <AvatarFallback>{initials(user.name, user.email)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <CardTitle className="truncate">{user.name}</CardTitle>
              <CardDescription className="truncate">
                {user.email}
              </CardDescription>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 pt-2">
            {provider ? (
              <Badge variant="secondary">Entrou com: {provider}</Badge>
            ) : null}
            <Badge variant="outline">
              E-mail verificado: {user.emailVerified ? 'sim' : 'não'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <Separator />
          <form onSubmit={saveName} className="grid gap-3">
            <div className="grid gap-2">
              <Label htmlFor="account-name">Nome</Label>
              <Input
                id="account-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
                required
              />
            </div>
            <Button
              type="submit"
              disabled={saving || !name.trim() || name.trim() === user.name}
              className="w-full bg-brand text-brand-foreground hover:bg-brand-hover sm:w-fit"
            >
              {saving ? 'Salvando...' : 'Salvar nome'}
            </Button>
          </form>
          <Separator />
          <Button
            variant="outline"
            disabled={leaving}
            onClick={() => void leave()}
          >
            {leaving ? 'Saindo...' : 'Sair'}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
