// Arquivo antigo depois de um deploy. Cada build troca o hash dos arquivos em
// /assets/ e os antigos somem. Uma aba aberta antes do deploy ainda pede
// /assets/<arquivo-antigo>.js: o pedido não acha arquivo, cai no Worker, e o
// TanStack responderia com a página de "não encontrado" do app (HTML, com
// status 404). O navegador tenta rodar esse HTML como JavaScript e a tela
// quebra sem pista do motivo. Aqui o Worker responde 404 de verdade (texto
// puro, sem cache), que o navegador entende como "o arquivo não existe" e dispara
// o `vite:preloadError` (src/lib/chunk-reload.ts recarrega a página uma vez).
//
// Sem bindings: `src/server.ts` chama no começo de cada pedido.

/** Caminho de arquivo com hash (a pasta que o Vite usa para JS, CSS e fontes). */
export function isAssetPath(pathname: string): boolean {
  return pathname.startsWith('/assets/')
}

/** O 404 de verdade: texto puro, nunca o HTML do app, e fora de qualquer cache. */
export function missingAssetResponse(): Response {
  return new Response('Arquivo não encontrado.', {
    status: 404,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  })
}
