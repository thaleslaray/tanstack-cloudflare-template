import { InboxIcon } from 'lucide-react'
import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { TableFrame, Toolbar } from './data-list'
import { EmptyState } from './empty-state'
import { ExemploLista } from './exemplo-lista'
import { Field } from './field'
import { PageSection } from './page-section'
import { StatusDot } from './status'

// As peças da área logada renderizam no servidor (a área logada tem SSR) e
// mantêm o que prometem: rótulo ligado ao campo, erro anunciado, estado com
// texto além da cor.
describe('peças da área logada (src/components/app)', () => {
  it('PageSection mostra título, apoio e conteúdo', () => {
    const html = renderToString(
      <PageSection title="Perfil" description="Como você aparece.">
        <p>conteúdo</p>
      </PageSection>,
    )
    expect(html).toContain('Perfil')
    expect(html).toContain('Como você aparece.')
    expect(html).toContain('conteúdo')
  })

  it('EmptyState mostra a frase e a ação', () => {
    const html = renderToString(
      <EmptyState
        icon={InboxIcon}
        title="Nada por aqui ainda"
        description="Crie o primeiro item."
        action={<button type="button">Criar item</button>}
      />,
    )
    expect(html).toContain('Nada por aqui ainda')
    expect(html).toContain('Criar item')
  })

  it('Field liga o rótulo ao campo e anuncia o erro no lugar da ajuda', () => {
    const ok = renderToString(
      <Field id="nome" label="Nome" hint="Como você aparece.">
        <input id="nome" />
      </Field>,
    )
    expect(ok).toContain('for="nome"')
    expect(ok).toContain('Como você aparece.')

    const bad = renderToString(
      <Field id="email" label="E-mail" hint="ajuda" error="Digite um e-mail.">
        <input id="email" />
      </Field>,
    )
    expect(bad).toContain('role="alert"')
    expect(bad).toContain('Digite um e-mail.')
    expect(bad).not.toContain('ajuda')
  })

  it('StatusDot tem rótulo em texto, e a cor fica só na bolinha', () => {
    const html = renderToString(<StatusDot tone="success">Ativo</StatusDot>)
    expect(html).toContain('Ativo')
    expect(html).toContain('bg-success')
    expect(html).not.toMatch(/text-(success|warning|destructive)/)
  })

  it('Toolbar e TableFrame envolvem o conteúdo', () => {
    const html = renderToString(
      <>
        <Toolbar actions={<button type="button">Novo</button>}>
          <input aria-label="Buscar" />
        </Toolbar>
        <TableFrame>
          <table />
        </TableFrame>
      </>,
    )
    expect(html).toContain('Novo')
    expect(html).toContain('<table')
  })

  it('a tela de lista de referência renderiza com os dados de exemplo', () => {
    const html = renderToString(<ExemploLista />)
    expect(html).toContain('Novo cliente')
    expect(html).toContain('Marina Duarte')
    expect(html).toContain('Pendente')
  })
})
