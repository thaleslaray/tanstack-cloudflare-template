// Entrega dos códigos do Better Auth (plugin emailOTP) por e-mail.
import { APIError } from 'better-auth/api'

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
