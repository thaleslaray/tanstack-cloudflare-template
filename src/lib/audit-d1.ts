// Sink padrão da auditoria: grava cada evento na tabela `audit_log` do D1.
// Somente servidor. Registrado como efeito colateral deste import, feito no
// src/server.ts (a entrada do Worker). Não quer guardar auditoria no banco?
// Apague o import de lá: `audit()` vira no-op e nada mais muda.
import { env } from 'cloudflare:workers'

import { getDb } from '#/db/index'
import { auditLog } from '#/db/schema'
import { type AuditRecord, onAudit } from '#/lib/audit'

export async function d1AuditSink(record: AuditRecord): Promise<void> {
  // `env` lido aqui dentro, a cada evento (nunca no escopo do módulo).
  await getDb(env.DB)
    .insert(auditLog)
    .values({ id: crypto.randomUUID(), ...record })
}

onAudit('d1', d1AuditSink)
