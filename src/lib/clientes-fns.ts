// Server functions da tela de clientes (/app/clientes). Toda consulta filtra
// pelo usuário da sessão: ninguém lê nem apaga cliente de outra pessoa.
//
// Não há `isRateLimited` aqui de propósito: o limite público (5 por minuto por
// IP) é para endpoint sem login. Aqui quem protege é a sessão e o teto de
// CLIENTES_MAX por pessoa; com o limite público, cadastrar o sexto cliente em
// um minuto daria erro.
import { env, waitUntil } from 'cloudflare:workers'
import { createServerFn } from '@tanstack/react-start'
import { and, count, eq } from 'drizzle-orm'

import { getDb } from '#/db/index'
import { clientes } from '#/db/schema'
import { audit, requestMeta } from '#/lib/audit'
import { CLIENTES_MAX, linhaDoCliente, validarCliente } from '#/lib/clientes'
import { listarClientes, requireUser } from '#/lib/clientes-server'

export const listClientesFn = createServerFn({ method: 'GET' }).handler(() =>
  listarClientes(),
)

export const createClienteFn = createServerFn({ method: 'POST' })
  .validator((data: unknown) => validarCliente(data))
  .handler(async ({ data }) => {
    const { user, headers } = await requireUser('escrita')
    const db = getDb(env.DB)
    const [row] = await db
      .select({ total: count() })
      .from(clientes)
      .where(eq(clientes.userId, user.id))
    if ((row?.total ?? 0) >= CLIENTES_MAX) {
      throw new Error(
        `Você chegou ao limite de ${CLIENTES_MAX} clientes. Apague algum para adicionar outro.`,
      )
    }
    const id = crypto.randomUUID()
    await db.insert(clientes).values(linhaDoCliente(id, user.id, data))
    await audit(
      {
        action: 'cliente.created',
        actorId: user.id,
        actorEmail: user.email,
        targetType: 'cliente',
        targetId: id,
        ...requestMeta(headers),
      },
      { waitUntil },
    )
    return { id }
  })

export const deleteClienteFn = createServerFn({ method: 'POST' })
  .validator((data: { id: string }) => {
    if (typeof data?.id !== 'string' || !data.id || data.id.length > 64) {
      throw new Error('Cliente não encontrado.')
    }
    return { id: data.id }
  })
  .handler(async ({ data }) => {
    const { user, headers } = await requireUser('escrita')
    // O `and` com userId é o que impede apagar o cliente de outra pessoa.
    const apagados = await getDb(env.DB)
      .delete(clientes)
      .where(and(eq(clientes.id, data.id), eq(clientes.userId, user.id)))
      .returning({ id: clientes.id })
    if (apagados.length === 0) throw new Error('Cliente não encontrado.')
    await audit(
      {
        action: 'cliente.deleted',
        actorId: user.id,
        actorEmail: user.email,
        targetType: 'cliente',
        targetId: data.id,
        ...requestMeta(headers),
      },
      { waitUntil },
    )
    return { id: data.id }
  })
