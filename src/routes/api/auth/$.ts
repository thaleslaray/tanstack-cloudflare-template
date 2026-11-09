import { env } from 'cloudflare:workers'
import { createFileRoute } from '@tanstack/react-router'
import { getAuth } from '#/lib/auth'
import { authRateLimit } from '#/lib/auth-rate-limit'

// Todo POST em /api/auth/* passa pelo rate limit (exceto /sign-out e /get-session):
// por IP (/64 no IPv6) e, onde há e-mail no corpo, também por e-mail.
// Detalhes em src/lib/auth-rate-limit.ts.
export const Route = createFileRoute('/api/auth/$')({
  server: {
    handlers: {
      GET: ({ request }) => getAuth(env, request).handler(request),
      POST: async ({ request }) => {
        const refused = await authRateLimit(request)
        if (refused) return refused
        return getAuth(env, request).handler(request)
      },
    },
  },
})
