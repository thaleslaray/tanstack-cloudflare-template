// O que cada módulo deste template faz no ciclo de vida da conta
// (src/lib/account.ts). Somente servidor: registrado como efeito colateral do
// import em src/server.ts. Módulo novo com dados do usuário fora do D1 (ou que
// deva sair no "baixar meus dados")? Registre aqui.
import { env } from 'cloudflare:workers'
import { desc, eq } from 'drizzle-orm'

import { account, session, user } from '#/db/auth-schema'
import { getDb } from '#/db/index'
import { auditLog } from '#/db/schema'
import { onAccountExport, onBeforeAccountDelete } from '#/lib/account'
import { avatarKey } from '#/lib/avatar'

// A foto vive no R2, não numa linha do banco: não vai em cascata.
onBeforeAccountDelete('avatar', async (ref) => {
  await env.BUCKET.delete(avatarKey(ref.id))
})

// A trilha de auditoria fica (é a história do que aconteceu), mas sem o
// e-mail: depois de apagada, a conta não deixa dado pessoal para trás.
onBeforeAccountDelete('auditoria', async (ref) => {
  await getDb(env.DB)
    .update(auditLog)
    .set({ actorEmail: null })
    .where(eq(auditLog.actorId, ref.id))
})

// "Baixar meus dados": a conta, as sessões e os jeitos de entrar.
onAccountExport('conta', async (ref) => {
  const db = getDb(env.DB)
  const [[profile], sessions, providers] = await Promise.all([
    db
      .select({
        id: user.id,
        name: user.name,
        email: user.email,
        emailVerified: user.emailVerified,
        image: user.image,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      })
      .from(user)
      .where(eq(user.id, ref.id))
      .limit(1),
    db
      .select({
        createdAt: session.createdAt,
        expiresAt: session.expiresAt,
        ipAddress: session.ipAddress,
        userAgent: session.userAgent,
      })
      .from(session)
      .where(eq(session.userId, ref.id)),
    // Nunca exporta tokens nem o hash da senha: só qual provedor e quando.
    db
      .select({ providerId: account.providerId, createdAt: account.createdAt })
      .from(account)
      .where(eq(account.userId, ref.id)),
  ])
  return { ...profile, sessions, providers }
})

onAccountExport('foto', async (ref) => {
  const object = await env.BUCKET.head(avatarKey(ref.id))
  return object
    ? {
        url: `/api/avatar/${ref.id}`,
        tipo: object.httpMetadata?.contentType ?? null,
        bytes: object.size,
        enviadaEm: object.uploaded.toISOString(),
      }
    : null
})

onAccountExport('auditoria', async (ref) =>
  getDb(env.DB)
    .select({
      createdAt: auditLog.createdAt,
      action: auditLog.action,
      meta: auditLog.meta,
      ip: auditLog.ip,
      userAgent: auditLog.userAgent,
    })
    .from(auditLog)
    .where(eq(auditLog.actorId, ref.id))
    .orderBy(desc(auditLog.createdAt))
    .limit(500),
)
