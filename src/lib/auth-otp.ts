// Entrega dos códigos do Better Auth (plugin emailOTP) por e-mail.
import { APIError } from 'better-auth/api'
import { eq } from 'drizzle-orm'

import { user as userTable, verification } from '#/db/auth-schema'
import type { getDb } from '#/db/index'

import { canDeliverEmail, sendEmail } from '#/lib/email'
import {
  emailVerificationCodeEmail,
  loginCodeEmail,
} from '#/lib/email-templates'

const OTP_MINUTES = 10

export const SEND_OTP_PATH = '/email-otp/send-verification-otp'

export const SIGN_UP_PATH = '/sign-up/email'

// Caminhos do Better Auth que mandam e-mail neste template. Reenvio por link
// (`/send-verification-email`) e redefinição de senha estão em DISABLED_PATHS
// (404): o reenvio é o próprio SEND_OTP_PATH com `type: 'email-verification'`.
const EMAIL_SENDING_PATHS = new Set([SEND_OTP_PATH, SIGN_UP_PATH])

/**
 * Recusa o pedido de código quando não há como entregá-lo (produção sem
 * provedor de e-mail), incluindo o cadastro com senha. Vale para qualquer e-mail, exista conta ou não, para não
 * revelar quem tem conta. Sem isto, o Better Auth responde `success` e o erro
 * de envio morre no log, porque ele envia em segundo plano.
 */
export function assertEmailConfigured(
  path: string,
  passwordLoginEnabled = false,
): void {
  if (!EMAIL_SENDING_PATHS.has(path) || canDeliverEmail()) return
  // O cadastro só dispara e-mail quando a senha está ligada; desligada, o
  // Better Auth já recusa por conta própria.
  if (path === SIGN_UP_PATH && !passwordLoginEnabled) return
  throw new APIError('SERVICE_UNAVAILABLE', {
    message: 'O envio de e-mail deste sistema ainda não foi configurado.',
    code: 'EMAIL_NAO_CONFIGURADO',
  })
}

/**
 * Só dois tipos de código têm tela e e-mail neste template: `sign-in` (entrar)
 * e `email-verification` (confirmar o e-mail de quem criou conta com senha).
 * Os outros (`forget-password`, `change-email`) não têm fluxo: recusar é mais
 * seguro do que gerar um código que ninguém recebe.
 */
export async function deliverOtp({
  email,
  otp,
  type,
}: {
  email: string
  otp: string
  type: string
}): Promise<void> {
  if (type !== 'sign-in' && type !== 'email-verification') {
    throw new APIError('BAD_REQUEST', {
      message: 'Tipo de código não suportado.',
    })
  }
  const message =
    type === 'sign-in'
      ? loginCodeEmail({ code: otp, minutes: OTP_MINUTES })
      : emailVerificationCodeEmail({ code: otp, minutes: OTP_MINUTES })
  // Erro de envio é lançado de propósito: aparece no log.
  const result = await sendEmail({ to: email, ...message })
  if (result.provider === 'console') {
    // O e2e lê esta linha (e2e/helpers.ts): não mude o formato do login.
    console.warn(
      type === 'sign-in'
        ? `[auth] código de login para ${email}: ${otp}`
        : `[auth] código de verificação para ${email}: ${otp}`,
    )
  }
}

/** Tipos de código que o Better Auth aceita no pedido (o `change-email` tem rota própria). */
export const OTP_REQUEST_TYPES = new Set([
  'sign-in',
  'email-verification',
  'forget-password',
])

/** Validade do código, em segundos: a mesma do plugin `emailOTP` em `auth.ts`. */
export const OTP_EXPIRES_IN_SECONDS = 600

/**
 * E-mail fora da lista: faz o MESMO trabalho do pedido liberado (procura a
 * conta, calcula o hash de um código, grava a verificação) e não envia nada.
 * A verificação gravada é uma "isca": o hash de um valor aleatório que ninguém
 * conhece, com o identificador e a validade do código de verdade. Assim, ao
 * verificar o código, o Better Auth conta as tentativas e a expiração igual
 * (errado, "tentativas esgotadas" na 4ª, "expirado" depois de 10 min) e a
 * resposta não separa quem está na lista de quem não está. Nada disso cria
 * usuário nem sessão: o `user.create.before` recusa. Só é usada no modo lista
 * (`appConfig.accessMode === 'allowlist'`). As linhas vencidas saem
 * pelo cron `auth.limpar-expirados`.
 */
export async function simulateOtpWork(
  db: ReturnType<typeof getDb>,
  hash: (otp: string) => Promise<string>,
  email: string,
  type = 'sign-in',
): Promise<void> {
  const normalized = email.trim().toLowerCase()
  await db
    .select({ id: userTable.id })
    .from(userTable)
    .where(eq(userTable.email, normalized))
    .limit(1)
  const value = await hash(crypto.randomUUID())
  await db.insert(verification).values({
    id: crypto.randomUUID(),
    // Mesmo formato do Better Auth (`<tipo>-otp-<e-mail>`, valor `<hash>:<tentativas>`).
    identifier: `${type}-otp-${normalized}`,
    value: `${value}:0`,
    expiresAt: new Date(Date.now() + OTP_EXPIRES_IN_SECONDS * 1000),
  })
}
