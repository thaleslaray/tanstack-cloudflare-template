// Better Auth de verdade nos testes: um D1 local em memória (via
// `getPlatformProxy` do Wrangler, sem gravar em `.wrangler/state`) com as
// migrações de `drizzle/` aplicadas. Serve para provar o que só existe com o
// Better Auth montado (hooks, plugins, rotas desligadas), sem subir servidor.

import { env as testEnv } from 'cloudflare:workers'
import fs from 'node:fs'
import path from 'node:path'
import { vi } from 'vitest'
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
  // Lista de acesso (só vale no modo 'allowlist' de `appConfig.accessMode`):
  // `allow` libera e-mails e `signIn` libera o que vai usar.
  // `vars.ACCESS_ALLOWLIST` fixa a lista e `signIn` deixa de mexer nela.
  const fixedList = 'ACCESS_ALLOWLIST' in vars
  const allowed = new Set<string>()
  const env = Object.assign(proxy.env, {
    BETTER_AUTH_SECRET: 'x'.repeat(40),
    ACCESS_ALLOWLIST: '',
    ...vars,
  }) as Env
  Object.assign(testEnv, env)
  const allow = (...emails: string[]) => {
    for (const email of emails) allowed.add(email.trim().toLowerCase())
    env.ACCESS_ALLOWLIST = [...allowed].join(',')
    Object.assign(testEnv, { ACCESS_ALLOWLIST: env.ACCESS_ALLOWLIST })
  }

  return {
    env,
    db,
    allow,
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
    /**
     * Entra por código (o do console, como no dev) e devolve o cabeçalho
     * `cookie` da sessão e o usuário criado.
     */
    async signIn(email: string, headers: Record<string, string> = {}) {
      if (!fixedList) allow(email)
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      try {
        const sent = await this.post(
          '/email-otp/send-verification-otp',
          { email, type: 'sign-in' },
          headers,
        )
        if (sent.status !== 200) throw new Error(`envio ${sent.status}`)
        let code: string | undefined
        for (let i = 0; i < 100 && !code; i++) {
          for (const [line] of warn.mock.calls) {
            const m = new RegExp(
              `código de login para ${email}: (\\d{6})`,
            ).exec(String(line))
            if (m) code = m[1]
          }
          if (!code) await new Promise((r) => setTimeout(r, 20))
        }
        if (!code) throw new Error('código não apareceu no console')
        const res = await this.post(
          '/sign-in/email-otp',
          { email, otp: code },
          headers,
        )
        if (res.status !== 200) throw new Error(`login ${res.status}`)
        const cookie = res.headers
          .getSetCookie()
          .map((c) => c.split(';')[0])
          .join('; ')
        return {
          cookie,
          res,
          body: (await res.json()) as { user: { id: string } },
        }
      } finally {
        warn.mockRestore()
      }
    },
    dispose: () => proxy.dispose(),
  }
}
