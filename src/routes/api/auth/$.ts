import { env } from 'cloudflare:workers'
import { createFileRoute } from '@tanstack/react-router'
import { getAuth } from '#/lib/auth'
import { isRateLimited, tooManyRequests } from '#/lib/rate-limit'

// Endpoints de escrita do Better Auth que disparam e-mail ou tentativa de login:
// alvo clássico de abuso (spam de OTP, força bruta). Limite por IP via PUBLIC_RATE_LIMIT.
const RATE_LIMITED_SUFFIXES = [
  '/email-otp/send-verification-otp',
  '/sign-in/email',
  '/sign-up/email',
  '/sign-in/email-otp',
]

export const Route = createFileRoute('/api/auth/$')({
  server: {
    handlers: {
      GET: ({ request }) => getAuth(env).handler(request),
      POST: async ({ request }) => {
        const { pathname } = new URL(request.url)
        if (
          RATE_LIMITED_SUFFIXES.some((s) => pathname.endsWith(s)) &&
          (await isRateLimited('auth', { headers: request.headers }))
        ) {
          return tooManyRequests()
        }
        return getAuth(env).handler(request)
      },
    },
  },
})
