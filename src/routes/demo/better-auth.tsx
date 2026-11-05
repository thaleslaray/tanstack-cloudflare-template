import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { authClient } from '#/lib/auth-client'
import { Avatar, AvatarFallback, AvatarImage } from '#/components/ui/avatar'
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

export const Route = createFileRoute('/demo/better-auth')({
  component: BetterAuthDemo,
})

function BetterAuthDemo() {
  const { data: session, isPending } = authClient.useSession()
  const [isSignUp, setIsSignUp] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  if (isPending) {
    return (
      <main className="demo-page demo-center">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-muted border-t-foreground" />
      </main>
    )
  }

  if (session?.user) {
    return (
      <main className="demo-page demo-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <p className="island-kicker">Better Auth</p>
            <CardTitle className="text-2xl">Bem-vindo de volta</CardTitle>
            <CardDescription>
              Você entrou como {session.user.email}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10">
                {session.user.image && (
                  <AvatarImage src={session.user.image} alt="" />
                )}
                <AvatarFallback>
                  {session.user.name?.charAt(0).toUpperCase() || 'U'}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {session.user.name}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {session.user.email}
                </p>
              </div>
            </div>

            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                void authClient.signOut()
              }}
            >
              Sair
            </Button>

            <p className="mt-6 text-center text-xs text-muted-foreground">
              Feito com{' '}
              <a
                href="https://better-auth.com"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium"
              >
                BETTER-AUTH
              </a>
              .
            </p>
          </CardContent>
        </Card>
      </main>
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      if (isSignUp) {
        const result = await authClient.signUp.email({
          email,
          password,
          name,
        })
        if (result.error) {
          setError(result.error.message || 'Falha ao criar a conta')
        }
      } else {
        const result = await authClient.signIn.email({
          email,
          password,
        })
        if (result.error) {
          setError(result.error.message || 'Falha ao entrar')
        }
      }
    } catch {
      setError('Ocorreu um erro inesperado')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="demo-page demo-center">
      <Card className="w-full max-w-md">
        <CardHeader>
          <p className="island-kicker">Better Auth</p>
          <CardTitle className="text-2xl">
            {isSignUp ? 'Criar uma conta' : 'Entrar'}
          </CardTitle>
          <CardDescription>
            {isSignUp
              ? 'Preencha seus dados para criar uma conta'
              : 'Informe seu e-mail para entrar na sua conta'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="grid gap-4">
            {isSignUp && (
              <div className="grid gap-2">
                <Label htmlFor="name">Nome</Label>
                <Input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
            )}

            <div className="grid gap-2">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
              />
            </div>

            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}

            <Button type="submit" disabled={loading} className="w-full">
              {loading ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground/40 border-t-primary-foreground" />
                  <span>Aguarde</span>
                </>
              ) : isSignUp ? (
                'Criar conta'
              ) : (
                'Entrar'
              )}
            </Button>
          </form>

          <div className="mt-4 text-center">
            <Button
              type="button"
              variant="link"
              onClick={() => {
                setIsSignUp(!isSignUp)
                setError('')
              }}
            >
              {isSignUp
                ? 'Já tem uma conta? Entrar'
                : 'Não tem uma conta? Cadastre-se'}
            </Button>
          </div>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            Feito com{' '}
            <a
              href="https://better-auth.com"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium"
            >
              BETTER-AUTH
            </a>
            .
          </p>
        </CardContent>
      </Card>
    </main>
  )
}
