import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'

import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { authClient } from '#/lib/auth-client'

// Alternativa discreta ao código: e-mail + senha, entrar ou criar conta.
// Conta nova (ou e-mail ainda não confirmado) passa por uma segunda etapa:
// o código de verificação que chega por e-mail. Só depois dele existe sessão.
function describeVerifyError(code: string | undefined) {
  switch (code) {
    case 'OTP_EXPIRED':
      return 'Este código expirou. Peça um novo.'
    case 'INVALID_OTP':
      return 'Código incorreto. Confira e tente de novo.'
    case 'TOO_MANY_ATTEMPTS':
      return 'Muitas tentativas erradas. Peça um novo código.'
    default:
      return 'Não deu certo. Tente de novo em instantes.'
  }
}

export function PasswordForm({ callbackURL }: { callbackURL: string }) {
  const queryClient = useQueryClient()
  const [isSignUp, setIsSignUp] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  // Preenchido quando falta confirmar o e-mail: também diz em qual etapa estamos.
  const [verifyingEmail, setVerifyingEmail] = useState<string | null>(null)
  const [code, setCode] = useState('')

  async function handleVerify(event: React.FormEvent) {
    event.preventDefault()
    if (!verifyingEmail) return
    setError('')
    setLoading(true)
    try {
      const { error: failure } = await authClient.emailOtp.verifyEmail({
        email: verifyingEmail,
        otp: code,
      })
      if (failure) {
        setError(describeVerifyError(failure.code))
        return
      }
      // Confirmado: o Better Auth já abriu a sessão (autoSignInAfterVerification).
      await queryClient.invalidateQueries({ queryKey: ['session'] })
      window.location.assign(callbackURL)
    } catch {
      setError('Ocorreu um erro inesperado. Tente de novo.')
    } finally {
      setLoading(false)
    }
  }

  async function handleResend() {
    if (!verifyingEmail) return
    setError('')
    const { error: failure } = await authClient.emailOtp.sendVerificationOtp({
      email: verifyingEmail,
      type: 'email-verification',
    })
    if (failure) setError('Não foi possível reenviar o código. Tente de novo.')
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError('')
    setLoading(true)
    try {
      const result = isSignUp
        ? await authClient.signUp.email({ email, password, name })
        : await authClient.signIn.email({ email, password })
      // Cadastro novo, ou entrada com e-mail ainda não confirmado: o Better Auth
      // já mandou o código; falta digitá-lo.
      if (
        (isSignUp && !result.error) ||
        result.error?.code === 'EMAIL_NOT_VERIFIED'
      ) {
        setVerifyingEmail(email.trim())
        setCode('')
        return
      }
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

  if (verifyingEmail) {
    return (
      <form onSubmit={handleVerify} className="grid gap-3">
        <p className="text-sm text-muted-foreground">
          Enviamos um código de 6 dígitos para{' '}
          <strong className="text-foreground">{verifyingEmail}</strong> para
          confirmar o e-mail. Ele vale por 10 minutos.
        </p>
        <div className="grid gap-2">
          <Label htmlFor="pw-code">Código</Label>
          <Input
            id="pw-code"
            autoFocus
            value={code}
            onChange={(e) => {
              setCode(e.target.value.replace(/\D/g, '').slice(0, 6))
              setError('')
            }}
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="000000"
            className="h-12 text-center text-lg tracking-[0.4em]"
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
          disabled={loading || code.length < 6}
          className="w-full"
        >
          {loading ? 'Aguarde...' : 'Confirmar e entrar'}
        </Button>
        <div className="flex justify-between text-xs text-muted-foreground">
          <button
            type="button"
            className="hover:text-foreground"
            onClick={() => {
              setVerifyingEmail(null)
              setError('')
            }}
          >
            Voltar
          </button>
          <button
            type="button"
            className="hover:text-foreground"
            onClick={() => void handleResend()}
          >
            Reenviar código
          </button>
        </div>
      </form>
    )
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
