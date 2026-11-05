// Registro simples de jobs agendados. O cron (cloudflare.config.ts) chama `runJobs` pelo
// `scheduled()` do src/server.ts. Cada job roda isolado: um erro não impede os demais.
import { lt } from 'drizzle-orm'
import { getDb } from '#/db/index'
import { session, verification } from '#/db/auth-schema'

export interface Job {
  name: string
  /** Retorna um detalhe curto para o log, ex.: "sessions=2 verifications=0". */
  run: (env: Env) => Promise<string | void>
}

const jobs: Job[] = []

export function registerJob(job: Job): void {
  jobs.push(job)
}

export async function runJobs(env: Env): Promise<Record<string, 'ok' | 'erro'>> {
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
