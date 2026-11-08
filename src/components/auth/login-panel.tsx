import { EmailOtpForm } from '#/components/auth/email-otp-form'
import { PasswordForm } from '#/components/auth/password-form'
import { SocialButtons } from '#/components/auth/social-buttons'

// Mensagens para o `?error=` que volta de um login social recusado.
function describeError(code: string | undefined) {
  if (!code) return null
  return 'Não foi possível entrar com esse método. Tente de novo ou use o código por e-mail.'
}

export function LoginPanel({
  callbackURL,
  error,
}: {
  callbackURL: string
  error?: string
}) {
  const message = describeError(error)
  return (
    <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-sm flex-col justify-center gap-6 px-4 py-12">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Entrar</h1>
        <p className="text-sm text-muted-foreground">
          Sem senha: enviamos um código para o seu e-mail.
        </p>
      </div>

      {message ? (
        <p role="alert" className="text-sm text-destructive">
          {message}
        </p>
      ) : null}

      <EmailOtpForm callbackURL={callbackURL} />
      <SocialButtons callbackURL={callbackURL} />

      <details className="group text-sm">
        <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
          Prefere entrar com senha?
        </summary>
        <div className="pt-4">
          <PasswordForm callbackURL={callbackURL} />
        </div>
      </details>

      <p className="text-center text-xs text-muted-foreground">
        Ao continuar você concorda com os{' '}
        <a
          href="/termos"
          className="underline underline-offset-2 hover:text-foreground"
        >
          Termos de uso
        </a>{' '}
        e a{' '}
        <a
          href="/privacidade"
          className="underline underline-offset-2 hover:text-foreground"
        >
          Política de privacidade
        </a>
        .
      </p>
    </div>
  )
}
