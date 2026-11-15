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

/**
 * Hash do código de login com CHAVE (HMAC-SHA-256, chave = o segredo do app).
 * O `storeOTP: 'hashed'` do Better Auth é um SHA-256 puro: com só 6 dígitos,
 * quem lesse a tabela `verification` descobriria o código em milissegundos.
 * Com a chave, o hash vazado sozinho não dá para testar offline. Devolve hex.
 * Trocar `BETTER_AUTH_SECRET` invalida só os códigos em voo (10 min).
 */
export function otpHasher(secret: string): (otp: string) => Promise<string> {
  const encoder = new TextEncoder()
  const key = crypto.subtle.importKey(
    'raw',
    encoder.encode(secret.trim()),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  return async (otp) => {
    const signature = await crypto.subtle.sign(
      'HMAC',
      await key,
      encoder.encode(otp),
    )
    return Array.from(new Uint8Array(signature), (b) =>
      b.toString(16).padStart(2, '0'),
    ).join('')
  }
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

/**
 * Origens confiáveis fixas em produção: só a origem de `BETTER_AUTH_URL`.
 * Sem a variável (URL deduzida da requisição) cada host que chega ao Worker
 * vira origem confiável; por isso o deploy exige a variável. No localhost
 * (ou sem variável) devolve `undefined` e vale o comportamento de dev.
 */
export function resolveTrustedOrigins(
  envUrl: string | undefined,
): string[] | undefined {
  if (!present(envUrl) || isLocalUrl(envUrl)) return undefined
  try {
    return [new URL(envUrl.trim()).origin]
  } catch {
    return undefined
  }
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
  // Troca de senha de quem já está logado: não há tela para isso
  '/change-password',
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
