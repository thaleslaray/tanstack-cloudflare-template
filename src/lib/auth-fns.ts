import { env } from 'cloudflare:workers'
import { createServerFn } from '@tanstack/react-start'

import { githubEnabled, googleEnabled, passwordEnabled } from '#/lib/auth'
import { getRequestSession } from '#/lib/request-session'

// Quais botões mostrar (social e senha). Público de propósito: /login ainda não tem sessão.
export const getAuthProvidersFn = createServerFn({ method: 'GET' }).handler(
  async () => ({
    google: googleEnabled(env),
    github: githubEnabled(env),
    password: passwordEnabled(env),
  }),
)

// Sessão ou nulo (para guardas de rota: aqui não redireciona, só informa).
// O `token` da sessão NUNCA sai do servidor: é o que vale como cookie.
export const getSessionFn = createServerFn({ method: 'GET' }).handler(
  async () => {
    const current = await getRequestSession()
    if (!current) return null
    const { id, expiresAt, createdAt } = current.session
    return { user: current.user, session: { id, expiresAt, createdAt } }
  },
)
