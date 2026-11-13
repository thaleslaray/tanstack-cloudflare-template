import { useQueryClient } from '@tanstack/react-query'
import { useReducer } from 'react'

import { useCooldown } from '#/components/auth/use-cooldown'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { authClient } from '#/lib/auth-client'
import { authFailureMessage, toAuthFailure } from '#/lib/auth-failure'

// Alternativa discreta ao código: e-mail + senha, entrar ou criar conta.
// Conta nova (ou e-mail ainda não confirmado) passa por uma segunda etapa:
// o código de verificação que chega por e-mail. Só depois dele existe sessão.
//
// O passo é UM valor (`PwStep`), nunca uma combinação de booleanos:
//
//   form --enviar--> submitting --ok--> (recarrega a página)
//     ^                   |  e-mail por confirmar
//     |                   v
//     +---"Voltar"--- verify --confirmar--> verifying --ok--> (recarrega)
//                       ^                        |
//                       +--------falha-----------+
//
// `verify` com `resending: true` é o "Reenviar código" em andamento.
type Mode = 'entrar' | 'criar'
type PwStep =
  | { s: 'form'; mode: Mode }
  | { s: 'submitting'; mode: Mode }
  | { s: 'verify'; mode: Mode; email: string; resending: boolean }
  | { s: 'verifying'; mode: Mode; email: string }

type State = {
  step: PwStep
  name: string
  email: string
  password: string
  code: string
  error: string
}

type Action =
  | { type: 'field'; field: 'name' | 'email' | 'password'; value: string }
  | { type: 'code_changed'; value: string }
  | { type: 'toggle_mode' }
  | { type: 'submit_started' }
  | { type: 'submit_failed'; message: string }
  | { type: 'needs_verification'; email: string }
  | { type: 'back_to_form' }
  | { type: 'resend_started' }
  | { type: 'resend_finished'; message: string }
  | { type: 'verify_started' }
  | { type: 'verify_failed'; message: string }

export const initial: State = {
  step: { s: 'form', mode: 'entrar' },
  name: '',
  email: '',
  password: '',
  code: '',
  error: '',
}

export function reducer(state: State, action: Action): State {
  const { step } = state
  switch (action.type) {
    case 'field':
      return { ...state, [action.field]: action.value }
    case 'code_changed':
      return { ...state, code: action.value, error: '' }
    case 'toggle_mode':
      if (step.s !== 'form') return state
      return {
        ...state,
        step: { s: 'form', mode: step.mode === 'criar' ? 'entrar' : 'criar' },
        error: '',
      }
    case 'submit_started':
      if (step.s !== 'form') return state
      return { ...state, step: { s: 'submitting', mode: step.mode }, error: '' }
    case 'submit_failed':
      if (step.s !== 'submitting') return state
      return {
        ...state,
        step: { s: 'form', mode: step.mode },
        error: action.message,
      }
    case 'needs_verification':
      if (step.s !== 'submitting') return state
      return {
        ...state,
        step: {
          s: 'verify',
          mode: step.mode,
          email: action.email,
          resending: false,
        },
        code: '',
        error: '',
      }
    case 'back_to_form':
      if (step.s !== 'verify') return state
      return { ...state, step: { s: 'form', mode: step.mode }, error: '' }
    case 'resend_started':
      if (step.s !== 'verify') return state
      return { ...state, step: { ...step, resending: true }, error: '' }
    case 'resend_finished':
      if (step.s !== 'verify') return state
      return {
        ...state,
        step: { ...step, resending: false },
        error: action.message,
      }
    case 'verify_started':
      if (step.s !== 'verify') return state
      return {
        ...state,
        step: { s: 'verifying', mode: step.mode, email: step.email },
        error: '',
      }
    case 'verify_failed':
      if (step.s !== 'verifying') return state
      return {
        ...state,
        step: {
          s: 'verify',
          mode: step.mode,
          email: step.email,
          resending: false,
        },
        error: action.message,
      }
  }
}

