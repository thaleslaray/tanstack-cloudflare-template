// Os dados do painel (/app) no TanStack Query: UMA `queryOptions` que o `loader`
// da rota e a tela (`useSuspenseQuery`) compartilham, como em clientes
// (src/lib/clientes-queries.ts). Mesma chave nos dois lugares é o que faz o
// pré-carregamento valer: o hover no link enche o cache e o clique abre a tela
// sem pedir de novo (1 pedido em vez de 2).
import { type QueryClient, queryOptions } from '@tanstack/react-query'

import { getDashboardStatsFn } from '#/lib/app-fns'

/** 30 s, como a lista de clientes (veja o porquê em clientes-queries.ts). */
export const PAINEL_STALE_MS = 30_000

/** A chave leva a conta (`userId`); nunca derive do texto da função. */
export const painelQuery = (userId: string) =>
  queryOptions({
    queryKey: ['painel', userId],
    queryFn: () => getDashboardStatsFn(),
    staleTime: PAINEL_STALE_MS,
  })

/**
 * Descarte do cache do painel. Chame em TODA escrita que muda o que ele mostra:
 * clientes (o número de clientes), e qualquer ação auditada (o número de
 * atividades: trocar nome, foto, criar e apagar cliente). Prefixo `['painel']`
 * pega a conta aberta, qualquer que seja.
 */
export function invalidarPainel(queryClient: QueryClient) {
  return queryClient.invalidateQueries({ queryKey: ['painel'] })
}
