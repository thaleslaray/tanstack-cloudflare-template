// Todo erro do servidor deixa UMA linha em `console.error` (aparece no
// `wrangler tail` e nos logs do painel). Sem isto, um erro lançado numa server
// function ou no `loader` vira só um HTTP 500 e nenhuma pista da causa: o
// TanStack guarda o erro no estado do router e responde, sem escrever nada.
// Sem bindings; usado por `src/start.ts` e `src/server.ts`.

/** `redirect()` e `notFound()` do router viajam como erro, mas não são falha. */
function ehFluxoNormal(erro: unknown): boolean {
  return (
    typeof erro === 'object' &&
    erro !== null &&
    ('isRedirect' in erro || 'isNotFound' in erro)
  )
}

function mensagem(erro: unknown): string {
  if (erro instanceof Error) return erro.message
  if (typeof erro === 'string') return erro
  try {
    return JSON.stringify(erro)
  } catch {
    return String(erro)
  }
}

/** `onde`: o pedido ou a função (ex.: `GET /app`). */
export function registrarErro(onde: string, erro: unknown): void {
  if (ehFluxoNormal(erro)) return
  console.error(
    `[erro] ${onde}: ${mensagem(erro)}`,
    erro instanceof Error && erro.stack ? `\n${erro.stack}` : '',
  )
}
