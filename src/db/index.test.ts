import { describe, expect, it, vi } from 'vitest'

import { type RequestD1Session, runWithD1Session } from './d1-session'
import { getDb } from './index'

// O Drizzle chama `prepare` ao montar a consulta; quem recebe a chamada diz
// qual "banco" o getDb escolheu.
function stub(name: string) {
  const prepare = vi.fn(() => {
    throw new Error(`usou ${name}`)
  })
  return { prepare, batch: vi.fn(), getBookmark: () => null, exec: vi.fn() }
}

describe('getDb', () => {
  it('fora de um pedido usa o D1 direto (primário)', () => {
    const d1 = stub('d1')
    expect(() =>
      (getDb(d1 as unknown as D1Database).$client as D1Database).prepare('x'),
    ).toThrow('usou d1')
  })

  it('dentro de um pedido usa a sessão D1', () => {
    const d1 = stub('d1')
    const session = stub('sessão')
    runWithD1Session(session as unknown as RequestD1Session, () => {
      expect(() =>
        (getDb(d1 as unknown as D1Database).$client as D1Database).prepare('x'),
      ).toThrow('usou sessão')
    })
    expect(d1.prepare).not.toHaveBeenCalled()
  })
})