export function PasswordForm({ callbackURL }: { callbackURL: string }) {
  const queryClient = useQueryClient()
  const [state, dispatch] = useReducer(reducer, initial)
  const cooldown = useCooldown()
  const { step, name, email, password, code, error } = state

  async function handleVerify(event: React.FormEvent) {
    event.preventDefault()
    if (step.s !== 'verify' || step.resending) return
    const address = step.email
    dispatch({ type: 'verify_started' })
    try {
      const { error: failure } = await authClient.emailOtp.verifyEmail({
        email: address,
        otp: code,
      })
      if (failure) {
        dispatch({
          type: 'verify_failed',
          message: authFailureMessage(toAuthFailure(failure), 'verificar'),
        })
        return
      }
      // Confirmado: o Better Auth já abriu a sessão (autoSignInAfterVerification).
      await queryClient.invalidateQueries({ queryKey: ['session'] })
      window.location.assign(callbackURL)
    } catch {
      dispatch({
        type: 'verify_failed',
        message: 'Ocorreu um erro inesperado. Tente de novo.',
      })
    }
  }

  async function handleResend() {
    if (step.s !== 'verify' || step.resending || cooldown.left > 0) return
    dispatch({ type: 'resend_started' })
    try {
      const { error: failure } = await authClient.emailOtp.sendVerificationOtp({
        email: step.email,
        type: 'email-verification',
      })
      if (failure) {
        dispatch({
          type: 'resend_finished',
          message: authFailureMessage(toAuthFailure(failure), 'reenviar'),
        })
        return
      }
      dispatch({ type: 'resend_finished', message: '' })
      cooldown.start()
    } catch {
      dispatch({
        type: 'resend_finished',
        message: 'Ocorreu um erro inesperado. Tente de novo.',
      })
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (step.s !== 'form') return
    const mode = step.mode
    dispatch({ type: 'submit_started' })
    try {
      const result =
        mode === 'criar'
          ? await authClient.signUp.email({ email, password, name })
          : await authClient.signIn.email({ email, password })
      const failure = result.error ? toAuthFailure(result.error) : null
      // Cadastro novo, ou entrada com e-mail ainda não confirmado: o Better Auth
      // já mandou o código; falta digitá-lo.
      if (
        (mode === 'criar' && !result.error) ||
        failure === 'email_not_verified'
      ) {
        dispatch({ type: 'needs_verification', email: email.trim() })
        cooldown.start()
        return
      }
      if (failure) {
        dispatch({
          type: 'submit_failed',
          message: authFailureMessage(failure, mode),
        })
        return
      }
      await queryClient.invalidateQueries({ queryKey: ['session'] })
      window.location.assign(callbackURL)
    } catch {
      dispatch({
        type: 'submit_failed',
        message: 'Ocorreu um erro inesperado. Tente de novo.',
      })
    }
  }

  if (step.s === 'verify' || step.s === 'verifying') {
    const verifying = step.s === 'verifying'
    const resending = step.s === 'verify' && step.resending
    return (
      <form onSubmit={handleVerify} className="grid gap-3">
        <p className="text-sm text-muted-foreground">
          Enviamos um código de 6 dígitos para{' '}
          <strong className="text-foreground">{step.email}</strong> para
          confirmar o e-mail. Ele vale por 10 minutos.
        </p>
        <div className="grid gap-2">
          <Label htmlFor="pw-code">Código</Label>
          <Input
            id="pw-code"
            autoFocus
            value={code}
            onChange={(e) =>
              dispatch({
                type: 'code_changed',
                value: e.target.value.replace(/\D/g, '').slice(0, 6),
              })
            }
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
          disabled={verifying || resending || code.length < 6}
          className="w-full"
        >
          {verifying ? 'Aguarde...' : 'Confirmar e entrar'}
        </Button>
        <div className="flex justify-between text-xs text-muted-foreground">
          <button
            type="button"
            disabled={verifying}
            className="hover:text-foreground disabled:hover:text-muted-foreground"
            onClick={() => dispatch({ type: 'back_to_form' })}
          >
            Voltar
          </button>
          <button
            type="button"
            disabled={verifying || resending || cooldown.left > 0}
            className="hover:text-foreground disabled:hover:text-muted-foreground"
            onClick={() => void handleResend()}
          >
            {resending
              ? 'Enviando...'
              : cooldown.left > 0
                ? `Reenviar em ${cooldown.left}s`
                : 'Reenviar código'}
          </button>
        </div>
      </form>
    )
  }

  const isSignUp = step.mode === 'criar'
  const loading = step.s === 'submitting'
  return (
    <form onSubmit={handleSubmit} className="grid gap-3">
      {isSignUp ? (
        <div className="grid gap-2">
          <Label htmlFor="pw-name">Nome</Label>
          <Input
            id="pw-name"
            value={name}
            onChange={(e) =>
              dispatch({ type: 'field', field: 'name', value: e.target.value })
            }
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
          onChange={(e) =>
            dispatch({ type: 'field', field: 'email', value: e.target.value })
          }
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
          onChange={(e) =>
            dispatch({
              type: 'field',
              field: 'password',
              value: e.target.value,
            })
          }
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
        disabled={loading}
        onClick={() => dispatch({ type: 'toggle_mode' })}
      >
        {isSignUp ? 'Já tem conta? Entrar' : 'Não tem conta? Criar conta'}
      </button>
    </form>
  )
}
