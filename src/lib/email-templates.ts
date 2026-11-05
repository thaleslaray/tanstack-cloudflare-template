import { appConfig } from '#/config/app'

// HTML de e-mail: só estilos inline (clientes de e-mail removem <style>),
// sans-serif e uma única cor de tinta.
const ink = '#1f2937'
const muted = '#6b7280'

export function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

// `bodyHtml` deve chegar já escapado.
export function layout({ title, bodyHtml }: { title: string; bodyHtml: string }): string {
  return `<!doctype html>
<html lang="pt-BR">
<body style="margin:0;padding:0;background:#f3f4f6">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:12px;padding:32px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:${ink};line-height:1.55">
<tr><td style="font-size:22px;font-weight:700;padding-bottom:12px;color:${ink}">${escapeHtml(title)}</td></tr>
<tr><td style="font-size:15px;color:${ink}">${bodyHtml}</td></tr>
<tr><td style="padding-top:28px;font-size:12px;color:${muted}">${escapeHtml(appConfig.name)}</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`
}

export function loginCodeEmail({ code, minutes }: { code: string; minutes: number }) {
  const subject = `${code} é seu código de acesso — ${appConfig.name}`
  const html = layout({
    title: 'Seu código de acesso',
    bodyHtml: `<p style="margin:0 0 16px">Use o código abaixo para entrar. Ele vale por ${minutes} minutos.</p>
<p style="margin:0 0 16px;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:32px;font-weight:700;letter-spacing:0.3em;color:${ink}">${escapeHtml(code)}</p>
<p style="margin:0;color:${muted};font-size:13px">Se você não pediu este código, ignore este e-mail.</p>`,
  })
  const text = `Use o código abaixo para entrar. Ele vale por ${minutes} minutos.

${code}

Se você não pediu este código, ignore este e-mail.

${appConfig.name}`
  return { subject, html, text }
}
