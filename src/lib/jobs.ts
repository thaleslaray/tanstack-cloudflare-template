// Registro simples de jobs agendados. O cron (wrangler.jsonc) chama `runJobs` pelo
// `scheduled()` do src/server.ts. Cada job roda isolado: um erro não impede os demais.
import { and, eq, gte, isNotNull, isNull, lt } from 'drizzle-orm'
import { session, user, verification } from '#/db/auth-schema'
import { getDb } from '#/db/index'
import {
  purgeCutoff,
  purgeDateFor,
  reminderCutoff,
  runAccountDeletionGuards,
  runBeforeAccountDelete,
} from '#/lib/account'
import { audit } from '#/lib/audit'
import { sendEmailSafely } from '#/lib/email'
import { accountPurgeReminderEmail } from '#/lib/email-templates'

export interface Job {
  name: string
  /** Retorna um detalhe curto para o log, ex.: "sessions=2 verifications=0". */
  // biome-ignore lint/suspicious/noConfusingVoidType: o job pode não devolver detalhe nenhum
  run: (env: Env) => Promise<string | void>
}

const jobs: Job[] = []

export function registerJob(job: Job): void {
  jobs.push(job)
}

export async function runJobs(
  env: Env,
): Promise<Record<string, 'ok' | 'erro'>> {
  const result: Record<string, 'ok' | 'erro'> = {}
  for (const job of jobs) {
    try {
      const detail = await job.run(env)
      console.log(`[jobs] ${job.name}: ${detail ?? 'ok'}`)
      result[job.name] = 'ok'
    } catch (error) {
      console.error(`[jobs] ${job.name}: falhou`, error)
      result[job.name] = 'erro'
    }
  }
  return result
}

// Apaga sessões e códigos de verificação (OTP, links) já expirados.
registerJob({
  name: 'auth.limpar-expirados',
  async run(env) {
    const db = getDb(env.DB)
    const now = new Date()
    // D1 não tem transação aninhada: db.batch executa as duas exclusões de forma atômica.
    const [sessions, verifications] = await db.batch([
      db.delete(session).where(lt(session.expiresAt, now)),
      db.delete(verification).where(lt(verification.expiresAt, now)),
    ])
    return `sessions=${sessions.meta.changes} verifications=${verifications.meta.changes}`
  },
})

// Contas encerradas no dia do lembrete (dia 5 de 7) que ainda não foram
// avisadas. Pega também quem o cron "pulou" numa noite, desde que ainda esteja
// dentro do prazo. Cada envio é REIVINDICADO antes com um update condicional
// em `purgeRemindedAt`: cron duplicado ou dois rodando juntos mandam 1 e-mail.
registerJob({
  name: 'conta.lembrar-exclusao',
  async run(env) {
    const db = getDb(env.DB)
    const now = new Date()
    const due = await db
      .select({ id: user.id })
      .from(user)
      .where(
        and(
          lt(user.deletedAt, reminderCutoff(now)),
          gte(user.deletedAt, purgeCutoff(now)),
          isNull(user.purgeRemindedAt),
        ),
      )
    let reminded = 0
    for (const { id } of due) {
      const [claimed] = await db
        .update(user)
        .set({ purgeRemindedAt: now })
        .where(
          and(
            eq(user.id, id),
            isNotNull(user.deletedAt),
            isNull(user.purgeRemindedAt),
          ),
        )
        .returning({ email: user.email, deletedAt: user.deletedAt })
      if (!claimed?.deletedAt) continue
      await sendEmailSafely({
        to: claimed.email,
        ...accountPurgeReminderEmail({
          purgeAt: purgeDateFor(claimed.deletedAt),
        }),
      })
      reminded++
    }
    return `lembradas=${reminded}`
  },
})

// Quantas contas apagar por noite: cada uma passa pelas limpezas (R2...).
// Um acúmulo se resolve em poucas noites, sem prender uma execução por minutos.
const PURGE_BATCH = 25

// Fase 2 do encerramento (src/lib/account.ts): passado o prazo, apaga de vez.
// Guards de novo, limpezas fora do D1, a linha do usuário (sessões e contas
// vinculadas vão em cascata) e o evento de auditoria. Idempotente: uma conta
// que falha fica para a noite seguinte; uma já apagada não aparece mais.
registerJob({
  name: 'conta.apagar-encerradas',
  async run(env) {
    const db = getDb(env.DB)
    const due = await db
      .select({ id: user.id, email: user.email })
      .from(user)
      .where(
        and(
          isNotNull(user.deletedAt),
          lt(user.deletedAt, purgeCutoff(new Date())),
        ),
      )
      .limit(PURGE_BATCH)
    let purged = 0
    let kept = 0
    for (const ref of due) {
      try {
        await runAccountDeletionGuards(ref)
        await runBeforeAccountDelete(ref)
        await db.delete(user).where(eq(user.id, ref.id))
        // Sem e-mail: a conta sumiu e o registro não guarda dado pessoal.
        await audit({
          action: 'account.deleted',
          targetType: 'user',
          targetId: ref.id,
        })
        purged++
      } catch (error) {
        console.error(`[jobs] conta ${ref.id} mantida`, error)
        kept++
      }
    }
    return `apagadas=${purged} mantidas=${kept}`
  },
})
