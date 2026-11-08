import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { toast } from 'sonner'

import { CloseAccount, DownloadMyData } from '#/components/account/account-data'
import { AvatarUpload } from '#/components/account/avatar-upload'
import { PageHeader } from '#/components/page-header'
import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { authClient } from '#/lib/auth-client'
import { sessionQuery } from '#/lib/auth-queries'
import { seo } from '#/lib/seo'

// Configurações da conta (era /conta, que agora redireciona para cá).
export const Route = createFileRoute('/_app/app/configuracoes')({
  head: () => ({ meta: seo({ title: 'Configurações', noindex: true }) }),
  component: SettingsPage,
})

const PROVIDER_LABELS: Record<string, string> = {
  credential: 'Senha',
  google: 'Google',
  github: 'GitHub',
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

// Bloco de conteúdo: título, linha fina, corpo. Sem cartão em volta.
function Section({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <section className="grid gap-4 border-t py-6 md:grid-cols-[16rem_1fr] md:gap-10">
      <div>
        <h2 className="text-sm font-semibold">{title}</h2>
        {description ? (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      <div className="grid max-w-xl gap-6">{children}</div>
    </section>
  )
}

function SettingsPage() {
  const { session } = Route.useRouteContext()
  const queryClient = useQueryClient()
  // A sessão do cache (atualizada depois de salvar nome ou foto); a do guard
  // da rota é o valor inicial.
  const { data: fresh } = useQuery(sessionQuery)
  const user = fresh?.user ?? session.user
  const provider = useProviderLabel()
  const [name, setName] = useState(user.name)
  const [saving, setSaving] = useState(false)

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
    authClient.$store.notify('$sessionSignal')
    toast.success('Nome atualizado')
  }

  return (
    <div>
      <PageHeader
        title="Configurações"
        description="Seu perfil, como você entra e o que fazer com os seus dados."
      />

      <Section title="Perfil" description="Como você aparece no app.">
        <AvatarUpload user={user} />
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
      </Section>

      <Section
        title="Acesso"
        description="O e-mail da conta e como você entra."
      >
        <div className="grid gap-1">
          <p className="text-sm text-muted-foreground">E-mail</p>
          <p className="truncate font-medium">{user.email}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {provider ? (
            <Badge variant="secondary">Entrou com: {provider}</Badge>
          ) : null}
          <Badge variant="outline">
            E-mail verificado: {user.emailVerified ? 'sim' : 'não'}
          </Badge>
        </div>
      </Section>

      <Section
        title="Seus dados"
        description="Baixe uma cópia ou encerre a conta."
      >
        <DownloadMyData />
        <CloseAccount />
      </Section>
    </div>
  )
}
