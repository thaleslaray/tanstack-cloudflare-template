// Recarrega a página UMA vez quando um arquivo do app não carrega (o Vite
// avisa com o evento `vite:preloadError`, tanto na pré-carga de um chunk
// quanto num `import()` que falha). Causa típica: um deploy trocou os arquivos
// com hash e esta aba ainda aponta para os antigos (o servidor responde 404,
// veja `src/lib/missing-asset.ts`). Recarregar traz o HTML novo.
//
// Guarda em `sessionStorage` a hora do último recarregamento: sem isso, um
// arquivo que continua falhando (rede caída, bloqueio) faria a página recarregar
// para sempre. Dentro da janela, o erro segue o caminho normal (a tela de erro).
// Sem acesso ao `sessionStorage` (modo privado, bloqueio), NÃO recarrega:
// sem a guarda não há como evitar o laço.
// Sem bindings; é código do navegador (chamado em `src/router.tsx`).

export const CHUNK_RELOAD_KEY = 'chunk-reload-at'
export const CHUNK_RELOAD_WINDOW_MS = 60_000

type Armazem = Pick<Storage, 'getItem' | 'setItem'>

/** Pode recarregar agora? Se sim, já grava a hora (a guarda contra o laço). */
export function claimChunkReload(
  storage: Armazem | undefined,
  now = Date.now(),
): boolean {
  try {
    if (!storage) return false
    const last = Number(storage.getItem(CHUNK_RELOAD_KEY))
    if (
      Number.isFinite(last) &&
      last > 0 &&
      now - last < CHUNK_RELOAD_WINDOW_MS
    ) {
      return false
    }
    storage.setItem(CHUNK_RELOAD_KEY, String(now))
    return true
  } catch {
    return false
  }
}

type Janela = Pick<Window, 'addEventListener' | 'location'> & {
  sessionStorage?: Armazem
}

/** Liga o ouvinte do `vite:preloadError` (uma vez por janela). */
export function installChunkReload(win: Janela = window): void {
  const marcada = win as Janela & { __chunkReloadOn?: boolean }
  if (marcada.__chunkReloadOn) return
  marcada.__chunkReloadOn = true
  win.addEventListener('vite:preloadError', (event) => {
    let storage: Armazem | undefined
    try {
      storage = win.sessionStorage
    } catch {
      storage = undefined
    }
    if (!claimChunkReload(storage)) return // já recarregou há pouco: erro normal
    // Sem isso o Vite relança o erro; a página vai recarregar de qualquer jeito.
    event.preventDefault()
    win.location.reload()
  })
}
