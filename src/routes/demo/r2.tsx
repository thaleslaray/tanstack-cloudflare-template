import { createFileRoute, useRouter } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { env } from 'cloudflare:workers'

const listFiles = createServerFn({ method: 'GET' }).handler(async () => {
  const { objects } = await env.BUCKET.list()
  const items = await Promise.all(
    objects.map(async (o) => {
      const obj = await env.BUCKET.get(o.key)
      return { key: o.key, size: o.size, content: (await obj?.text()) ?? '' }
    }),
  )
  return items
})

const saveFile = createServerFn({ method: 'POST' })
  .validator((data: { key: string; content: string }) => data)
  .handler(async ({ data }) => {
    await env.BUCKET.put(data.key, data.content)
    return { success: true }
  })

export const Route = createFileRoute('/demo/r2')({
  component: DemoR2,
  loader: async () => await listFiles(),
})

function DemoR2() {
  const router = useRouter()
  const files = Route.useLoaderData()

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = e.target as HTMLFormElement
    const fd = new FormData(form)
    const key = String(fd.get('key') ?? '')
    const content = String(fd.get('content') ?? '')
    if (!key) return
    await saveFile({ data: { key, content } })
    router.invalidate()
    form.reset()
  }

  return (
    <main className="demo-page demo-center">
      <section className="demo-panel w-full max-w-2xl">
        <p className="island-kicker mb-2">Armazenamento</p>
        <h1 className="demo-title mb-6">R2 Demo</h1>

        <ul className="space-y-3 mb-6">
          {files.map((f) => (
            <li key={f.key} className="demo-list-item">
              <div className="flex items-center justify-between">
                <span className="font-medium">{f.key}</span>
                <span className="demo-muted text-xs">{f.size} bytes</span>
              </div>
              <pre className="demo-muted text-xs whitespace-pre-wrap">
                {f.content}
              </pre>
            </li>
          ))}
          {files.length === 0 && (
            <li className="demo-list-item text-center demo-muted">
              Nenhum arquivo ainda.
            </li>
          )}
        </ul>

        <form onSubmit={handleSubmit} className="flex flex-col gap-2">
          <input
            name="key"
            placeholder="nome-do-arquivo.txt"
            className="demo-input"
          />
          <textarea
            name="content"
            placeholder="Conteúdo"
            className="demo-input"
          />
          <button type="submit" className="demo-button">
            Salvar no R2
          </button>
        </form>
      </section>
    </main>
  )
}
