// Camada de e-mail (somente servidor). Escolhe o provedor a cada chamada:
//   1. Resend (REST via fetch), se RESEND_API_KEY estiver preenchida;
//   2. Cloudflare Email Service (binding EMAIL), se existir e EMAIL_FROM estiver preenchido;
//   3. console (SÓ em desenvolvimento): o e-mail aparece no terminal do `npm run dev`.
//      Em produção sem provedor, `sendEmail` lança erro: um código de login
//      impresso no log seria um código que qualquer pessoa com acesso ao log usa.
import { env } from 'cloudflare:workers'

import { appConfig } from '#/config/app'
import { isLocalUrl } from '#/lib/auth-config'

export type SendEmailParams = {
  to: string
  subject: string
  html: string
  text: string
}

export type SendEmailResult = {
  sent: boolean
  provider: 'resend' | 'cloudflare' | 'console'
  id?: string
}

// Trata string vazia (ou só espaços) como ausente.
function optional(value: string | undefined): string | undefined {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}

// Desenvolvimento local: URL do app em localhost/127.x ou, sem URL definida,
// o `vite dev` (`import.meta.env.DEV`).
function isLocalDev(): boolean {
  const url = optional(env.BETTER_AUTH_URL)
  if (url) return isLocalUrl(url)
  return import.meta.env.DEV === true
}

export async function sendEmail({
  to,
  subject,
  html,
  text,
}: SendEmailParams): Promise<SendEmailResult> {
  // `env` só é lido aqui dentro, nunca em escopo de módulo.
  const resendKey = optional(env.RESEND_API_KEY)
  const from = optional(env.EMAIL_FROM)

  if (resendKey) {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${resendKey}`,
      },
      body: JSON.stringify({
        // onboarding@resend.dev é o endereço de teste do Resend.
        from: from ?? `${appConfig.name} <onboarding@resend.dev>`,
        to,
        subject,
        html,
        text,
        reply_to: appConfig.supportEmail,
      }),
    })
    if (!response.ok) {
      const body = (await response.text()).slice(0, 500)
      throw new Error(
        `Falha ao enviar e-mail pelo Resend (${response.status}): ${body}`,
      )
    }
    const data = (await response.json().catch(() => null)) as {
      id?: string
    } | null
    return { sent: true, provider: 'resend', id: data?.id }
  }

  // O binding EMAIL (`send_email`) fica comentado por padrão em wrangler.jsonc.
  const binding = (env as { EMAIL?: SendEmail }).EMAIL
  if (binding && from) {
    try {
      const result = await binding.send({
        to,
        from,
        replyTo: appConfig.supportEmail,
        subject,
        html,
        text,
      })
      return { sent: true, provider: 'cloudflare', id: result?.messageId }
    } catch (error) {
      const code = (error as { code?: string }).code
      const message = error instanceof Error ? error.message : String(error)
      throw new Error(
        `Falha ao enviar e-mail pelo Cloudflare Email Service${code ? ` (${code})` : ''}: ${message}`,
      )
    }
  }

  if (!isLocalDev()) {
    throw new Error(
      'Nenhum provedor de e-mail configurado. Defina RESEND_API_KEY (ou o binding EMAIL + EMAIL_FROM) antes de publicar.',
    )
  }
  console.log(
    `[email] (nenhum provedor configurado) para: ${to} | assunto: ${subject}\n${text}`,
  )
  return { sent: false, provider: 'console' }
}

// Para e-mails que são efeito colateral de algo mais importante (cadastro, pagamento):
// uma falha de envio nunca deve derrubar a ação principal.
export async function sendEmailSafely(params: SendEmailParams): Promise<void> {
  try {
    await sendEmail(params)
  } catch (err) {
    console.error('[email] falha ao enviar', err)
  }
}
