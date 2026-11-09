// Rate limit de todo POST em /api/auth/* (somente servidor).
// O limitador interno do Better Auth está desligado (src/lib/auth.ts): quem
// limita é esta função, chamada por src/routes/api/auth/$.ts.
import { isRateLimited, tooManyRequests } from '#/lib/rate-limit'

// Fora do limite: sair e ler a sessão não gastam e-mail nem testam senha.
const UNLIMITED_SUFFIXES = ['/sign-out', '/get-session']

// Endpoints que recebem um e-mail no corpo: além do IP, limita por e-mail, para
// que um atacante com muitos IPs não encha a caixa de uma pessoa de códigos.
const EMAIL_KEYED_SUFFIXES = [
  '/email-otp/send-verification-otp',
  '/sign-in/email',
  '/sign-up/email',
  '/sign-in/email-otp',
  '/email-otp/verify-email',
  '/email-otp/check-verification-otp',
  '/forget-password/email-otp',
  '/email-otp/reset-password',
]

// Tipos de código que têm tela e e-mail (src/lib/auth-otp.ts).
const ALLOWED_OTP_TYPES = ['sign-in', 'email-verification']

function normalizedPath(url: string): string {
  let path = new URL(url).pathname
  try {
    path = decodeURIComponent(path)
  } catch {
    // Percent-encoding inválido: vale o caminho como veio.
  }
  return path.length > 1 ? path.replace(/\/+$/, '') : path
}

function endsWithAny(path: string, suffixes: string[]): boolean {
  return suffixes.some((suffix) => path.endsWith(suffix))
}

async function readJsonBody(
  request: Request,
): Promise<Record<string, unknown> | null> {
  try {
    const body: unknown = await request.clone().json()
    return body && typeof body === 'object'
      ? (body as Record<string, unknown>)
      : null
  } catch {
    return null
  }
}

/** E-mail do corpo, em minúsculas; `null` se não houver um e-mail plausível. */
export function emailFromBody(
  body: Record<string, unknown> | null,
): string | null {
  const value = body?.email
  if (typeof value !== 'string') return null
  const email = value.trim().toLowerCase()
  return email.length > 0 && email.length <= 254 && email.includes('@')
    ? email
    : null
}

/**
 * Devolve uma resposta de recusa (429 ou 400) ou `null` para a requisição seguir.
 * Chame só para POST.
 */
export async function authRateLimit(
  request: Request,
): Promise<Response | null> {
  const path = normalizedPath(request.url)
  if (endsWithAny(path, UNLIMITED_SUFFIXES)) return null

  if (await isRateLimited('auth', { headers: request.headers })) {
    return tooManyRequests()
  }

  if (!endsWithAny(path, EMAIL_KEYED_SUFFIXES)) return null
  const body = await readJsonBody(request)

  // O Better Auth envia o código em segundo plano, então um tipo não suportado
  // só apareceria no log. Recusar aqui devolve o erro a quem chamou.
  if (
    path.endsWith('/email-otp/send-verification-otp') &&
    typeof body?.type === 'string' &&
    !ALLOWED_OTP_TYPES.includes(body.type)
  ) {
    return Response.json(
      { message: 'Tipo de código não suportado.' },
      { status: 400 },
    )
  }

  const email = emailFromBody(body)
  if (
    email &&
    (await isRateLimited('auth-email', {
      headers: request.headers,
      key: `auth-email:${email}`,
    }))
  ) {
    return tooManyRequests()
  }
  return null
}
