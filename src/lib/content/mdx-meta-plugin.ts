import { readFile } from 'node:fs/promises'
import type { Plugin } from 'vite'
import { parse } from 'yaml'

const QUERY = '?meta'
// A virtual id, not the file's own path with a query: @mdx-js/rollup strips
// the query before matching, so it would compile `x.mdx?meta` as MDX anyway
// (and turn our `export default {…}` into a layout). Plugin filters skip ids
// that start with \0, and the suffix keeps the extension from reading `.mdx`.
const PREFIX = '\0mdx-meta:'
const SUFFIX = '.meta.js'

/**
 * `some.mdx?meta` — the file's frontmatter as a module of its own:
 * `export default { title: … }`, and nothing else.
 *
 * Why it exists: every blog, docs and legal page is listed, titled and
 * validated from its frontmatter in code that runs on EVERY page (route
 * loaders, the docs sidebar, the blog index). Importing `frontmatter` from the
 * compiled .mdx put each file's whole body in the main bundle with it — the
 * bundler cannot split one module in two — and the page bodies were the
 * biggest first-party thing in it. With the metadata in its own module, the
 * body is a lazy chunk that only its own page loads (see lib/content/mdx.ts).
 *
 * Parsed with `yaml`, the same parser remark-mdx-frontmatter uses for the
 * compiled `frontmatter` export, so the two cannot disagree.
 */
export function mdxMeta(): Plugin {
  return {
    name: 'mdx-meta',
    enforce: 'pre',
    async resolveId(source, importer) {
      if (!source.endsWith(`.mdx${QUERY}`)) return null
      const file = await this.resolve(
        source.slice(0, -QUERY.length),
        importer,
        {
          skipSelf: true,
        },
      )
      return file ? `${PREFIX}${file.id}${SUFFIX}` : null
    },
    async load(id) {
      if (!id.startsWith(PREFIX)) return null
      const file = id.slice(PREFIX.length, -SUFFIX.length)
      this.addWatchFile(file)
      const source = await readFile(file, 'utf8')
      const block = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(source)
      const data = block ? (parse(block[1]) ?? {}) : {}
      return `export default ${JSON.stringify(data)}`
    },
  }
}
