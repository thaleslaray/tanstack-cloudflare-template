import { describe, expect, it } from 'vitest'

import { escapeHtml, loginCodeEmail } from './email-templates'

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

describe('escapeHtml', () => {
  it('escapa os caracteres perigosos', () => {
    expect(escapeHtml('<b>"a" & \'b\'</b>')).toBe(
      '&lt;b&gt;&quot;a&quot; &amp; &#39;b&#39;&lt;/b&gt;',
    )
  })
})
