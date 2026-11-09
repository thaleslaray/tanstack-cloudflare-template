// Banco de mentira para testes unitários: cada método do Drizzle devolve a
// mesma "corrente" e, quando alguém dá `await`, ela entrega o resultado
// combinado. Registra as chamadas para o teste conferir o que foi pedido.
// Não executa SQL: serve para ver SE o código chama delete/update, não o SQL.
export type Call = [method: string, args: unknown[]]

export function fakeDb(results: { select?: unknown[]; changes?: number } = {}) {
  const calls: Call[] = []
  const chain = (result: unknown): unknown => {
    const proxy: unknown = new Proxy(() => {}, {
      get: (_target, key) => {
        if (key === 'then') {
          return (resolve: (value: unknown) => void) => resolve(result)
        }
        return (...args: unknown[]) => {
          calls.push([String(key), args])
          return proxy
        }
      },
    })
    return proxy
  }
  const meta = { meta: { changes: results.changes ?? 0 } }
  const db = {
    select: () => chain(results.select ?? []),
    update: (table: unknown) => {
      calls.push(['update', [table]])
      return chain(meta)
    },
    delete: (table: unknown) => {
      calls.push(['delete', [table]])
      return chain(meta)
    },
    batch: async () => [meta, meta],
  }
  return { db, calls }
}
