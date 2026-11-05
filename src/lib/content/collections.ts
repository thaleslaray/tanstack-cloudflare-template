import { z } from 'zod'
import { collect, type MdxModule } from './mdx'

const data = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'use AAAA-MM-DD')

const postSchema = z.object({
  title: z.string(),
  description: z.string(),
  date: data,
})

const docSchema = z.object({
  title: z.string(),
  description: z.string(),
  /** Posição na barra lateral e na ordem de leitura. */
  order: z.number().default(0),
})

const legalSchema = z.object({
  title: z.string(),
  updated: data,
})

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
