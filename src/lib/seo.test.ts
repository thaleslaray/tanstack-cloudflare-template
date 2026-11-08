import { describe, expect, it } from 'vitest'

import { appConfig } from '#/config/app'
import { seo } from './seo'

describe('seo', () => {
  it('põe o nome do app no fim do título', () => {
    const meta = seo({ title: 'Blog' })
    expect(meta).toContainEqual({ title: `Blog — ${appConfig.name}` })
    expect(meta).toContainEqual({
      property: 'og:title',
      content: `Blog — ${appConfig.name}`,
    })
  })

  it('não repete o nome quando o título já é o nome do app', () => {
    expect(seo({ title: appConfig.name })).toContainEqual({
      title: appConfig.name,
    })
  })

  it('description, article e noindex só aparecem quando pedidos', () => {
    expect(
      seo({ title: 'X' }).some((m) => 'name' in m && m.name === 'description'),
    ).toBe(false)
    const meta = seo({
      title: 'X',
      description: 'Resumo',
      article: true,
      noindex: true,
    })
    expect(meta).toContainEqual({ name: 'description', content: 'Resumo' })
    expect(meta).toContainEqual({ property: 'og:type', content: 'article' })
    expect(meta).toContainEqual({ name: 'robots', content: 'noindex' })
  })
})
