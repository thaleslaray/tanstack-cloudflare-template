// Build-time only (vite.config.ts hands it to @mdx-js/rollup): gives every
// `##` and `###` in an MDX page an `id`, and exports the list as
//
//   export const headings = [{ id, text, depth }, …]
//
// from the compiled module. The page reads that list for its table of
// contents. It comes from the same pass that sets the ids, so a TOC link can
// never point at an anchor that isn't there, and it arrives with the body
// chunk the route loader already awaits. The prerendered HTML carries the
// TOC, no client-side DOM scan needed.

export type Heading = { id: string; text: string; depth: 2 | 3 }

type Node = {
  type: string
  depth?: number
  value?: string
  children?: Node[]
  data?: Record<string, unknown>
}

function textOf(node: Node): string {
  if (node.type === 'text' || node.type === 'inlineCode')
    return node.value ?? ''
  return (node.children ?? []).map(textOf).join('')
}

// Lowercase, spaces to hyphens, punctuation out. Letters and digits of any
// script stay, so a Chinese heading gets a readable Chinese anchor.
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

// The export as an ESTree program: MDX compiles `mdxjsEsm` nodes from their
// `estree`, not from the source text.
function exportHeadings(headings: Heading[]) {
  const literal = (value: string | number) => ({ type: 'Literal', value })
  return {
    type: 'mdxjsEsm',
    value: '',
    data: {
      estree: {
        type: 'Program',
        sourceType: 'module',
        body: [
          {
            type: 'ExportNamedDeclaration',
            specifiers: [],
            source: null,
            declaration: {
              type: 'VariableDeclaration',
              kind: 'const',
              declarations: [
                {
                  type: 'VariableDeclarator',
                  id: { type: 'Identifier', name: 'headings' },
                  init: {
                    type: 'ArrayExpression',
                    elements: headings.map((h) => ({
                      type: 'ObjectExpression',
                      properties: Object.entries(h).map(([key, value]) => ({
                        type: 'Property',
                        kind: 'init',
                        method: false,
                        shorthand: false,
                        computed: false,
                        key: { type: 'Identifier', name: key },
                        value: literal(value),
                      })),
                    })),
                  },
                },
              ],
            },
          },
        ],
      },
    },
  }
}

export function remarkHeadings() {
  return (tree: Node) => {
    const headings: Heading[] = []
    const seen = new Map<string, number>()
    for (const node of tree.children ?? []) {
      if (node.type !== 'heading' || (node.depth !== 2 && node.depth !== 3)) {
        continue
      }
      const text = textOf(node).trim()
      const base = slugify(text) || 'section'
      const n = seen.get(base) ?? 0
      seen.set(base, n + 1)
      const id = n === 0 ? base : `${base}-${n}`
      node.data = { ...node.data, hProperties: { id } }
      headings.push({ id, text, depth: node.depth })
    }
    tree.children?.push(exportHeadings(headings))
  }
}
