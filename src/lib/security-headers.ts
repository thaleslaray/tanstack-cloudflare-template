// Cabeçalhos de segurança das respostas dinâmicas (Worker). As páginas pré-renderizadas e os
// assets saem direto da camada de assets, sem passar pelo Worker: para eles vale `public/_headers`.
// Mantenha as duas listas em sincronia.
//
// Sem Content-Security-Policy de propósito: o TanStack Start injeta scripts inline (hidratação e
// dados do router) e uma CSP útil exigiria nonce em cada resposta, o que o SSR/pré-render não
// suporta hoje. Uma CSP com 'unsafe-inline' daria falsa sensação de proteção.

export const SECURITY_HEADERS: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
  'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
}

const HSTS = 'max-age=63072000; includeSubDomains'

/** Devolve a resposta com os cabeçalhos de segurança (HSTS só em https). */
export function withSecurityHeaders(res: Response, req: Request): Response {
  // Respostas de redirect/WebSocket podem ter headers imutáveis: copia para uma nova Response.
  const headers = new Headers(res.headers)
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    headers.set(name, value)
  }
  if (new URL(req.url).protocol === 'https:') {
    headers.set('Strict-Transport-Security', HSTS)
  }
  return new Response(res.body, {
    status: res.status,
    statusText: res.statusText,
    headers,
    // Preserva o upgrade de WebSocket (101), que se perde ao reconstruir a Response.
    webSocket: (res as Response & { webSocket?: unknown }).webSocket,
  } as ResponseInit)
}
