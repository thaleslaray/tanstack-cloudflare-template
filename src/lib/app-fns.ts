// Dados do painel (/app). Somente o necessário para os números da StatStrip.
import { env } from 'cloudflare:workers'
import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { count, eq } from 'drizzle-orm'

import { getDb } from '#/db/index'
import { auditLog, clientes } from '#/db/schema'
import { getAuth } from '#/lib/auth'

export const getDashboardStatsFn = createServerFn({ method: 'GET' }).handler(
  async () => {
    const request = getRequest()
    const current = await getAuth(env, request).api.getSession({
      headers: request.headers,
    })
    if (!current) throw new Error('Entre na sua conta primeiro.')
    const db = getDb(env.DB)
    // Duas leituras numa ida só ao D1.
    const [[activity], [clients]] = await db.batch([
      db
        .select({ total: count() })
        .from(auditLog)
        .where(eq(auditLog.actorId, current.user.id)),
      db
        .select({ total: count() })
        .from(clientes)
        .where(eq(clientes.userId, current.user.id)),
    ])
    return { activity: activity?.total ?? 0, clients: clients?.total ?? 0 }
  },
)
