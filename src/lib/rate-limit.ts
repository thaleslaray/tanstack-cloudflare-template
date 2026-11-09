import { env } from 'cloudflare:workers'
import { getRequest } from '@tanstack/react-start/server'

// Somente servidor: lê o binding PUBLIC_RATE_LIMIT (wrangler.jsonc) dentro das funções.

/**
 * IPv6: cada pessoa costuma receber um bloco /64 inteiro (bilhões de endereços),
 * então limitar por endereço completo não limita nada. Aqui o IP vira o prefixo
 * /64 (`2001:db8:0:1:aaaa:bbbb:cccc:dddd` -> `2001:db8:0:1::/64`). IPv4 fica igual.
 */
export function normalizeIp(ip: string): string {
  const raw = ip.trim().split('%')[0] ?? ''
  if (!raw.includes(':')) return raw
  // IPv4 dentro de IPv6 (::ffff:203.0.113.7): vale o IPv4.
  const mapped = raw.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i)
  if (mapped?.[1]) return mapped[1]
  let text = raw
  // Forma com IPv4 no fim (64:ff9b::1.2.3.4): troca por dois grupos hex.
  const tail = text.match(/^(.*:)(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/)
  if (tail) {
    const [, head, a, b, c, d] = tail
    const hex = (x: string, y: string) =>
      (Number(x) * 256 + Number(y)).toString(16)
    text = `${head}${hex(a as string, b as string)}:${hex(c as string, d as string)}`
  }
  const halves = text.split('::')
  if (halves.length > 2) return raw
  const left = halves[0] ? halves[0].split(':') : []
  const right = halves[1] ? halves[1].split(':') : []
  const missing = 8 - left.length - right.length
  if (halves.length === 1 ? left.length !== 8 : missing < 1) return raw
  const groups = [
    ...left,
    ...Array(halves.length === 2 ? missing : 0).fill('0'),
    ...right,
  ]
  if (groups.length !== 8) return raw
  const first = groups.slice(0, 4).map((g) => Number.parseInt(g || '0', 16))
  if (first.some((n) => Number.isNaN(n) || n > 0xffff)) return raw
  return `${first.map((n) => n.toString(16)).join(':')}::/64`
}

// Só o `cf-connecting-ip` é de confiança: a borda da Cloudflare o escreve e
// sobrescreve o que o cliente mandar. O `x-forwarded-for` é do cliente: o
// fallback abaixo só vale fora da borda (testes, outro proxy), onde ninguém o
// falsifica por nós. Atrás da Cloudflare ele nunca é lido, porque o primeiro
// cabeçalho sempre existe.
export function clientIp(headers?: Headers): string {
  const ip =
    headers?.get('cf-connecting-ip') ??
    headers?.get('x-forwarded-for')?.split(',')[0]?.trim()
  return ip ? normalizeIp(ip) : 'unknown'
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
    const key =
      options.key ??
      `${scope}:${clientIp(options.headers ?? getRequest().headers)}`
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
