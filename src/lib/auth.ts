import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { tanstackStartCookies } from 'better-auth/tanstack-start'

import { getDb } from '#/db/index'

// Factory por request: em Workers, env só existe durante a requisição.
export function getAuth(env: Env) {
  return betterAuth({
    database: drizzleAdapter(getDb(env.DB), { provider: 'sqlite' }),
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    emailAndPassword: { enabled: true },
    advanced: { ipAddress: { ipAddressHeaders: ['cf-connecting-ip'] } },
    // tanstackStartCookies() deve ser SEMPRE o último plugin
    plugins: [tanstackStartCookies()],
  })
}
