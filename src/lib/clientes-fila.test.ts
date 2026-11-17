// Meta do template: uma rota de leitura faz no máximo 2 consultas em fila ao
// D1 (cada nível em fila custa uma viagem de rede até o banco). Este é o molde:
// a lista de clientes, com o Better Auth de verdade e o D1 com atraso
// artificial (src/test/d1-fila.ts). Rota de leitura nova copia este teste.
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { createAuthHarness } from '#/test/auth-harness'
import { medirFila } from '#/test/d1-fila'

let h: Awaited<ReturnType<typeof createAuthHarness>>
let cookieSemCache: string
let cookieComCache: string
let pedido: Request | undefined

// `getRequest()` é do TanStack Start (só existe dentro de um pedido): aqui
// devolve o pedido que o teste montou, com o cookie de sessão.
vi.mock('@tanstack/react-start/server', () => ({
  getRequest: () => pedido,
}))

beforeAll(async () => {
  h = await createAuthHarness()
  const { cookie } = await h.signIn('fila@exemplo.test')
  cookieComCache = cookie
  // Sem o `better-auth.session_data` (o cache de 60 s): o pior caso, em que a
  // sessão é lida do D1.
  cookieSemCache = cookie
    .split('; ')
    .filter((c) => !c.startsWith('better-auth.session_data'))
    .join('; ')
}, 60_000)
afterAll(() => h?.dispose())

describe('lista de clientes: consultas em fila', () => {
  it('no máximo 2 em fila, mesmo com o banco lento', async () => {
    const { listarClientes } = await import('#/lib/clientes-server')
    pedido = new Request('http://localhost:3000/app/clientes', {
      headers: { cookie: cookieSemCache },
    })
    const { resultado, filaMax, consultas } = await medirFila(h.env.DB, () =>
      listarClientes(),
    )
    expect(resultado).toEqual([])
    expect(filaMax, `consultas: ${consultas.join(' | ')}`).toBeLessThanOrEqual(
      2,
    )
  })

  it('com o cache da sessão em cookie, só a consulta da página', async () => {
    const { listarClientes } = await import('#/lib/clientes-server')
    pedido = new Request('http://localhost:3000/app/clientes', {
      headers: { cookie: cookieComCache },
    })
    const { total, filaMax } = await medirFila(h.env.DB, () => listarClientes())
    expect(filaMax).toBe(1)
    expect(total).toBe(1)
  })
})
