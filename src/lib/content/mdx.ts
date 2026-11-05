import type { MDXContent } from 'mdx/types'
import type { z } from 'zod'
import type { Heading } from './remark-headings'

// Os arquivos MDX viram módulos ES no build (@mdx-js/rollup, ver vite.config.ts).
// Nada é compilado em runtime: o workerd proíbe `eval`.
//
// Cada coleção usa DOIS `import.meta.glob` sobre os mesmos arquivos, e os dois
// precisam ser literais no ponto da chamada (o Vite os reescreve no build):
//
//   import.meta.glob('/content/x/*.mdx', { query: '?meta', import: 'default', eager: true })
//   import.meta.glob<MdxModule>('/content/x/*.mdx')
//
// O primeiro traz só o frontmatter (mdx-meta-plugin.ts), barato o bastante para
// carregar em toda página. O segundo é o corpo, um chunk preguiçoso por arquivo.
// O zod valida o frontmatter ao importar: frontmatter errado quebra o build, não
// o visitante.

export interface MdxModule {
  default: MDXContent
  frontmatter: unknown
  /** Títulos `##`/`###` com seus ids (remark-headings.ts). */
  headings?: Heading[]
}

/**
 * A promise que `load()` entrega, com os campos que o `use()` do React confere
 * (`status`/`value`/`reason`): depois de resolvida ela é lida de forma síncrona,
 * sem suspender. Interno: quem chama vê uma Promise comum.
 */
type Tracked = Promise<MdxModule> & {
  status?: 'pending' | 'fulfilled' | 'rejected'
  value?: MdxModule
  reason?: unknown
}

export type MdxEntry<T> = T & {
  slug: string
  /**
   * A página compilada, buscada uma vez. Chame no `loader` da rota para o chunk
   * chegar antes da renderização: o MDXContent lê a mesma promise.
   */
  load: () => Promise<MdxModule>
}

function once(importer: () => Promise<MdxModule>): () => Promise<MdxModule> {
  let promise: Tracked | undefined
  return () => {
    if (!promise) {
      const p: Tracked = importer()
      p.status = 'pending'
      p.then(
        (value) => {
          p.status = 'fulfilled'
          p.value = value
        },
        (reason) => {
          p.status = 'rejected'
          p.reason = reason
        },
      )
      promise = p
    }
    return promise
  }
}

export function collect<T>(
  meta: Record<string, unknown>,
  bodies: Record<string, () => Promise<MdxModule>>,
  schema: z.ZodType<T>,
): Array<MdxEntry<T>> {
  return Object.entries(meta).map(([key, frontmatter]) => {
    const path = key.replace(/\?meta$/, '')
    const importer = bodies[path]
    if (!importer) throw new Error(`MDX sem corpo para ${path}`)
    const slug =
      path
        .split('/')
        .pop()
        ?.replace(/\.mdx$/, '') ?? path
    const parsed = schema.safeParse(frontmatter)
    if (!parsed.success) {
      throw new Error(
        `Frontmatter inválido em ${path}: ${parsed.error.message}`,
      )
    }
    return { ...parsed.data, slug, load: once(importer) }
  })
}
