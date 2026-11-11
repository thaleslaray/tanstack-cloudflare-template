// Sessão do D1 por requisição (Sessions API), para as réplicas de leitura.
// Sem bindings aqui: o `src/server.ts` cria a sessão e este arquivo guarda,
// valida e entrega. Quem lê a sessão é `getDb` (src/db/index.ts).
//
// A sessão vive num AsyncLocalStorage, que é POR PEDIDO. Nunca guarde a sessão
// numa variável de módulo: um isolate atende vários pedidos e a sessão de um
// vazaria para o outro (mesmo problema do React.lazy descrito no AGENTS.md).
import { AsyncLocalStorage } from 'node:async_hooks'

export const D1_BOOKMARK_COOKIE = 'd1-bookmark'
const BOOKMARK_MAX_AGE = 60 * 60

// Os bookmarks do D1 são grupos de hexadecimal separados por hífen
// (ex.: 00000085-0000024c-00004c6d-8e61117b...). O valor vem do cookie, ou seja,
// do cliente: só aceitamos esse formato, com tamanho limitado.
const BOOKMARK_FORMAT = /^[0-9a-f]{1,16}(?:-[0-9a-f]{1,64}){1,5}$/i

export function isValidBookmark(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length <= 160 &&
    BOOKMARK_FORMAT.test(value)
  )
}

/** Lê o bookmark do cookie `d1-bookmark`; inválido ou ausente vira `undefined`. */
export function bookmarkFromRequest(request: Request): string | undefined {
  const header = request.headers.get('cookie')
  if (!header) return undefined
  for (const part of header.split(';')) {
    const index = part.indexOf('=')
    if (index === -1) continue
    if (part.slice(0, index).trim() !== D1_BOOKMARK_COOKIE) continue
    const value = part.slice(index + 1).trim()
    return isValidBookmark(value) ? value : undefined
  }
  return undefined
}

/** O `Set-Cookie` que guarda o bookmark (Secure só fora do localhost). */
export function bookmarkCookie(bookmark: string, request: Request): string {
  const secure = new URL(request.url).protocol === 'https:'
  return `${D1_BOOKMARK_COOKIE}=${bookmark}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${BOOKMARK_MAX_AGE}${secure ? '; Secure' : ''}`
}

// O que `getDb` precisa da sessão: o mesmo que o Drizzle usa do D1 (prepare/batch).
export type RequestD1Session = Pick<D1DatabaseSession, 'prepare' | 'batch'> & {
  getBookmark(): string | null
}

const storage = new AsyncLocalStorage<RequestD1Session>()

/** Roda `fn` com a sessão D1 deste pedido: todo `getDb` lá dentro a usa. */
export function runWithD1Session<T>(session: RequestD1Session, fn: () => T): T {
  return storage.run(session, fn)
}

/** A sessão D1 do pedido atual, ou `undefined` fora de um pedido (cron, testes). */
export function currentD1Session(): RequestD1Session | undefined {
  return storage.getStore()
}

/**
 * Devolve a resposta com o bookmark da sessão no cookie, para a próxima página
 * de quem acabou de escrever ler a própria escrita. Recria a Response (os
 * headers podem ser imutáveis) e preserva o 101 de WebSocket.
 */
export function withD1Bookmark(
  res: Response,
  session: RequestD1Session,
  request: Request,
): Response {
  const bookmark = session.getBookmark()
  if (!bookmark || res.status === 101) return res
  const headers = new Headers(res.headers)
  headers.append('Set-Cookie', bookmarkCookie(bookmark, request))
  return new Response(res.body, {
    status: res.status,
    statusText: res.statusText,
    headers,
  })
}
