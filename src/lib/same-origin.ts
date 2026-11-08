// Recusa de chamadas cross-site às server functions.
//
// As server functions são o RPC do próprio app: o único chamador legítimo é uma página servida
// por esta origem. Qualquer outra chamada com o cookie do usuário é falsificação (CSRF) e é
// recusada antes de o TanStack decodificar o corpo. Rotas de API não entram: webhooks e clientes
// com chave vêm de fora por definição.

const SERVER_FN_PREFIX = '/_serverFn/'

/**
 * True quando o navegador diz que a requisição não veio desta origem.
 * `Sec-Fetch-Site` manda (todo navegador atual envia); `Origin` é o plano B.
 * Sem nenhum dos dois, não é navegador, e quem não é navegador não carrega cookie de vítima.
 *
 * Use também em rota de API que muda estado com o cookie do usuário (ex.: upload
 * do avatar em src/routes/api/avatar.ts).
 */
export function isCrossSiteRequest(request: Request): boolean {
  const site = request.headers.get('sec-fetch-site')
  // `same-site` também é recusado: subdomínio irmão não é este app.
  if (site) return site !== 'same-origin' && site !== 'none'
  const origin = request.headers.get('origin')
  return origin !== null && origin !== new URL(request.url).origin
}

/** True para chamada cross-site a uma server function (`/_serverFn/...`). */
export function isCrossSiteServerFnCall(request: Request): boolean {
  const url = new URL(request.url)
  if (!url.pathname.startsWith(SERVER_FN_PREFIX)) return false
  return isCrossSiteRequest(request)
}
