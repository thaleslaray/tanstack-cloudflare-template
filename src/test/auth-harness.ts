// Better Auth de verdade nos testes: um D1 local em memória (via
// `getPlatformProxy` do Wrangler, sem gravar em `.wrangler/state`) com as
// migrações de `drizzle/` aplicadas. Serve para provar o que só existe com o
// Better Auth montado (hooks, plugins, rotas desligadas), sem subir servidor.

import { env as testEnv } from 'cloudflare:workers'
import fs from 'node:fs'
import path from 'node:path'
import { getPlatformProxy } from 'wrangler'

import { getAuth } from '#/lib/auth'

export const ORIGIN = 'http://localhost:3000'

export async function createAuthHarness(vars: Record<string, string> = {}) {
  const proxy = await getPlatformProxy<Env>({ persist: false })
  const db = proxy.env.DB
  const dir = path.resolve(import.meta.dirname, '../../drizzle')
  for (const file of fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .sort()) {
    const sql = fs.readFileSync(path.join(dir, file), 'utf8')
    for (const statement of sql.split('--> statement-breakpoint')) {
      if (statement.trim()) await db.prepare(statement).run()
    }
  }
  const env = Object.assign(proxy.env, {
    BETTER_AUTH_SECRET: 'x'.repeat(40),
    ...vars,
  }) as Env
  Object.assign(testEnv, env)

  return {
    env,
    db,
    getAuth: (request?: Request) => getAuth(env, request),
    /** POST JSON em /api/auth/<path> pelo handler, como o navegador faria. */
    async post(
      route: string,
      body: unknown,
      headers: Record<string, string> = {},
    ) {
      const request = new Request(`${ORIGIN}/api/auth${route}`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          origin: ORIGIN,
          ...headers,
        },
        body: JSON.stringify(body),
      })
      return getAuth(env, request).handler(request)
    },
    dispose: () => proxy.dispose(),
  }
}
