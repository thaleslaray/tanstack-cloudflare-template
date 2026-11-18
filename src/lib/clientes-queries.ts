// A lista de clientes no TanStack Query: UMA definição (`queryOptions`) que o
// `loader` da rota e o `useSuspenseQuery` da tela compartilham. Mesma chave nos
// dois lugares é o que faz o pré-carregamento valer: ao passar o mouse no link
// o router roda o `loader`, que enche o cache com `ensureQueryData`; a tela abre
// lendo esse cache, sem pedir de novo. Com chaves diferentes seriam dois pedidos.
//
// Este é o molde de toda tela que lê dados (skill /tela, passo 3).
import { type QueryClient, queryOptions } from '@tanstack/react-query'

import { listClientesFn } from '#/lib/clientes-fns'
import { invalidarPainel } from '#/lib/painel-queries'

/**
 * Por quanto tempo o dado conta como fresco: 30 s. Dentro da janela, abrir a
 * tela (inclusive o clique logo depois do hover) usa o cache e não vai ao
 * servidor; passada, a tela abre com o dado antigo e revalida em segundo plano.
 * Escolha: a lista só muda por escrita desta pessoa (que descarta o cache na
 * hora, `invalidarClientes`) ou de outro aparelho dela; até 30 s de atraso é
 * aceitável nesse segundo caso. Dado que muda por fora com frequência pede menos.
 */
export const CLIENTES_STALE_MS = 30_000

/**
 * A chave leva o que muda o resultado: a conta (`userId`). Nunca derive a chave
 * do texto da função (depois da minificação, duas telas ficam com a mesma).
 */
export const clientesQuery = (userId: string) =>
  queryOptions({
    queryKey: ['clientes', userId],
    queryFn: () => listClientesFn(),
    staleTime: CLIENTES_STALE_MS,
  })

/**
 * O descarte de cache de toda escrita em clientes, num lugar só: criar e
 * apagar chamam isto (e aguardam) antes de a tela seguir. Prefixo `['clientes']`
 * pega a lista de qualquer conta aberta. Descarta também o painel, que mostra o
 * número de clientes e de atividades (src/lib/painel-queries.ts).
 */
export function invalidarClientes(queryClient: QueryClient) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: ['clientes'] }),
    invalidarPainel(queryClient),
  ])
}
