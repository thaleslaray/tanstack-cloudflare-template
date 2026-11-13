import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  ACCOUNT_RETENTION_DAYS,
  AccountDeletionBlocked,
  accountPhase,
  closeOutcome,
  collectAccountExport,
  onAccountDeletionGuard,
  onAccountExport,
  onBeforeAccountDelete,
  PURGE_REMINDER_DAY,
  purgeCutoff,
  purgeDateFor,
  reminderCutoff,
  reminderDue,
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

describe('accountPhase', () => {
  const now = new Date('2026-11-20T03:00:00Z')
  const closedDaysAgo = (days: number, extraMs = 0) =>
    new Date(now.getTime() - days * DAY - extraMs)
  const row = (
    deletedAt: Date | null,
    purgeRemindedAt: Date | null = null,
  ) => ({
    deletedAt,
    purgeRemindedAt,
  })

  it('sem deletedAt é ativa, mesmo com purgeRemindedAt preenchido', () => {
    expect(accountPhase(row(null), now)).toEqual({ k: 'active' })
    expect(accountPhase(row(null, now), now)).toEqual({ k: 'active' })
  })

  it('dia 4 e dia 5: encerrada, sem lembrete ainda', () => {
    for (const days of [4, 5]) {
      const deletedAt = closedDaysAgo(days)
      expect(accountPhase(row(deletedAt), now)).toEqual({
        k: 'closed',
        purgeAt: purgeDateFor(deletedAt),
      })
    }
  })

  it('dia 6 com lembrete enviado: reminded; sem lembrete: ainda closed', () => {
    const deletedAt = closedDaysAgo(6)
    expect(accountPhase(row(deletedAt, now), now)).toEqual({
      k: 'reminded',
      purgeAt: purgeDateFor(deletedAt),
    })
    expect(accountPhase(row(deletedAt), now).k).toBe('closed')
  })

  it('dia 7 exato ainda não é due (o job usa <); 1 ms depois é', () => {
    expect(accountPhase(row(closedDaysAgo(7), now), now).k).toBe('reminded')
    expect(accountPhase(row(closedDaysAgo(7, 1), now), now)).toEqual({
      k: 'due',
    })
  })

  it('dia 8 é due, com ou sem lembrete', () => {
    expect(accountPhase(row(closedDaysAgo(8)), now)).toEqual({ k: 'due' })
    expect(accountPhase(row(closedDaysAgo(8), now), now)).toEqual({ k: 'due' })
  })

  it('purgeAt bate com purgeDateFor', () => {
    const deletedAt = closedDaysAgo(2)
    const phase = accountPhase(row(deletedAt), now)
    expect(phase.k === 'closed' && phase.purgeAt.getTime()).toBe(
      deletedAt.getTime() + 7 * DAY,
    )
  })
})

describe('reminderDue (a regra da consulta do job)', () => {
  const now = new Date('2026-11-20T03:00:00Z')
  const at = (days: number, extraMs = 0) =>
    new Date(now.getTime() - days * DAY - extraMs)

  it('só entre o dia 5 e o dia 7, e uma vez', () => {
    expect(reminderDue({ deletedAt: at(4), purgeRemindedAt: null }, now)).toBe(
      false,
    )
    // No instante exato do dia 5 ainda não (comparação estrita, como no job).
    expect(reminderDue({ deletedAt: at(5), purgeRemindedAt: null }, now)).toBe(
      false,
    )
    expect(
      reminderDue({ deletedAt: at(5, 1), purgeRemindedAt: null }, now),
    ).toBe(true)
    expect(reminderDue({ deletedAt: at(6), purgeRemindedAt: null }, now)).toBe(
      true,
    )
    expect(reminderDue({ deletedAt: at(7), purgeRemindedAt: null }, now)).toBe(
      true,
    )
    expect(reminderDue({ deletedAt: at(8), purgeRemindedAt: null }, now)).toBe(
      false,
    )
    expect(reminderDue({ deletedAt: at(6), purgeRemindedAt: now }, now)).toBe(
      false,
    )
    expect(reminderDue({ deletedAt: null, purgeRemindedAt: null }, now)).toBe(
      false,
    )
  })
})

describe('closeOutcome (pedidos simultâneos ao encerrar)', () => {
  const now = new Date('2026-11-20T03:00:00Z')

  it('1 linha mudada: este pedido encerrou, prazo a partir de agora', () => {
    expect(closeOutcome(1, null, now)).toEqual({
      first: true,
      purgeAt: purgeDateFor(now),
    })
  })

  it('0 linhas: não é o primeiro e o prazo vem do deletedAt já gravado', () => {
    const stored = new Date('2026-11-20T02:59:59Z')
    expect(closeOutcome(0, stored, now)).toEqual({
      first: false,
      purgeAt: purgeDateFor(stored),
    })
  })

  it('0 linhas e nada gravado (conta sumiu): não audita, prazo de agora', () => {
    expect(closeOutcome(0, null, now)).toEqual({
      first: false,
      purgeAt: purgeDateFor(now),
    })
  })
})
