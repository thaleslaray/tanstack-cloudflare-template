import { afterEach, describe, expect, it, vi } from 'vitest'

import { auditLog } from '#/db/schema'
import { fakeDb } from '#/test/fake-db'

const state = vi.hoisted(() => ({ db: undefined as unknown }))
vi.mock('#/db/index', () => ({ getDb: () => state.db }))

import { AUDIT_RETENTION_DAYS, auditCutoff, runJobs } from '#/lib/jobs'

const DAY = 86_400_000

afterEach(() => vi.restoreAllMocks())

describe('auditCutoff', () => {
  it('guarda 180 dias', () => {
    expect(AUDIT_RETENTION_DAYS).toBe(180)
  })

  it('o corte é "agora" menos 180 dias', () => {
    const now = new Date('2026-11-08T03:00:00Z')
    expect(auditCutoff(now).getTime()).toBe(now.getTime() - 180 * DAY)
  })
})

describe('job auditoria.retencao', () => {
  it('apaga de audit_log e devolve apagadas=N', async () => {
    const { db, calls } = fakeDb({ changes: 7 })
    state.db = db
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    const result = await runJobs({ DB: {} } as unknown as Env)
    expect(result['auditoria.retencao']).toBe('ok')
    expect(log).toHaveBeenCalledWith('[jobs] auditoria.retencao: apagadas=7')
    const deletes = calls.filter(([m]) => m === 'delete')
    expect(deletes.some(([, args]) => args[0] === auditLog)).toBe(true)
  })

  it('sem nada vencido, apagadas=0 (idempotente)', async () => {
    const { db } = fakeDb({ changes: 0 })
    state.db = db
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    await runJobs({ DB: {} } as unknown as Env)
    await runJobs({ DB: {} } as unknown as Env)
    expect(log).toHaveBeenCalledWith('[jobs] auditoria.retencao: apagadas=0')
  })
})
