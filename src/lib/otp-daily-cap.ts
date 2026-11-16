// Teto diário GLOBAL de pedidos de código por e-mail (somente servidor).
// O limite por IP e por e-mail (auth-rate-limit.ts) não impede quem usa um IP
// com destinatários diferentes: ~7.200 e-mails por dia esgotariam a cota do
// provedor. O binding de rate limit só aceita períodos de 10 ou 60 segundos,
// então o contador diário fica no D1 (tabela `otp_diario`, uma linha por dia UTC).
import { env } from 'cloudflare:workers'
import { sql } from 'drizzle-orm'

import { getDb } from '#/db/index'
import { otpDiario } from '#/db/schema'

/** Teto padrão por dia. A variável `OTP_DAILY_LIMIT` troca; `0` desliga o teto. */
export const OTP_DAILY_LIMIT_DEFAULT = 100

export function otpDailyLimit(raw: unknown = env.OTP_DAILY_LIMIT): number {
  if (typeof raw !== 'string' || raw.trim() === '')
    return OTP_DAILY_LIMIT_DEFAULT
  const n = Number(raw)
  return Number.isInteger(n) && n >= 0 ? n : OTP_DAILY_LIMIT_DEFAULT
}

/** Dia UTC no formato `AAAA-MM-DD`. */
export function otpDay(now = new Date()): string {
  return now.toISOString().slice(0, 10)
}

/**
 * Conta este pedido e devolve true se o teto do dia já foi atingido (o
 * pedido acima do teto não deve mandar e-mail). Falha ABERTA: sem D1 ou com
 * erro, passa (um contador com defeito não pode derrubar o login).
 */
export async function otpDailyCapReached(now = new Date()): Promise<boolean> {
  // Mesmo desligamento só-do-Playwright dos outros limites (some do build de produção).
  if (import.meta.env.DEV && import.meta.env.VITE_E2E_SEM_LIMITE === '1')
    return false
  const limit = otpDailyLimit()
  if (limit === 0 || !env.DB) return false
  try {
    const [row] = await getDb(env.DB)
      .insert(otpDiario)
      .values({ dia: otpDay(now), total: 1 })
      .onConflictDoUpdate({
        target: otpDiario.dia,
        set: { total: sql`${otpDiario.total} + 1` },
      })
      .returning({ total: otpDiario.total })
    return (row?.total ?? 0) > limit
  } catch (error) {
    console.error('[otp-cap] falha ao contar o pedido (liberado):', error)
    return false
  }
}
