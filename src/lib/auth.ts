import { waitUntil } from 'cloudflare:workers'
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { APIError } from 'better-auth/api'
import { emailOTP } from 'better-auth/plugins/email-otp'
import { tanstackStartCookies } from 'better-auth/tanstack-start'
import { eq } from 'drizzle-orm'

import { user as userTable } from '#/db/auth-schema'
import { getDb } from '#/db/index'
import { auditAfterHook } from '#/lib/auth-audit-hook'
import {
  assertAuthSecret,
  DISABLED_PATHS,
  isLocalUrl,
  passwordEnabled,
  present,
  resolveBaseURL,
} from '#/lib/auth-config'
import { deliverOtp } from '#/lib/auth-otp'

export { passwordEnabled }

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
// Passe a `request` sempre que tiver uma: sem BETTER_AUTH_URL, a URL do app é
// a origem dela (o Better Auth só deduz sozinho dentro do `handler`; em
// `auth.api.getSession` ele não vê a requisição e ficaria sem URL).
export function getAuth(env: Env, request?: Request) {
  // Segredo vazio ou curto assina cookie fraco: melhor não subir.
  assertAuthSecret(env.BETTER_AUTH_SECRET)
  const baseURL = resolveBaseURL(env.BETTER_AUTH_URL, request)
  const password = passwordEnabled(env)
  return betterAuth({
    database: drizzleAdapter(getDb(env.DB), { provider: 'sqlite' }),
    secret: env.BETTER_AUTH_SECRET.trim(),
    baseURL,
    // Rotas que o template não usa ficam em 404 (lista em auth-config.ts).
    disabledPaths: DISABLED_PATHS,
    // O limitador interno do Better Auth fica DESLIGADO de propósito. O modo
    // "database" exigiria a tabela `rateLimit` (migração) e o modo em memória
    // não vale em Workers (cada isolate tem a sua). O limite é feito antes, no
    // handler de src/routes/api/auth/$.ts (src/lib/auth-rate-limit.ts), por IP
    // (prefixo /64 no IPv6) e por e-mail, com o binding PUBLIC_RATE_LIMIT.
    rateLimit: { enabled: false },
    emailAndPassword: {
      // Senha é opcional (PASSWORD_LOGIN_ENABLED). Quando liga, o e-mail precisa
      // ser confirmado por código antes de existir sessão: sem isso, alguém
      // poderia criar conta com o e-mail de outra pessoa.
      enabled: password,
      requireEmailVerification: true,
      revokeSessionsOnPasswordReset: true,
    },
    // A verificação de e-mail é por código (plugin emailOTP com
    // `overrideDefaultEmailVerification`): cadastro -> código -> verificado -> sessão.
    emailVerification: {
      sendOnSignUp: true,
      sendOnSignIn: true,
      autoSignInAfterVerification: true,
    },
    session: {
      expiresIn: SEVEN_DAYS,
      updateAge: ONE_DAY,
      // Sessão "recente" = menos de 1 hora (usada em encerrar conta).
      freshAge: 60 * 60,
    },
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
              // Só aceita contas cujo e-mail o provedor diz estar verificado.
              requireEmailVerification: true,
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
              // Só aceita contas cujo e-mail o provedor diz estar verificado.
              requireEmailVerification: true,
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
      // Tarefas "em segundo plano" (enviar o e-mail do código) seguem depois da
      // resposta, no `waitUntil` do Worker, sem atrasar nem revelar se o e-mail existe.
      backgroundTasks: { handler: (promise) => waitUntil(promise) },
      // Cookie `Secure` fora do localhost. Sem URL conhecida, vale o padrão do Better Auth.
      ...(baseURL ? { useSecureCookies: !isLocalUrl(baseURL) } : {}),
    },
    plugins: [
      emailOTP({
        otpLength: 6,
        expiresIn: 600,
        allowedAttempts: 3,
        // Só o hash do código fica no banco (tabela `verification`).
        storeOTP: 'hashed',
        // Entrega só `sign-in` e `email-verification` (src/lib/auth-otp.ts).
        sendVerificationOTP: deliverOtp,
        overrideDefaultEmailVerification: true,
      }),
      // tanstackStartCookies() deve ser SEMPRE o último plugin
      tanstackStartCookies(),
    ],
  })
}
