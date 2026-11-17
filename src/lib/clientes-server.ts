// O miolo de servidor das server functions de clientes, em funções comuns (sem
// `createServerFn`), para um teste chamá-las direto: `clientes-fila.test.ts`
// mede aqui as consultas em fila da lista. Só servidor: usa bindings.
import { env } from 'cloudflare:workers'
import { getRequest } from '@tanstack/react-start/server'
import { desc, eq } from 'drizzle-orm'

import { getDb } from '#/db/index'
import { clientes } from '#/db/schema'
import { CLIENTES_MAX } from '#/lib/clientes'
import { limitarUsuario, type UserLimitScope } from '#/lib/rate-limit'
import { getRequestSession } from '#/lib/request-session'

export async function requireUser(scope: UserLimitScope) {
  const current = await getRequestSession()
  if (!current) throw new Error('Entre na sua conta primeiro.')
  await limitarUsuario(current.user.id, scope)
  return { user: current.user, headers: getRequest().headers }
}

export async function listarClientes() {
  const { user } = await requireUser('leitura')
  return getDb(env.DB)
    .select({
      id: clientes.id,
      nome: clientes.nome,
      email: clientes.email,
      situacao: clientes.situacao,
      createdAt: clientes.createdAt,
    })
    .from(clientes)
    .where(eq(clientes.userId, user.id))
    .orderBy(desc(clientes.createdAt))
    .limit(CLIENTES_MAX)
}
