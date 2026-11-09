// Entrega dos códigos do Better Auth (plugin emailOTP) por e-mail.
import { APIError } from 'better-auth/api'

import { sendEmail } from '#/lib/email'
import {
  emailVerificationCodeEmail,
  loginCodeEmail,
} from '#/lib/email-templates'

const OTP_MINUTES = 10

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
