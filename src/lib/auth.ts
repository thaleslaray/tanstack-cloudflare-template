import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { APIError } from 'better-auth/api'
import { emailOTP } from 'better-auth/plugins'
import { tanstackStartCookies } from 'better-auth/tanstack-start'
import { eq } from 'drizzle-orm'

import { user as userTable } from '#/db/auth-schema'
import { getDb } from '#/db/index'
import { auditAfterHook } from '#/lib/auth-audit-hook'
import { sendEmail } from '#/lib/email'
import { loginCodeEmail } from '#/lib/email-templates'

// String vazia (ou só espaços) conta como ausente.
function present(value: string | undefined): value is string {
  return Boolean(value?.trim())
}

// O login social só liga quando o par de variáveis está completo.
export function googleEnabled(env: Env) {
  return present(env.GOOGLE_CLIENT_ID) && present(env.GOOGLE_CLIENT_SECRET)
}
export function githubEnabled(env: Env) {
  return present(env.GITHUB_CLIENT_ID) && present(env.GITHUB_CLIENT_SECRET)
}

const SEVEN_DAYS = 60 * 60 * 24 * 7
const ONE_DAY = 60 * 60 * 24

// Factory por request: em Workers, env só existe durante a requisição.
export function getAuth(env: Env) {
  return betterAuth({
    database: drizzleAdapter(getDb(env.DB), { provider: 'sqlite' }),
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    emailAndPassword: { enabled: true },
    session: { expiresIn: SEVEN_DAYS, updateAge: ONE_DAY },
    user: {
      // `input: false`: o navegador não consegue mexer nestes campos pelo
      // /update-user. Quem escreve é src/lib/account-fns.ts e o cron.
      additionalFields: {
        deletedAt: { type: 'date', required: false, input: false },
        purgeRemindedAt: { type: 'date', required: false, input: false },
      },
      // O `deleteUser` do Better Auth apaga NA HORA. Aqui encerrar é em duas
      // fases (src/lib/account.ts), então o endpoint nativo fica desligado:
      // ligado, qualquer cliente pularia o prazo de 7 dias.
      deleteUser: { enabled: false },
    },
    socialProviders: {
      ...(googleEnabled(env)
        ? {
            google: {
              // biome-ignore lint/style/noNonNullAssertion: googleEnabled/githubEnabled já garantem que a variável existe
              clientId: env.GOOGLE_CLIENT_ID!,
              // biome-ignore lint/style/noNonNullAssertion: googleEnabled/githubEnabled já garantem que a variável existe
              clientSecret: env.GOOGLE_CLIENT_SECRET!,
            },
          }
        : {}),
      ...(githubEnabled(env)
        ? {
            github: {
              // biome-ignore lint/style/noNonNullAssertion: googleEnabled/githubEnabled já garantem que a variável existe
              clientId: env.GITHUB_CLIENT_ID!,
              // biome-ignore lint/style/noNonNullAssertion: googleEnabled/githubEnabled já garantem que a variável existe
              clientSecret: env.GITHUB_CLIENT_SECRET!,
            },
          }
        : {}),
    },
    // Auditoria de login e troca de nome (src/lib/auth-audit-hook.ts).
    hooks: { after: auditAfterHook },
    // Login por código não traz nome: usa a parte local do e-mail.
    databaseHooks: {
      // Conta encerrada não entra de novo durante o prazo, por nenhum método:
      // todo login cria uma sessão, então esta é a única porta a fechar.
      session: {
        create: {
          before: async (newSession) => {
            const [owner] = await getDb(env.DB)
              .select({ deletedAt: userTable.deletedAt })
              .from(userTable)
              .where(eq(userTable.id, newSession.userId))
              .limit(1)
            if (owner?.deletedAt) {
              throw new APIError('FORBIDDEN', {
                message: 'Esta conta foi encerrada.',
                code: 'ACCOUNT_CLOSED',
              })
            }
          },
        },
      },
      user: {
        create: {
          before: async (user) => {
            if (user.name?.trim()) return
            return { data: { ...user, name: user.email.split('@')[0] } }
          },
        },
      },
    },
    advanced: {
      ipAddress: { ipAddressHeaders: ['cf-connecting-ip', 'x-forwarded-for'] },
    },
    plugins: [
      emailOTP({
        otpLength: 6,
        expiresIn: 600,
        allowedAttempts: 3,
        // Só o hash do código fica no banco (tabela `verification`).
        storeOTP: 'hashed',
        async sendVerificationOTP({ email, otp, type }) {
          if (type !== 'sign-in') return
          const message = loginCodeEmail({ code: otp, minutes: 10 })
          // Erro de envio é lançado de propósito: aparece no log.
          const result = await sendEmail({ to: email, ...message })
          if (result.provider === 'console') {
            console.warn(`[auth] código de login para ${email}: ${otp}`)
          }
        },
      }),
      // tanstackStartCookies() deve ser SEMPRE o último plugin
      tanstackStartCookies(),
    ],
  })
}
