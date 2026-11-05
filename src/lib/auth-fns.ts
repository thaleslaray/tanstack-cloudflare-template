import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { env } from 'cloudflare:workers'

import { getAuth, githubEnabled, googleEnabled } from '#/lib/auth'

// Quais botões sociais mostrar. Público de propósito: /login ainda não tem sessão.
export const getAuthProvidersFn = createServerFn({ method: 'GET' }).handler(
  async () => ({ google: googleEnabled(env), github: githubEnabled(env) }),
)

// Sessão ou nulo (para guardas de rota: aqui não redireciona, só informa).
export const getSessionFn = createServerFn({ method: 'GET' }).handler(
  async () => getAuth(env).api.getSession({ headers: getRequest().headers }),
)
