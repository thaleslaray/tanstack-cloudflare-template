// Liga o Better Auth à auditoria (src/lib/audit.ts). Roda como `hooks.after`,
// uma vez por chamada HTTP a /api/auth/* (chamadas diretas a `auth.api.*` no
// servidor não passam por hooks). Só registra o que deu certo.
import { createAuthMiddleware } from 'better-auth/api'

import { audit, requestMeta } from '#/lib/audit'

// Uma sessão "nova" com mais de 1 minuto é só a renovação diária do cookie
// (`updateAge`), não um login.
const FRESH_SESSION_MS = 60_000

// Endpoints que fazem login. Outros também devolvem `newSession` (o
// `/update-user` regrava o cookie), e aquilo não é login.
// `email-otp/verify-email` entra na lista: com cadastro por senha, a sessão
// nasce ali (autoSignInAfterVerification), não no /sign-up.
const SIGN_IN_PATHS =
  /^\/(sign-in|sign-up|callback|oauth2\/callback|email-otp\/verify-email)(\/|$)/

export function isSignInPath(path: string): boolean {
  return SIGN_IN_PATHS.test(path)
}

export const auditAfterHook = createAuthMiddleware(async (ctx) => {
  // Erro no retorno = o endpoint falhou; não há o que registrar.
  if (ctx.context.returned instanceof Error) return
  const req = requestMeta(ctx.headers ?? ctx.request?.headers)

  // Qualquer endpoint que criou sessão: código por e-mail, senha, Google, GitHub.
  const fresh = ctx.context.newSession
  if (
    fresh &&
    isSignInPath(ctx.path) &&
    Date.now() - new Date(fresh.session.createdAt).getTime() < FRESH_SESSION_MS
  ) {
    await audit({
      action: 'auth.sign_in',
      actorId: fresh.user.id,
      actorEmail: fresh.user.email,
      targetType: 'user',
      targetId: fresh.user.id,
      // ex.: "sign-in/email-otp", "callback/google"
      meta: { method: ctx.path.replace(/^\//, '') },
      ...req,
    })
    return
  }

  // Troca de nome pela página de configurações (authClient.updateUser).
  if (ctx.path === '/update-user') {
    const body = ctx.body as Record<string, unknown> | undefined
    const session = ctx.context.session
    if (!session || typeof body?.name !== 'string') return
    await audit({
      action: 'account.name_changed',
      actorId: session.user.id,
      actorEmail: session.user.email,
      targetType: 'user',
      targetId: session.user.id,
      ...req,
    })
  }
})
