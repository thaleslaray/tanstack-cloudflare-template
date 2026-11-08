import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { blocosCatalogo, blocosExemplo } from '#/content/blocos-exemplo'
import { landing } from '#/content/landing'
import { LandingBlocks } from './render'
import type { LandingBlock } from './types'

// Os tipos somem na compilação, então a lista de formatos é lida do TEXTO de
// types.ts e render.tsx. É o mesmo truque de src/rules.test.ts: pega o erro
// comum (formato sem `case`, `case` sem formato, formato sem exemplo).
const here = import.meta.dirname
const typesSrc = readFileSync(join(here, 'types.ts'), 'utf8')
const renderSrc = readFileSync(join(here, 'render.tsx'), 'utf8')

const literals = (src: string, re: RegExp) =>
  [...src.matchAll(re)].map((m) => m[1]).sort()

const declared = literals(typesSrc, /\btype:\s*'([a-z-]+)'/g)
const handled = literals(renderSrc, /\bcase\s+'([a-z-]+)'/g)

const html = (blocks: readonly LandingBlock[]) =>
  renderToString(<LandingBlocks blocks={blocks} />)

describe('formatos de bloco da landing', () => {
  it('são 13', () => {
    expect(declared).toHaveLength(13)
  })

  it('render.tsx tem um case para cada tipo de types.ts, e só eles', () => {
    expect(handled).toEqual(declared)
  })

  it('blocos-exemplo.ts tem um exemplo para cada tipo', () => {
    expect(Object.keys(blocosExemplo).sort()).toEqual(declared)
    for (const [type, { exemplo }] of Object.entries(blocosExemplo)) {
      expect(exemplo.type).toBe(type)
    }
  })
})

describe('cada exemplo renderiza', () => {
  it.each(blocosCatalogo.map((b) => [b.type, b] as const))(
    '%s',
    (type, { exemplo }) => {
      const out = html([exemplo])
      expect(out).toContain(`data-block="${type}"`)
      // Todo exemplo leva texto; um bloco que renderiza vazio é bug.
      const visible = out.replace(/<[^>]+>/g, '').trim()
      expect(visible.length).toBeGreaterThan(10)
    },
  )

  it('terminal: o HTML do servidor já traz todas as linhas (sem JS, nada some)', () => {
    const out = html([blocosExemplo.terminal.exemplo])
    expect(out).toContain('data-phase="static"')
    for (const line of blocosExemplo.terminal.exemplo.lines) {
      const text =
        typeof line === 'string' ? line : 'ok' in line ? line.ok : line.out
      expect(out).toContain(text.replace(/&/g, '&amp;'))
    }
  })

  it('gallery: imagens de public/ com lazy, alt e tamanho', () => {
    const out = html([blocosExemplo.gallery.exemplo])
    const imgs = out.match(/<img [^>]+>/g) ?? []
    expect(imgs).toHaveLength(blocosExemplo.gallery.exemplo.items.length)
    for (const img of imgs) {
      expect(img).toContain('loading="lazy"')
      expect(img).toMatch(/alt="[^"]+"/)
      expect(img).toMatch(/width="\d+"/)
      expect(img).toMatch(/src="\/galeria\//)
    }
  })

  it('logos: SVG em string e em componente aparecem', () => {
    const out = html([blocosExemplo.logos.exemplo])
    expect((out.match(/<svg/g) ?? []).length).toBe(4)
  })

  it('logos agrupado: um título por grupo', () => {
    const out = html([
      {
        type: 'logos',
        groups: [
          { title: 'Dados', items: [{ name: 'D1' }, { name: 'R2' }] },
          { title: 'Front', items: [{ name: 'React' }] },
        ],
      },
    ])
    expect(out).toContain('>Dados</h3>')
    expect(out).toContain('>Front</h3>')
    expect(out).toContain('React')
  })
})

describe('landing real (src/content/landing.ts)', () => {
  const order = landing.map((b) => b.type)

  it('stats vem logo depois do hero', () => {
    expect(order.slice(0, 2)).toEqual(['hero', 'stats'])
  })

  it('compare vem logo antes do faq', () => {
    expect(order[order.indexOf('faq') - 1]).toBe('compare')
  })

  it('renderiza um invólucro por bloco', () => {
    const out = html(landing)
    expect((out.match(/data-block="/g) ?? []).length).toBe(landing.length)
  })
})
