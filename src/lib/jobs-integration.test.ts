import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { runJobs } from '#/lib/jobs'
import { createAuthHarness } from '#/test/auth-harness'

const DAY = 86_400_000
let h: Awaited<ReturnType<typeof createAuthHarness>>

beforeAll(async () => {
  h = await createAuthHarness()
}, 60_000)
afterAll(() => h?.dispose())

async function addUser(opts: {
  id: string
  verified: boolean
  ageDays: number
  provider?: string
  deletedDaysAgo?: number
}) {
  const created = Date.now() - opts.ageDays * DAY
  await h.db
    .prepare(
      'insert into user (id, name, email, email_verified, created_at, updated_at, deleted_at) values (?, ?, ?, ?, ?, ?, ?)',
    )
    .bind(
      opts.id,
      opts.id,
      `${opts.id}@exemplo.test`,
      opts.verified ? 1 : 0,
      created,
      created,
      opts.deletedDaysAgo ? Date.now() - opts.deletedDaysAgo * DAY : null,
    )
    .run()
  if (opts.provider) {
    await h.db
      .prepare(
        'insert into account (id, account_id, provider_id, user_id, created_at, updated_at) values (?, ?, ?, ?, ?, ?)',
      )
      .bind(`acc-${opts.id}`, opts.id, opts.provider, opts.id, created, created)
      .run()
  }
}

const exists = async (id: string) =>
  (await h.db.prepare('select id from user where id = ?').bind(id).first()) !==
  null

describe('job conta.apagar-social-nao-verificada', () => {
  it('apaga só o usuário social, não verificado, com mais de 7 dias', async () => {
    await addUser({
      id: 'velho-social',
      verified: false,
      ageDays: 8,
      provider: 'google',
    })
    await addUser({
      id: 'novo-social',
      verified: false,
      ageDays: 2,
      provider: 'google',
    })
    await addUser({
      id: 'verificado-social',
      verified: true,
      ageDays: 30,
      provider: 'github',
    })
    await addUser({
      id: 'velho-senha',
      verified: false,
      ageDays: 30,
      provider: 'credential',
    })
    await addUser({ id: 'velho-codigo', verified: false, ageDays: 30 })

    vi.spyOn(console, 'log').mockImplementation(() => {})
    const result = await runJobs(h.env)
    expect(result['conta.apagar-social-nao-verificada']).toBe('ok')

    expect(await exists('velho-social')).toBe(false)
    expect(await exists('novo-social')).toBe(true)
    expect(await exists('verificado-social')).toBe(true)
    expect(await exists('velho-senha')).toBe(true)
    expect(await exists('velho-codigo')).toBe(true)
    // a conta vinculada some junto (cascata)
    expect(
      await h.db
        .prepare('select id from account where id = ?')
        .bind('acc-velho-social')
        .first(),
    ).toBeNull()
  })

  it('é idempotente: rodar de novo não apaga mais nada', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    await runJobs(h.env)
    expect(await exists('novo-social')).toBe(true)
  })
})

describe('job conta.apagar-encerradas', () => {
  it('apaga a conta encerrada há mais de 7 dias e mantém a mais recente', async () => {
    await addUser({
      id: 'enc-velha',
      verified: true,
      ageDays: 30,
      deletedDaysAgo: 8,
    })
    await addUser({
      id: 'enc-nova',
      verified: true,
      ageDays: 30,
      deletedDaysAgo: 2,
    })
    vi.spyOn(console, 'log').mockImplementation(() => {})
    await runJobs(h.env)
    expect(await exists('enc-velha')).toBe(false)
    expect(await exists('enc-nova')).toBe(true)
  })

  it('conta restaurada no meio do caminho não é apagada (deletedAt reconferido)', async () => {
    await addUser({
      id: 'enc-restaurada',
      verified: true,
      ageDays: 30,
      deletedDaysAgo: 8,
    })
    // O suporte restaura DEPOIS da consulta do job e ANTES do delete: o
    // gancho `onBeforeAccountDelete` roda exatamente entre as duas coisas.
    const { onBeforeAccountDelete } = await import('#/lib/account')
    onBeforeAccountDelete('teste-restaura', async (ref) => {
      if (ref.id !== 'enc-restaurada') return
      await h.db
        .prepare('update user set deleted_at = NULL where id = ?')
        .bind(ref.id)
        .run()
    })
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    await runJobs(h.env)
    expect(await exists('enc-restaurada')).toBe(true)
    expect(log).toHaveBeenCalledWith(
      expect.stringMatching(/conta\.apagar-encerradas: apagadas=0 mantidas=1/),
    )
  })
})
