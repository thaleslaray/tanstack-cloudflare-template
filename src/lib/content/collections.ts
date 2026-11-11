import { collect, type MdxModule } from './mdx'

// Validação do frontmatter sem biblioteca: o zod inteiro (uns 60 KB) entrava
// no JavaScript principal porque o `loader` das rotas de conteúdo mora nele.
// Cada função confere um campo e devolve o valor; erro vira `throw`, e o
// `collect` (mdx.ts) o transforma em "Frontmatter inválido em <arquivo>".
// O build (prerender) importa estes módulos: frontmatter errado quebra o
// build, não o visitante.
type Fields = Record<string, unknown>

function texto(f: Fields, campo: string): string {
  const v = f[campo]
  if (typeof v !== 'string') throw new Error(`"${campo}" precisa ser texto`)
  return v
}

function data(f: Fields, campo: string): string {
  const v = texto(f, campo)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) {
    throw new Error(`"${campo}": use AAAA-MM-DD`)
  }
  return v
}

function numero(f: Fields, campo: string, padrao: number): number {
  const v = f[campo]
  if (v === undefined) return padrao
  if (typeof v !== 'number') throw new Error(`"${campo}" precisa ser número`)
  return v
}

function campos(raw: unknown): Fields {
  if (typeof raw !== 'object' || raw === null) {
    throw new Error('frontmatter precisa ser um objeto')
  }
  return raw as Fields
}

const postSchema = (raw: unknown) => {
  const f = campos(raw)
  return {
    title: texto(f, 'title'),
    description: texto(f, 'description'),
    date: data(f, 'date'),
  }
}

const docSchema = (raw: unknown) => {
  const f = campos(raw)
  return {
    title: texto(f, 'title'),
    description: texto(f, 'description'),
    /** Posição na barra lateral e na ordem de leitura. */
    order: numero(f, 'order', 0),
  }
}

const legalSchema = (raw: unknown) => {
  const f = campos(raw)
  return { title: texto(f, 'title'), updated: data(f, 'updated') }
}

export const posts = collect(
  import.meta.glob('/content/blog/*.mdx', {
    query: '?meta',
    import: 'default',
    eager: true,
  }),
  import.meta.glob<MdxModule>('/content/blog/*.mdx'),
  postSchema,
).sort((a, b) => b.date.localeCompare(a.date))

export const docs = collect(
  import.meta.glob('/content/docs/*.mdx', {
    query: '?meta',
    import: 'default',
    eager: true,
  }),
  import.meta.glob<MdxModule>('/content/docs/*.mdx'),
  docSchema,
).sort((a, b) => a.order - b.order)

export const legal = collect(
  import.meta.glob('/content/legal/*.mdx', {
    query: '?meta',
    import: 'default',
    eager: true,
  }),
  import.meta.glob<MdxModule>('/content/legal/*.mdx'),
  legalSchema,
)

export const postSlugs = posts.map((p) => p.slug)
export const docSlugs = docs.map((d) => d.slug)

/** "2026-11-05" -> "5 de novembro de 2026" (sem depender do fuso do servidor). */
export function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return new Intl.DateTimeFormat('pt-BR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(y, m - 1, d)))
}
