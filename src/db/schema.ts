import { sql } from 'drizzle-orm'
import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

// `created_at` fica em SEGUNDOS (`timestamp`), ao contrário das outras tabelas (ms).
// Trocar para ms obriga o drizzle-kit a recriar a tabela e converteria dados
// antigos errado; como `todos` é só exemplo, ficou assim.
export const todos = sqliteTable('todos', {
  id: integer({ mode: 'number' }).primaryKey({
    autoIncrement: true,
  }),
  title: text().notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(
    sql`(unixepoch())`,
  ),
})

// Trilha de auditoria (src/lib/audit.ts). Sem chave estrangeira para `user`
// de propósito: o registro sobrevive à exclusão da conta (aí o e-mail é
// apagado da linha e fica só o id). Nunca guarda segredo nem corpo de request.
export const auditLog = sqliteTable(
  'audit_log',
  {
    id: text('id').primaryKey(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
    // `<area>.<verbo>`, ex.: auth.sign_in, account.avatar_set
    action: text('action').notNull(),
    actorId: text('actor_id'),
    actorEmail: text('actor_email'),
    targetType: text('target_type'),
    targetId: text('target_id'),
    // JSON com poucos campos primitivos (ou null)
    meta: text('meta'),
    ip: text('ip'),
    userAgent: text('user_agent'),
  },
  (table) => [
    index('audit_log_actor_idx').on(table.actorId),
    index('audit_log_created_idx').on(table.createdAt),
    index('audit_log_action_idx').on(table.action),
  ],
)
