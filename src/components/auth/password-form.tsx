import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'

import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { authClient } from '#/lib/auth-client'

// Alternativa discreta ao código: e-mail + senha, entrar ou criar conta.
export function PasswordForm({ callbackURL }: { callbackURL: string }) {
  const queryClient = useQueryClient()
  const [isSignUp, setIsSignUp] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError('')
    setLoading(true)
    try {
      const result = isSignUp
        ? await authClient.signUp.email({ email, password, name })
        : await authClient.signIn.email({ email, password })
      if (result.error) {
        setError(
          result.error.message ||
            (isSignUp
              ? 'Não foi possível criar a conta.'
              : 'E-mail ou senha incorretos.'),
        )
        return
      }
      await queryClient.invalidateQueries({ queryKey: ['session'] })
      window.location.assign(callbackURL)
    } catch {
      setError('Ocorreu um erro inesperado. Tente de novo.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-3">
      {isSignUp ? (
        <div className="grid gap-2">
          <Label htmlFor="pw-name">Nome</Label>
          <Input
            id="pw-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
            required
          />
        </div>
      ) : null}
      <div className="grid gap-2">
        <Label htmlFor="pw-email">E-mail</Label>
        <Input
          id="pw-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          required
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="pw-password">Senha</Label>
        <Input
          id="pw-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete={isSignUp ? 'new-password' : 'current-password'}
          minLength={8}
          required
        />
      </div>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <Button
        type="submit"
        variant="outline"
        disabled={loading}
        className="w-full"
      >
        {loading ? 'Aguarde...' : isSignUp ? 'Criar conta' : 'Entrar com senha'}
      </Button>
      <button
        type="button"
        className="text-xs text-muted-foreground hover:text-foreground"
        onClick={() => {
          setIsSignUp(!isSignUp)
          setError('')
        }}
      >
        {isSignUp ? 'Já tem conta? Entrar' : 'Não tem conta? Criar conta'}
      </button>
    </form>
  )
}
