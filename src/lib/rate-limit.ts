import { env } from 'cloudflare:workers'
import { getRequest } from '@tanstack/react-start/server'

// Somente servidor: lê o binding PUBLIC_RATE_LIMIT (cloudflare.config.ts) dentro das funções.

function clientIp(headers?: Headers): string {
  return (
    headers?.get('cf-connecting-ip') ??
    headers?.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    'unknown'
  )
}

/**
 * Retorna true quando o IP estourou o limite do escopo (`${scope}:${ip}`).
 * Dentro de server functions, omita `headers`: eles vêm de `getRequest()`.
 *
 * Falha ABERTA de propósito: se o binding não existir (ambiente sem suporte) ou der erro,
 * a requisição passa. Um rate limit com defeito não pode derrubar o login nem as escritas.
 */
export async function isRateLimited(
  scope: string,
  options: { headers?: Headers; key?: string } = {},
): Promise<boolean> {
  const limiter: RateLimit | undefined = env.PUBLIC_RATE_LIMIT
  if (!limiter) return false
  try {
    const headers = options.headers ?? getRequest().headers
    const key = options.key ?? `${scope}:${clientIp(headers)}`
    const { success } = await limiter.limit({ key })
    return !success
  } catch (error) {
    console.error(
      '[rate-limit] falha ao consultar o limitador (liberado):',
      error,
    )
    return false
  }
}

/** Resposta 429 padrão. */
export function tooManyRequests(): Response {
  return new Response('Muitas requisições. Tente de novo em um minuto.', {
    status: 429,
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'retry-after': '60',
    },
  })
}
