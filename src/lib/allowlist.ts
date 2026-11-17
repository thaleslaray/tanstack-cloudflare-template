// Cadastro só para e-mails liberados (módulo puro, sem bindings). O interruptor
// é `appConfig.accessMode` em src/config/app.ts: 'open' (qualquer e-mail entra,
// o padrão) ou 'allowlist' (só a lista). No modo lista, a lista é o segredo
// `ACCESS_ALLOWLIST` (e-mails separados por vírgula). Falha FECHADA: lista
// vazia ou ausente = ninguém entra.
import { appConfig } from '#/config/app'

export type AccessMode = 'open' | 'allowlist'

/** E-mail comparável: sem espaços nas pontas, em minúsculas. */
export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase()
}

/** Lê o segredo em um conjunto de e-mails normalizados (ignora vazios). */
export function parseAllowlist(raw: unknown): Set<string> {
  if (typeof raw !== 'string') return new Set()
  return new Set(raw.split(',').map(normalizeEmail).filter(Boolean))
}

// Padrão aceito SÓ no servidor dos testes e2e (veja `e2eAccessEnabled`):
// `qa-<qualquer coisa>@exemplo.test`, o domínio reservado que o e2e usa.
const QA_EMAIL = /^qa-[^@\s,]+@exemplo\.test$/

/**
 * Liga o padrão `qa-*@exemplo.test`. Só vale no `vite dev` iniciado pelo
 * Playwright (`VITE_E2E_SEM_LIMITE=1`): `import.meta.env.DEV` é falso no build
 * de produção, então o padrão nunca existe lá.
 */
export function e2eAccessEnabled(): boolean {
  return import.meta.env.DEV && import.meta.env.VITE_E2E_SEM_LIMITE === '1'
}

/**
 * O e-mail está na lista? `qaPattern` acrescenta o padrão dos testes e2e
 * (passe `e2eAccessEnabled()`); sem ele só vale a lista. Não olha o modo:
 * quem decide se a lista vale é `hasAccess`.
 */
export function isEmailAllowed(
  email: unknown,
  rawList: unknown,
  { qaPattern = false }: { qaPattern?: boolean } = {},
): boolean {
  if (typeof email !== 'string') return false
  const normalized = normalizeEmail(email)
  if (!normalized) return false
  if (parseAllowlist(rawList).has(normalized)) return true
  return qaPattern && QA_EMAIL.test(normalized)
}

/**
 * A decisão que o app usa: este e-mail pode receber código, criar conta e
 * manter sessão? No modo 'open' sempre; no modo 'allowlist' só se estiver na
 * lista (`env.ACCESS_ALLOWLIST`) ou, no servidor dos e2e, bater o padrão `qa-`.
 */
export function hasAccess(
  email: unknown,
  rawList: unknown,
  mode: AccessMode = appConfig.accessMode,
): boolean {
  if (mode === 'open') return true
  return isEmailAllowed(email, rawList, { qaPattern: e2eAccessEnabled() })
}
