import { drizzle } from 'drizzle-orm/d1'
import * as authSchema from './auth-schema'
import { currentD1Session } from './d1-session'
import * as schema from './schema'

/**
 * Num pedido, usa a sessão D1 criada em `src/server.ts` (Sessions API): com a
 * réplica de leitura ligada, as leituras vão à réplica mais perto. Fora de um
 * pedido (cron/scheduled, testes) usa o D1 direto, sempre no primário.
 */
export function getDb(d1: D1Database) {
  const session = currentD1Session()
  return drizzle(
    // Cast mínimo: `D1DatabaseSession` tem `prepare` e `batch`, tudo o que o
    // Drizzle chama, mas não declara `exec`/`dump` do tipo `D1Database`.
    (session ?? d1) as D1Database,
    { schema: { ...schema, ...authSchema } },
  )
}
