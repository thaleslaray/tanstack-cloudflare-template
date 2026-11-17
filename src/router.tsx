import { createRouter as createTanStackRouter } from '@tanstack/react-router'
import { setupRouterSsrQueryIntegration } from '@tanstack/react-router-ssr-query'
import { getContext } from './integrations/tanstack-query/root-provider'
import { installChunkReload } from './lib/chunk-reload'
import { routeTree } from './routeTree.gen'

export function getRouter() {
  // Só no navegador: arquivo antigo depois de um deploy recarrega a página uma vez.
  if (typeof window !== 'undefined') installChunkReload()
  const context = getContext()

  const router = createTanStackRouter({
    routeTree,
    context,
    scrollRestoration: true,
    // Passar o mouse (ou tocar) num link já roda o `loader` da rota.
    defaultPreload: 'intent',
    // 0 DE PROPÓSITO: o router não guarda cache próprio do `loader`; quem decide
    // se o dado ainda é fresco é o TanStack Query (`staleTime` de cada
    // `queryOptions`, ex.: 30 s em src/lib/clientes-queries.ts). Assim há um
    // relógio só: o `loader` roda de novo no clique, mas `ensureQueryData` devolve
    // o cache sem pedir (o que o hover trouxe vale até o `staleTime`). Subir este
    // número aqui criaria um segundo cache e dado velho sem aviso.
    defaultPreloadStaleTime: 0,
  })

  setupRouterSsrQueryIntegration({ router, queryClient: context.queryClient })

  return router
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
