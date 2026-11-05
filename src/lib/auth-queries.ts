import { queryOptions } from '@tanstack/react-query'

import { getAuthProvidersFn, getSessionFn } from '#/lib/auth-fns'

export const sessionQuery = queryOptions({
  queryKey: ['session'],
  queryFn: () => getSessionFn(),
  staleTime: 60_000,
})

// Quase nunca muda: fica em cache durante toda a visita.
export const authProvidersQuery = queryOptions({
  queryKey: ['auth', 'providers'],
  queryFn: () => getAuthProvidersFn(),
  staleTime: Number.POSITIVE_INFINITY,
})
