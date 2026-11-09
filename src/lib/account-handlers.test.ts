import { env } from 'cloudflare:workers'
import { describe, expect, it, vi } from 'vitest'

import { auditLog } from '#/db/schema'
import { fakeDb } from '#/test/fake-db'

const state = vi.hoisted(() => ({ db: undefined as unknown }))
vi.mock('#/db/index', () => ({ getDb: () => state.db }))

import '#/lib/account-handlers'
import { runBeforeAccountDelete } from '#/lib/account'

describe('limpeza da auditoria ao apagar a conta', () => {
  it('tira e-mail, IP e navegador da trilha (e só isso)', async () => {
    const { db, calls } = fakeDb()
    state.db = db
    Object.assign(env, { BUCKET: { delete: vi.fn(async () => {}) } })

    await runBeforeAccountDelete({ id: 'u1', email: 'ana@exemplo.com' })

    const update = calls.find(
      ([method, args]) => method === 'update' && args[0] === auditLog,
    )
    expect(update).toBeDefined()
    const set = calls.find(([method]) => method === 'set')
    expect(set?.[1][0]).toEqual({
      actorEmail: null,
      ip: null,
      userAgent: null,
    })
  })
})
