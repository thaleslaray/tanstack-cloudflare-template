// Ciclo de vida da conta: o que cada módulo faz quando alguém encerra a conta
// ou pede "baixar meus dados". Arquivo sem bindings: só registros e regras.
// Quem registra: src/lib/account-handlers.ts (importado pelo src/server.ts).
//
// Encerrar a conta acontece em DUAS FASES:
//   1. Encerrar (o usuário pede, em /conta): a conta recebe `deletedAt`, todas
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

/** Apaga todos os registros (só para testes). */
export function resetAccountHandlers() {
  guards.clear()
  beforeDelete.clear()
  exporters.clear()
}
