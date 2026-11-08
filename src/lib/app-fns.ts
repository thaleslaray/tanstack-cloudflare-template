// Dados do painel (/app). Somente o necessário para os números da StatStrip.
import { env } from 'cloudflare:workers'
import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { count, eq } from 'drizzle-orm'

import { getDb } from '#/db/index'
import { auditLog } from '#/db/schema'
import { getAuth } from '#/lib/auth'

export const getDashboardStatsFn = createServerFn({ method: 'GET' }).handler(
  async () => {
    const current = await getAuth(env).api.getSession({
      headers: getRequest().headers,
    })
    if (!current) throw new Error('Entre na sua conta primeiro.')
    const [row] = await getDb(env.DB)
      .select({ total: count() })
      .from(auditLog)
      .where(eq(auditLog.actorId, current.user.id))
    return { activity: row?.total ?? 0 }
  },
)
