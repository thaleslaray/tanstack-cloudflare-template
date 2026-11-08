import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'

import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { authClient } from '#/lib/auth-client'

// Login por código: duas etapas no mesmo componente (e-mail, depois código).
// Voltar é só `sentTo = null`, sem mexer no histórico do navegador.
const RESEND_COOLDOWN_SECONDS = 60

function describeError(code: string | undefined) {
  switch (code) {
    case 'OTP_EXPIRED':
      return 'Este código expirou. Peça um novo.'
    case 'INVALID_OTP':
      return 'Código incorreto. Confira e tente de novo.'
    case 'TOO_MANY_ATTEMPTS':
      return 'Muitas tentativas erradas. Peça um novo código.'
    case 'ACCOUNT_CLOSED':
      return 'Esta conta foi encerrada e será apagada em breve. Para recuperá-la, fale com o suporte.'
    default:
      return 'Não deu certo. Tente de novo em instantes.'
  }
}

export function EmailOtpForm({ callbackURL }: { callbackURL: string }) {
  const queryClient = useQueryClient()
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  // Preenchido quando o código já foi enviado: também diz em qual etapa estamos.
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cooldown, setCooldown] = useState(0)

  useEffect(() => {
    if (cooldown <= 0) return
    const timer = setTimeout(() => setCooldown((n) => n - 1), 1000)
    return () => clearTimeout(timer)
  }, [cooldown])

  async function send(address: string) {
    setPending(true)
    setError(null)
    const { error: failure } = await authClient.emailOtp.sendVerificationOtp({
      email: address,
      type: 'sign-in',
    })
    setPending(false)
    if (failure) {
      setError(
        'Não foi possível enviar o código. Confira o e-mail e tente de novo.',
      )
      return
    }
    setSentTo(address)
    setCode('')
    setCooldown(RESEND_COOLDOWN_SECONDS)
  }

  async function verify() {
    if (!sentTo) return
    setPending(true)
    setError(null)
    const { error: failure } = await authClient.signIn.emailOtp({
      email: sentTo,
      otp: code,
    })
    if (failure) {
      setPending(false)
      setError(describeError(failure.code))
      return
    }
    await queryClient.invalidateQueries({ queryKey: ['session'] })
    // Carga completa: a sessão pertence ao render do servidor.
    window.location.assign(callbackURL)
  }

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault()
        if (pending) return
        if (sentTo) void verify()
        else void send(email.trim())
      }}
    >
      {sentTo ? (
        <>
          <p className="text-sm text-muted-foreground">
            Enviamos um código de 6 dígitos para{' '}
            <strong className="text-foreground">{sentTo}</strong>. Ele vale por
            10 minutos.
          </p>
          <div className="grid gap-2">
            <Label htmlFor="otp-code">Código</Label>
            <Input
              id="otp-code"
              autoFocus
              value={code}
              onChange={(event) => {
                setCode(event.target.value.replace(/\D/g, '').slice(0, 6))
                setError(null)
              }}
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="000000"
              aria-invalid={error !== null}
              className="h-12 text-center text-lg tracking-[0.4em]"
            />
          </div>
          <Button
            type="submit"
            disabled={pending || code.length < 6}
            className="h-11 w-full bg-brand text-brand-foreground hover:bg-brand-hover"
          >
            {pending ? 'Entrando...' : 'Entrar'}
          </Button>
          <div className="flex justify-between text-xs text-muted-foreground">
            <button
              type="button"
              className="hover:text-foreground"
              onClick={() => {
                setSentTo(null)
                setError(null)
              }}
            >
              Usar outro e-mail
            </button>
            <button
              type="button"
              disabled={cooldown > 0 || pending}
              className="hover:text-foreground disabled:hover:text-muted-foreground"
              onClick={() => void send(sentTo)}
            >
              {cooldown > 0 ? `Reenviar em ${cooldown}s` : 'Reenviar código'}
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="grid gap-2">
            <Label htmlFor="otp-email">E-mail</Label>
            <Input
              id="otp-email"
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              placeholder="voce@exemplo.com"
              className="h-12"
            />
          </div>
          <Button
            type="submit"
            disabled={pending || !email.trim()}
            className="h-11 w-full bg-brand text-brand-foreground hover:bg-brand-hover"
          >
            {pending ? 'Enviando código...' : 'Continuar com e-mail'}
          </Button>
        </>
      )}
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </form>
  )
}
