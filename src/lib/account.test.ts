import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  ACCOUNT_RETENTION_DAYS,
  AccountDeletionBlocked,
  collectAccountExport,
  onAccountDeletionGuard,
  onAccountExport,
  onBeforeAccountDelete,
  PURGE_REMINDER_DAY,
  purgeCutoff,
  purgeDateFor,
  reminderCutoff,
  resetAccountHandlers,
  runAccountDeletionGuards,
  runBeforeAccountDelete,
} from '#/lib/account'

const ana = { id: 'u1', email: 'ana@exemplo.com' }
const DAY = 86_400_000

afterEach(() => resetAccountHandlers())

describe('hooks de encerramento', () => {
  it('sem nada registrado, tudo passa e o export sai vazio', async () => {
    await expect(runAccountDeletionGuards(ana)).resolves.toBeUndefined()
    await expect(runBeforeAccountDelete(ana)).resolves.toBeUndefined()
    expect(await collectAccountExport(ana)).toEqual({})
  })

  it('um guard pode bloquear o encerramento com mensagem própria', async () => {
    onAccountDeletionGuard('assinatura', async () => {
      throw new AccountDeletionBlocked('Cancele a assinatura antes.')
    })
    await expect(runAccountDeletionGuards(ana)).rejects.toThrow(
      'Cancele a assinatura antes.',
    )
  })

  it('limpezas recebem a conta e rodam na ordem de registro', async () => {
    const order: string[] = []
    onBeforeAccountDelete('a', async (u) => {
      order.push(`a:${u.id}`)
    })
    onBeforeAccountDelete('b', async (u) => {
      order.push(`b:${u.id}`)
    })
    await runBeforeAccountDelete(ana)
    expect(order).toEqual(['a:u1', 'b:u1'])
  })

  it('registrar de novo com o mesmo nome substitui', async () => {
    const first = vi.fn(async () => {})
    const second = vi.fn(async () => {})
    onBeforeAccountDelete('avatar', first)
    onBeforeAccountDelete('avatar', second)
    await runBeforeAccountDelete(ana)
    expect(first).not.toHaveBeenCalled()
    expect(second).toHaveBeenCalledOnce()
  })

  it('cada módulo contribui sua fatia no "baixar meus dados"', async () => {
    onAccountExport('conta', async (u) => ({ email: u.email }))
    onAccountExport('foto', async () => null)
    expect(await collectAccountExport(ana)).toEqual({
      conta: { email: 'ana@exemplo.com' },
      foto: null,
    })
  })
})

describe('prazos', () => {
  const now = new Date('2026-11-07T03:00:00Z')

  it('apaga 7 dias depois de encerrar; lembra no dia 5', () => {
    expect(ACCOUNT_RETENTION_DAYS).toBe(7)
    expect(PURGE_REMINDER_DAY).toBe(5)
    expect(purgeDateFor(now).getTime() - now.getTime()).toBe(7 * DAY)
    expect(now.getTime() - purgeCutoff(now).getTime()).toBe(7 * DAY)
    expect(now.getTime() - reminderCutoff(now).getTime()).toBe(5 * DAY)
  })

  it('a janela do lembrete fica entre o dia 5 e o dia 7', () => {
    expect(reminderCutoff(now) > purgeCutoff(now)).toBe(true)
  })
})
