import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { lint } from '@google/design.md/linter'
import { describe, expect, it } from 'vitest'
import { parse } from 'yaml'

// O DESIGN.md descreve o tema padrão (`:root` e `.dark` do src/styles.css).
// Estes testes fazem o arquivo e o código andarem juntos: valor que muda de
// um lado sem mudar do outro deixa o teste vermelho. Os temas
// `[data-theme=...]` ficam de fora, como no DESIGN.md.

const ROOT = join(import.meta.dirname, '..')
const designMd = readFileSync(join(ROOT, 'DESIGN.md'), 'utf8')
const css = readFileSync(join(ROOT, 'src/styles.css'), 'utf8')

type Tokens = Record<string, unknown>
type Vars = Record<string, string>

// Junta todos os blocos ```yaml do DESIGN.md num só objeto.
function designTokens(): Tokens {
  const merged: Tokens = {}
  for (const match of designMd.matchAll(/```yaml\n([\s\S]*?)```/g)) {
    Object.assign(merged, parse(match[1]) as Tokens)
  }
  return merged
}

// Variáveis CSS de um bloco de tema (`:root {` ou `.dark {` no começo da linha).
function cssBlock(selector: string): Vars {
  const header = new RegExp(`^${selector.replace('.', '\\.')}\\s*\\{`, 'm')
  const start = css.search(header)
  if (start === -1)
    throw new Error(`Bloco ${selector} não achado no styles.css`)
  const open = css.indexOf('{', start)
  const body = css.slice(open + 1, css.indexOf('}', open))
  const vars: Vars = {}
  for (const m of body.matchAll(/^\s*--([\w-]+):\s*([^;]+);/gm)) {
    vars[m[1]] = m[2].trim()
  }
  return vars
}

const isColor = (value: string) => /^(#|rgba?\()/.test(value)

const tokens = designTokens()
const colors = (tokens.colors ?? {}) as Record<string, unknown>
const light = (colors.light ?? {}) as Record<string, string>
const dark = (colors.dark ?? {}) as Record<string, string>
const shared = Object.fromEntries(
  Object.entries(colors).filter(
    ([name]) => name !== 'light' && name !== 'dark',
  ),
) as Record<string, string>
const root = cssBlock(':root')
const darkCss = cssBlock('.dark')

describe('DESIGN.md e src/styles.css', () => {
  it('toda cor do DESIGN.md tem o mesmo valor no CSS, nos dois modos', () => {
    const errors: string[] = []
    const check = (token: string, doc: string, css: string | undefined) => {
      if (css !== doc) {
        errors.push(
          `${token}: DESIGN.md diz ${doc}, styles.css diz ${css ?? '(sem a variável)'}`,
        )
      }
    }
    for (const [name, value] of Object.entries(light)) {
      check(`colors.light.${name}`, value, root[name])
    }
    for (const [name, value] of Object.entries(dark)) {
      check(`colors.dark.${name}`, value, darkCss[name])
    }
    for (const [name, value] of Object.entries(shared)) {
      check(`colors.${name} (:root)`, value, root[name])
      // No .dark só vale se ele redefinir a cor.
      if (name in darkCss) check(`colors.${name} (.dark)`, value, darkCss[name])
    }
    expect(errors).toEqual([])
  })

  it('toda variável de cor do CSS está documentada no DESIGN.md', () => {
    const missing: string[] = []
    for (const [name, value] of Object.entries(root)) {
      if (isColor(value) && !(name in light) && !(name in shared)) {
        missing.push(`--${name} (:root, ${value}) não está no DESIGN.md`)
      }
    }
    for (const [name, value] of Object.entries(darkCss)) {
      if (isColor(value) && !(name in dark) && !(name in shared)) {
        missing.push(`--${name} (.dark, ${value}) não está no DESIGN.md`)
      }
    }
    expect(missing).toEqual([])
  })

  it('cantos e sombras batem com o CSS', () => {
    const rounded = (tokens.rounded ?? {}) as Record<string, string>
    const shadows = (tokens.shadows ?? {}) as Record<string, string>
    const pairs: Array<[string, string | undefined, string | undefined]> = [
      ['rounded.btn', rounded.btn, root['radius-btn']],
      ['rounded.card', rounded.card, root['radius-card']],
      ['rounded.lg', rounded.lg, root.radius],
      ['shadows.btn', shadows.btn, root['shadow-btn']],
      ['shadows.card', shadows.card, root['shadow-card']],
    ]
    const errors = pairs
      .filter(([, doc, value]) => doc !== value)
      .map(
        ([name, doc, value]) =>
          `${name}: DESIGN.md diz ${doc}, styles.css diz ${value}`,
      )
    expect(errors).toEqual([])
  })

  it('toda referência `@caminho/arquivo.ext` aponta para um arquivo que existe', () => {
    const refs = [...designMd.matchAll(/`@([^`\s]+\.[A-Za-z0-9]+)`/g)].map(
      (m) => m[1],
    )
    expect(refs.length).toBeGreaterThan(0)
    const missing = refs
      .filter((path) => !existsSync(join(ROOT, path)))
      .map((path) => `@${path}: arquivo não existe`)
    expect(missing).toEqual([])
  })

  it('o lint do formato não tem erro', () => {
    // Avisos podem existir (na 0.4.0: missing-primary e o de motion).
    const report = lint(designMd)
    const errors = report.findings
      .filter((f) => f.severity === 'error')
      .map((f) => `${f.path ?? ''} ${f.message}`)
    expect(errors).toEqual([])
    expect(report.summary.errors).toBe(0)
  })
})
