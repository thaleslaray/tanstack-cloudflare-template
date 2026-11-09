// Pedaços de configuração do Better Auth que não dependem de bindings.
// Ficam num arquivo à parte para poderem ser testados sem subir o Better Auth.

// String vazia (ou só espaços) conta como ausente.
export function present(value: string | undefined): value is string {
  return Boolean(value?.trim())
}

/** Segredo que assina os cookies: vazio ou curto demais deixa a sessão forjável. */
export function assertAuthSecret(value: string | undefined): void {
  if (!value?.trim() || value.trim().length < 32) {
    throw new Error(
      'BETTER_AUTH_SECRET ausente ou curto demais (mínimo 32 caracteres). Gere com: openssl rand -base64 32',
    )
  }
}

/** Login com senha é opcional: só liga com PASSWORD_LOGIN_ENABLED=true (ou 1). */
export function passwordEnabled(env: {
  PASSWORD_LOGIN_ENABLED?: string
}): boolean {
  const value = env.PASSWORD_LOGIN_ENABLED?.trim().toLowerCase()
  return value === 'true' || value === '1'
}

/** True para localhost, 127.x, [::1] e *.localhost (desenvolvimento). */
export function isLocalUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.replace(/^\[|\]$/g, '').toLowerCase()
    return (
      host === 'localhost' ||
      host.endsWith('.localhost') ||
      host === '::1' ||
      host.startsWith('127.')
    )
  } catch {
    return false
  }
}

/**
 * A URL do app: a variável BETTER_AUTH_URL (se preenchida) ou, sem ela, a
 * origem da requisição. Sem nenhuma das duas devolve `undefined`.
 */
export function resolveBaseURL(
  envUrl: string | undefined,
  request?: Request,
): string | undefined {
  if (present(envUrl)) return envUrl.trim()
  if (request) {
    try {
      return new URL(request.url).origin
    } catch {
      return undefined
    }
  }
  return undefined
}

// Rotas do Better Auth que este template NÃO usa. Ficam desligadas (404):
// o que não está na tela não deve estar na API. Os nomes foram conferidos em
// node_modules/better-auth/dist (api/routes/*.mjs e plugins/email-otp/routes.mjs).
export const DISABLED_PATHS = [
  // Troca de senha por e-mail (o login é por código; a senha é opcional)
  '/forget-password/email-otp',
  '/email-otp/request-password-reset',
  '/email-otp/reset-password',
  '/request-password-reset',
  '/reset-password',
  // Troca de e-mail
  '/change-email',
  '/email-otp/request-email-change',
  '/email-otp/change-email',
  // Apagar conta: o template encerra em duas fases (src/lib/account.ts)
  '/delete-user',
  '/delete-user/callback',
  // A verificação de e-mail é feita por código (emailOTP), não por link
  '/send-verification-email',
]
