// Ciclo de vida da conta: o que cada módulo faz quando alguém encerra a conta
// ou pede "baixar meus dados". Arquivo sem bindings: só registros e regras.
// Quem registra: src/lib/account-handlers.ts (importado pelo src/server.ts).
//
// Encerrar a conta acontece em DUAS FASES:
//   1. Encerrar (o usuário pede, em /app/configuracoes): a conta recebe `deletedAt`, todas
//      as sessões caem e ela não entra mais. As linhas ficam guardadas por
//      ACCOUNT_RETENTION_DAYS dias, para o suporte rastrear ou restaurar.
//      Aqui rodam só os GUARDS (`onAccountDeletionGuard`).
//   2. Apagar de vez (o cron, depois do prazo): guards de novo, depois as
//      limpezas fora do D1 (`onBeforeAccountDelete`, ex.: a foto no R2), e por
//      fim a linha do usuário (sessões e contas vinculadas vão em cascata).
//
// Linhas do D1 com chave estrangeira para `user` (onDelete: 'cascade') somem
// sozinhas. Os hooks são para o que NÃO some: objetos no R2, serviços externos.

/** Dias entre encerrar e apagar de vez. */
export const ACCOUNT_RETENTION_DAYS = 7
/** Em que dia depois de encerrar sai o lembrete por e-mail. */
export const PURGE_REMINDER_DAY = 5

const DAY_MS = 86_400_000

export type AccountRef = { id: string; email: string }
type Handler = (user: AccountRef) => Promise<void>
type ExportHandler = (user: AccountRef) => Promise<unknown>

// Map por nome: se o módulo rodar de novo (HMR no dev), substitui sem duplicar.
const guards = new Map<string, Handler>()
const beforeDelete = new Map<string, Handler>()
const exporters = new Map<string, ExportHandler>()

/** Erro de guard: a mensagem chega ao usuário como está (escreva em pt-BR). */
export class AccountDeletionBlocked extends Error {
  readonly code = 'ACCOUNT_DELETION_BLOCKED'
}

/**
 * Pode IMPEDIR o encerramento: lance `new AccountDeletionBlocked('...')`.
 * Roda ao encerrar e de novo antes de apagar (algo pode ter aberto no meio).
 * Só confere, não destrói: a conta ainda pode ser restaurada.
 */
export function onAccountDeletionGuard(name: string, handler: Handler) {
  guards.set(name, handler)
}

/**
 * Limpeza fora do D1, na hora de apagar de vez, ANTES de a linha do usuário
 * sumir (ex.: apagar `avatars/<id>` no R2). Erro aqui adia a exclusão para a
 * próxima noite, sem perder nada.
 */
export function onBeforeAccountDelete(name: string, handler: Handler) {
  beforeDelete.set(name, handler)
}

/** A fatia de um módulo no JSON de "baixar meus dados", na chave `name`. */
export function onAccountExport(name: string, handler: ExportHandler) {
  exporters.set(name, handler)
}

export async function runAccountDeletionGuards(user: AccountRef) {
  for (const handler of guards.values()) await handler(user)
}

export async function runBeforeAccountDelete(user: AccountRef) {
  for (const handler of beforeDelete.values()) await handler(user)
}

export async function collectAccountExport(user: AccountRef) {
  const out: Record<string, unknown> = {}
  for (const [name, handler] of exporters) out[name] = await handler(user)
  return out
}

/** Quando uma conta encerrada em `deletedAt` será apagada de vez. */
export function purgeDateFor(deletedAt: Date): Date {
  return new Date(deletedAt.getTime() + ACCOUNT_RETENTION_DAYS * DAY_MS)
}

/** Contas encerradas ANTES deste instante já passaram do prazo: apagar. */
export function purgeCutoff(now: Date): Date {
  return new Date(now.getTime() - ACCOUNT_RETENTION_DAYS * DAY_MS)
}

/** Contas encerradas antes deste instante já estão no dia do lembrete. */
export function reminderCutoff(now: Date): Date {
  return new Date(now.getTime() - PURGE_REMINDER_DAY * DAY_MS)
}

/**
 * Em que fase do ciclo uma conta está (as duas fases do topo deste arquivo):
 *
 *   active --encerrar--> closed --lembrete (dia 5)--> reminded --prazo (dia 7)--> due
 *
 * - `active`: sem `deletedAt`. (`purgeRemindedAt` preenchido não muda nada:
 *   quem restaura a conta zera só `deletedAt`, e ela volta a ser ativa.)
 * - `closed`: encerrada, ainda sem lembrete enviado; `purgeAt` é a data de apagar.
 * - `reminded`: encerrada e o lembrete do dia 5 já saiu.
 * - `due`: passou do prazo, o cron apaga na próxima noite.
 */
export type AccountPhase =
  | { k: 'active' }
  | { k: 'closed'; purgeAt: Date }
  | { k: 'reminded'; purgeAt: Date }
  | { k: 'due' }

type AccountRow = { deletedAt: Date | null; purgeRemindedAt: Date | null }

/**
 * A fase de uma conta agora. Usa as MESMAS funções de corte que os jobs
 * (src/lib/jobs.ts), com a mesma comparação (`<` estrito): no instante exato
 * do prazo a conta ainda não está `due`.
 */
export function accountPhase(row: AccountRow, now: Date): AccountPhase {
  if (!row.deletedAt) return { k: 'active' }
  if (row.deletedAt < purgeCutoff(now)) return { k: 'due' }
  const purgeAt = purgeDateFor(row.deletedAt)
  return row.purgeRemindedAt
    ? { k: 'reminded', purgeAt }
    : { k: 'closed', purgeAt }
}

/**
 * O job `conta.lembrar-exclusao` deve mandar o lembrete desta conta agora?
 * Mesma regra da consulta do job: já passou do dia 5, ainda não do prazo e
 * o lembrete ainda não saiu.
 */
export function reminderDue(row: AccountRow, now: Date): boolean {
  const { deletedAt } = row
  if (!deletedAt || row.purgeRemindedAt) return false
  return deletedAt < reminderCutoff(now) && deletedAt >= purgeCutoff(now)
}

/**
 * Decide o que fazer depois do update condicional do encerramento
 * (`where deletedAt is null`). `changed` é quantas linhas ele mudou:
 * - 1: este pedido encerrou a conta (`first`: audita e manda o e-mail);
 * - 0: outro pedido chegou antes. Responde igual, com o prazo calculado do
 *   `deletedAt` JÁ gravado, e NÃO audita nem manda e-mail de novo.
 */
export function closeOutcome(
  changed: number,
  storedDeletedAt: Date | null,
  now: Date,
): { first: boolean; purgeAt: Date } {
  if (changed > 0 || !storedDeletedAt) {
    return { first: changed > 0, purgeAt: purgeDateFor(now) }
  }
  return { first: false, purgeAt: purgeDateFor(storedDeletedAt) }
}

/** Apaga todos os registros (só para testes). */
export function resetAccountHandlers() {
  guards.clear()
  beforeDelete.clear()
  exporters.clear()
}
