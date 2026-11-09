import { describe, expect, it } from 'vitest'

import {
  accountClosedEmail,
  accountPurgeReminderEmail,
  emailVerificationCodeEmail,
  escapeHtml,
  formatDateBR,
  loginCodeEmail,
} from './email-templates'

describe('loginCodeEmail', () => {
  it('traz o código no assunto, no html e no texto', () => {
    const { subject, html, text } = loginCodeEmail({
      code: '123456',
      minutes: 10,
    })
    expect(subject).toContain('123456')
    expect(html).toContain('123456')
    expect(text).toContain('123456')
  })

  it('informa a validade em minutos', () => {
    const { html, text } = loginCodeEmail({ code: '000000', minutes: 15 })
    expect(html).toContain('15 minutos')
    expect(text).toContain('15 minutos')
  })
})

describe('emailVerificationCodeEmail', () => {
  it('traz o código no assunto, no html e no texto', () => {
    const { subject, html, text } = emailVerificationCodeEmail({
      code: '654321',
      minutes: 10,
    })
    expect(subject).toContain('654321')
    expect(html).toContain('654321')
    expect(text).toContain('654321')
  })

  it('informa a validade e escapa o código no html', () => {
    const { html, text } = emailVerificationCodeEmail({
      code: '<b>',
      minutes: 10,
    })
    expect(text).toContain('10 minutos')
    expect(html).toContain('&lt;b&gt;')
    expect(html).not.toContain('<b>')
  })
})

describe('escapeHtml', () => {
  it('escapa os caracteres perigosos', () => {
    expect(escapeHtml('<b>"a" & \'b\'</b>')).toBe(
      '&lt;b&gt;&quot;a&quot; &amp; &#39;b&#39;&lt;/b&gt;',
    )
  })
})

describe('e-mails de conta encerrada', () => {
  const purgeAt = new Date('2026-11-14T15:00:00Z')

  it('formata a data em pt-BR, no fuso de Brasília', () => {
    expect(formatDateBR(purgeAt)).toBe('14 de novembro de 2026')
  })

  it('encerramento: diz quando apaga e como recuperar', () => {
    const { subject, html, text } = accountClosedEmail({ purgeAt })
    expect(subject).toContain('encerrada')
    for (const body of [html, text]) {
      expect(body).toContain('14 de novembro de 2026')
      expect(body).toContain('suporte@exemplo.com.br')
    }
  })

  it('lembrete: traz a data no assunto', () => {
    const { subject, text } = accountPurgeReminderEmail({ purgeAt })
    expect(subject).toContain('14 de novembro de 2026')
    expect(text).toContain('apagados definitivamente')
  })
})
