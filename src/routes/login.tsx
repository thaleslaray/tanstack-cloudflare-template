import { createFileRoute, redirect } from '@tanstack/react-router'

import { LoginPanel } from '#/components/auth/login-panel'
import { appConfig } from '#/config/app'
import { sessionQuery } from '#/lib/auth-queries'
import { safeRedirect } from '#/lib/safe-redirect'
import { seo } from '#/lib/seo'

export const Route = createFileRoute('/login')({
  // Ambos opcionais: `error` é o código que volta de um login social recusado.
  validateSearch: (
    search: Record<string, unknown>,
  ): { redirect?: string; error?: string } => ({
    ...(typeof search.redirect === 'string'
      ? { redirect: search.redirect }
      : {}),
    ...(typeof search.error === 'string' ? { error: search.error } : {}),
  }),
  beforeLoad: async ({ context, search }) => {
    const session = await context.queryClient.ensureQueryData(sessionQuery)
    if (session) throw redirect({ href: safeRedirect(search.redirect) })
  },
  head: () => ({
    meta: seo({
      title: 'Entrar',
      description: `Entre no ${appConfig.name} com um código enviado por e-mail.`,
      noindex: true,
    }),
  }),
  component: LoginPage,
})

function LoginPage() {
  const { redirect: target, error } = Route.useSearch()
  return <LoginPanel callbackURL={safeRedirect(target)} error={error} />
}
