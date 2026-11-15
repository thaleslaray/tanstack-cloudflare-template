// Liga o Better Auth à auditoria (src/lib/audit.ts). Roda como `hooks.after`,
// uma vez por chamada HTTP a /api/auth/* (chamadas diretas a `auth.api.*` no
// servidor não passam por hooks). Só registra o que deu certo.

import { waitUntil } from 'cloudflare:workers'
import type { GenericEndpointContext } from 'better-auth'
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
    await audit(
      {
        action: 'auth.sign_in',
        actorId: fresh.user.id,
        actorEmail: fresh.user.email,
        targetType: 'user',
        targetId: fresh.user.id,
        // ex.: "sign-in/email-otp", "callback/google"
        meta: { method: ctx.path.replace(/^\//, '') },
        ...req,
      },
      { waitUntil },
    )
    return
  }

  // Troca de nome pela página de configurações (authClient.updateUser).
  if (ctx.path === '/update-user') {
    const body = ctx.body as Record<string, unknown> | undefined
    const session = ctx.context.session
    if (!session || typeof body?.name !== 'string') return
    await audit(
      {
        action: 'account.name_changed',
        actorId: session.user.id,
        actorEmail: session.user.email,
        targetType: 'user',
        targetId: session.user.id,
        ...req,
      },
      { waitUntil },
    )
  }
})

// Eventos que NÃO passam pelo `hooks.after` acima porque nascem dentro do
// Better Auth (saída, vínculo de conta social, usuário novo do login social).
// Entram por `databaseHooks`, que também recebem o contexto HTTP quando há um.
// `lookupEmail` devolve o e-mail do usuário (a sessão e a conta só têm o id).
type Ctx = GenericEndpointContext | null

function metaOf(ctx: Ctx) {
  return requestMeta(ctx?.headers ?? ctx?.request?.headers)
}

export function auditDatabaseHooks(
  lookupEmail: (userId: string) => Promise<string | null>,
) {
  return {
    session: {
      delete: {
        // Só a saída pedida pelo usuário (POST /sign-out). Outros fins de
        // sessão (revogar, expirar) não são "saída".
        after: async (session: { userId: string }, ctx: Ctx) => {
          if (ctx?.path !== '/sign-out') return
          await audit(
            {
              action: 'auth.sign_out',
              actorId: session.userId,
              actorEmail: await lookupEmail(session.userId),
              targetType: 'user',
              targetId: session.userId,
              ...metaOf(ctx),
            },
            { waitUntil },
          )
        },
      },
    },
    account: {
      create: {
        // Conta social (Google, GitHub) ligada a um usuário, novo ou existente.
        // O vínculo "credential" é a senha do cadastro, não um login social.
        after: async (
          account: { userId: string; providerId: string },
          ctx: Ctx,
        ) => {
          if (account.providerId === 'credential') return
          await audit(
            {
              action: 'auth.account_linked',
              actorId: account.userId,
              actorEmail: await lookupEmail(account.userId),
              targetType: 'user',
              targetId: account.userId,
              meta: { provider: account.providerId },
              ...metaOf(ctx),
            },
            { waitUntil },
          )
        },
      },
    },
    user: {
      create: {
        // Usuário novo, inclusive o criado pelo login social (`method` mostra
        // o endpoint, ex.: "callback/google" ou "sign-in/email-otp").
        after: async (user: { id: string; email: string }, ctx: Ctx) => {
          await audit(
            {
              action: 'account.created',
              actorId: user.id,
              actorEmail: user.email,
              targetType: 'user',
              targetId: user.id,
              meta: { method: ctx?.path?.replace(/^\//, '') ?? null },
              ...metaOf(ctx),
            },
            { waitUntil },
          )
        },
      },
    },
  }
}
