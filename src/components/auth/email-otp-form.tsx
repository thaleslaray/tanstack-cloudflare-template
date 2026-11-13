import { useQueryClient } from '@tanstack/react-query'
import { useReducer } from 'react'

import { useCooldown } from '#/components/auth/use-cooldown'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { authClient } from '#/lib/auth-client'
import { authFailureMessage, toAuthFailure } from '#/lib/auth-failure'

// Login por código, como máquina de estados: o passo em que estamos é UM valor
// (`OtpStep`), nunca uma combinação de booleanos.
//
//   email --enviar--> sending --ok--> code --entrar--> verifying --ok--> (recarrega a página)
//     ^                  |             |  ^                |
//     +------falha-------+             |  +-----falha------+
//     +-------"usar outro e-mail"------+
//
// `sending` com `resend: true` é o "Reenviar código": a tela continua na etapa
// do código e, se falhar, volta para ela. Em `sending` e `verifying` os botões
// ficam travados (inclusive "Usar outro e-mail").
type OtpStep =
  | { s: 'email' }
  | { s: 'sending'; to: string; resend: boolean }
  | { s: 'code'; to: string }
  | { s: 'verifying'; to: string }

type State = {
  step: OtpStep
  email: string
  code: string
  error: string | null
}

type Action =
  | { type: 'email_changed'; value: string }
  | { type: 'code_changed'; value: string }
  | { type: 'send_started'; to: string; resend: boolean }
  | { type: 'send_succeeded'; to: string }
  | { type: 'send_failed'; message: string }
  | { type: 'verify_started'; to: string }
  | { type: 'verify_failed'; message: string }
  | { type: 'back_to_email' }

export const initial: State = {
  step: { s: 'email' },
  email: '',
  code: '',
  error: null,
}

export function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'email_changed':
      return { ...state, email: action.value }
    case 'code_changed':
      return { ...state, code: action.value, error: null }
    case 'send_started':
      return {
        ...state,
        step: { s: 'sending', to: action.to, resend: action.resend },
        error: null,
      }
    case 'send_succeeded':
      return { ...state, step: { s: 'code', to: action.to }, code: '' }
    case 'send_failed': {
      // Falhou o primeiro envio: volta ao e-mail. Falhou o reenvio: volta ao código.
      const step: OtpStep =
        state.step.s === 'sending' && state.step.resend
          ? { s: 'code', to: state.step.to }
          : { s: 'email' }
      return { ...state, step, error: action.message }
    }
    case 'verify_started':
      return { ...state, step: { s: 'verifying', to: action.to }, error: null }
    case 'verify_failed':
      return {
        ...state,
        step: {
          s: 'code',
          to: state.step.s === 'verifying' ? state.step.to : '',
        },
        error: action.message,
      }
    case 'back_to_email':
      return { ...state, step: { s: 'email' }, error: null }
  }
}

export function EmailOtpForm({ callbackURL }: { callbackURL: string }) {
  const queryClient = useQueryClient()
  const [state, dispatch] = useReducer(reducer, initial)
  const cooldown = useCooldown()
  const { step, email, code, error } = state

  const pending = step.s === 'sending' || step.s === 'verifying'
  // A etapa do código também vale durante o reenvio.
  const codeStep =
    step.s === 'code' ||
    step.s === 'verifying' ||
    (step.s === 'sending' && step.resend)
  const sentTo = step.s === 'email' ? null : step.to

  async function send(address: string, resend: boolean) {
    dispatch({ type: 'send_started', to: address, resend })
    let failure: unknown
    try {
      const result = await authClient.emailOtp.sendVerificationOtp({
        email: address,
        type: 'sign-in',
      })
      failure = result.error
    } catch {
      // Falha de rede: o cliente rejeita em vez de devolver `error`.
      failure = {}
    }
    if (failure) {
      dispatch({
        type: 'send_failed',
        message: authFailureMessage(toAuthFailure(failure), 'enviar'),
      })
      return
    }
    dispatch({ type: 'send_succeeded', to: address })
    cooldown.start()
  }

  async function verify(address: string) {
    dispatch({ type: 'verify_started', to: address })
    let failure: unknown
    try {
      const result = await authClient.signIn.emailOtp({
        email: address,
        otp: code,
      })
      failure = result.error
    } catch {
      failure = {}
    }
    if (failure) {
      dispatch({
        type: 'verify_failed',
        message: authFailureMessage(toAuthFailure(failure), 'verificar'),
      })
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
        if (codeStep && sentTo) void verify(sentTo)
        else void send(email.trim(), false)
      }}
    >
      {codeStep && sentTo ? (
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
              onChange={(event) =>
                dispatch({
                  type: 'code_changed',
                  value: event.target.value.replace(/\D/g, '').slice(0, 6),
                })
              }
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
            variant="brand"
            className="h-11 w-full"
          >
            {step.s === 'verifying' ? 'Entrando...' : 'Entrar'}
          </Button>
          <div className="flex justify-between text-xs text-muted-foreground">
            <button
              type="button"
              disabled={pending}
              className="hover:text-foreground disabled:hover:text-muted-foreground"
              onClick={() => dispatch({ type: 'back_to_email' })}
            >
              Usar outro e-mail
            </button>
            <button
              type="button"
              disabled={cooldown.left > 0 || pending}
              className="hover:text-foreground disabled:hover:text-muted-foreground"
              onClick={() => void send(sentTo, true)}
            >
              {cooldown.left > 0
                ? `Reenviar em ${cooldown.left}s`
                : 'Reenviar código'}
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
              onChange={(event) =>
                dispatch({ type: 'email_changed', value: event.target.value })
              }
              autoComplete="email"
              placeholder="voce@exemplo.com"
              className="h-12"
            />
          </div>
          <Button
            type="submit"
            disabled={pending || !email.trim()}
            variant="brand"
            className="h-11 w-full"
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
