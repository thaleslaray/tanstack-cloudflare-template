// Server functions da conta: encerrar e baixar os dados. Os registros de cada
// módulo (foto, auditoria...) vêm de src/lib/account-handlers.ts, carregado
// pelo src/server.ts.
import { env, waitUntil } from 'cloudflare:workers'
import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { and, eq, isNull } from 'drizzle-orm'

import { session, user } from '#/db/auth-schema'
import { getDb } from '#/db/index'
import {
  ACCOUNT_RETENTION_DAYS,
  collectAccountExport,
  purgeDateFor,
  runAccountDeletionGuards,
} from '#/lib/account'
import { audit, requestMeta } from '#/lib/audit'
import { getAuth } from '#/lib/auth'
import { sendEmailSafely } from '#/lib/email'
import { accountClosedEmail } from '#/lib/email-templates'

// Mesmo valor de `session.freshAge` em src/lib/auth.ts.
const FRESH_SESSION_MS = 60 * 60 * 1000

async function requireSession() {
  const request = getRequest()
  const headers = request.headers
  // `disableCookieCache`: ação sensível, confere no banco (o cache da sessão em
  // cookie pode estar até 60 s atrasado, ex.: sessão já revogada).
  const current = await getAuth(env, request).api.getSession({
    headers,
    query: { disableCookieCache: true },
  })
  if (!current) throw new Error('Entre na sua conta primeiro.')
  return { current, headers }
}

/**
 * Fase 1 do encerramento (src/lib/account.ts): marca `deletedAt`, derruba
 * todas as sessões e avisa por e-mail. Nada é apagado agora: o cron apaga
 * depois de ACCOUNT_RETENTION_DAYS dias.
 */
export const closeAccountFn = createServerFn({ method: 'POST' }).handler(
  async () => {
    const { current, headers } = await requireSession()
    // Quem não confirmou o e-mail pode ter criado a conta no nome de outra pessoa.
    if (!current.user.emailVerified) {
      throw new Error('Confirme seu e-mail antes de encerrar a conta.')
    }
    // "freshAge" feito à mão: o do Better Auth só vale para os endpoints dele
    // (senha, e-mail), e aqui o login é por código. Sessão com mais de 1 hora
    // (cookie esquecido ou roubado) não encerra a conta.
    const sessionAge =
      Date.now() - new Date(current.session.createdAt).getTime()
    if (sessionAge > FRESH_SESSION_MS) {
      throw new Error(
        'Por segurança, entre de novo (peça um novo código) antes de encerrar a conta.',
      )
    }
    const me = { id: current.user.id, email: current.user.email }
    // Um guard pode recusar (ex.: assinatura ativa); a mensagem chega à tela.
    await runAccountDeletionGuards(me)

    const db = getDb(env.DB)
    const now = new Date()
    // Atômico: marca a conta e derruba as sessões juntos.
    await db.batch([
      db
        .update(user)
        .set({ deletedAt: now, purgeRemindedAt: null, updatedAt: now })
        .where(and(eq(user.id, me.id), isNull(user.deletedAt))),
      db.delete(session).where(eq(session.userId, me.id)),
    ])
    const purgeAt = purgeDateFor(now)
    await audit(
      {
        action: 'account.close_requested',
        actorId: me.id,
        actorEmail: me.email,
        targetType: 'user',
        targetId: me.id,
        meta: { purgeAt: purgeAt.toISOString(), days: ACCOUNT_RETENTION_DAYS },
        ...requestMeta(headers),
      },
      { waitUntil },
    )
    // Falha de envio não desfaz o encerramento (sendEmailSafely só registra).
    await sendEmailSafely({ to: me.email, ...accountClosedEmail({ purgeAt }) })
    return { purgeAt: purgeAt.toISOString() }
  },
)

/** "Baixar meus dados": um JSON com a fatia de cada módulo (onAccountExport). */
export const exportMyDataFn = createServerFn({ method: 'POST' }).handler(
  async () => {
    const { current, headers } = await requireSession()
    const me = { id: current.user.id, email: current.user.email }
    const data = await collectAccountExport(me)
    await audit(
      {
        action: 'account.data_exported',
        actorId: me.id,
        actorEmail: me.email,
        targetType: 'user',
        targetId: me.id,
        ...requestMeta(headers),
      },
      { waitUntil },
    )
    return { exportedAt: new Date().toISOString(), ...data }
  },
)
