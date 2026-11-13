// Falhas de login em um lugar só: o erro cru do servidor entra, uma falha com
// nome sai, e a mensagem em pt-BR vem daqui. Os formulários de login nunca
// mostram `error.message` do servidor (vem em inglês e pode revelar detalhe).
// Arquivo puro (sem bindings): roda no navegador e nos testes.

export type AuthFailure =
  | 'rate_limited'
  | 'invalid_otp'
  | 'otp_expired'
  | 'too_many_attempts'
  | 'account_closed'
  | 'email_not_verified'
  | 'invalid_credentials'
  | 'unknown'

/** Em que passo a falha aconteceu: muda o texto só nos casos sem causa clara. */
export type AuthContext =
  | 'enviar'
  | 'reenviar'
  | 'verificar'
  | 'entrar'
  | 'criar'

// Forma mínima do erro do cliente do Better Auth (`{ status, code, message }`).
type RawError = { status?: number; code?: string } | null | undefined

const BY_CODE: Record<string, AuthFailure> = {
  OTP_EXPIRED: 'otp_expired',
  INVALID_OTP: 'invalid_otp',
  TOO_MANY_ATTEMPTS: 'too_many_attempts',
  ACCOUNT_CLOSED: 'account_closed',
  EMAIL_NOT_VERIFIED: 'email_not_verified',
  INVALID_EMAIL_OR_PASSWORD: 'invalid_credentials',
}

/** Traduz o erro do servidor (ou de rede) numa falha com nome. */
export function toAuthFailure(err: unknown): AuthFailure {
  const raw = (typeof err === 'object' ? err : null) as RawError
  if (!raw) return 'unknown'
  // 429 vem do nosso limite (texto puro, sem `code`) ou do limite do Better Auth.
  if (raw.status === 429) return 'rate_limited'
  return (raw.code && BY_CODE[raw.code]) || 'unknown'
}

const UNKNOWN: Record<AuthContext, string> = {
  enviar: 'Não foi possível enviar o código. Confira o e-mail e tente de novo.',
  reenviar: 'Não foi possível reenviar o código. Tente de novo.',
  verificar: 'Não deu certo. Tente de novo em instantes.',
  entrar: 'Não deu certo. Tente de novo em instantes.',
  criar: 'Não foi possível criar a conta.',
}

/** A mensagem em pt-BR para a pessoa. `contexto` só afeta o caso `unknown`. */
export function authFailureMessage(
  failure: AuthFailure,
  contexto: AuthContext,
): string {
  switch (failure) {
    case 'rate_limited':
      return 'Muitas tentativas. Espere um minuto e tente de novo.'
    case 'otp_expired':
      return 'Este código expirou. Peça um novo.'
    case 'invalid_otp':
      return 'Código incorreto. Confira e tente de novo.'
    case 'too_many_attempts':
      return 'Muitas tentativas erradas. Peça um novo código.'
    case 'account_closed':
      return 'Esta conta foi encerrada e será apagada em breve. Para recuperá-la, fale com o suporte.'
    case 'email_not_verified':
      return 'Confirme seu e-mail para entrar.'
    case 'invalid_credentials':
      return 'E-mail ou senha incorretos.'
    case 'unknown':
      return UNKNOWN[contexto]
  }
}
