// Demo: existe só no `npm run dev`; em produção responde 404.
import { env } from 'cloudflare:workers'
import { createFileRoute, notFound, useRouter } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { Button } from '#/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '#/components/ui/card'
import { Input } from '#/components/ui/input'
import { Textarea } from '#/components/ui/textarea'
import { isRateLimited } from '#/lib/rate-limit'

// Limites mesmo em dev: nome simples, até 10 KB, no máximo 50 arquivos.
const KEY_RE = /^[\w.-]{1,64}$/
const MAX_CONTENT = 10_000
const PREFIX = 'demo/'

const listFiles = createServerFn({ method: 'GET' }).handler(async () => {
  if (!import.meta.env.DEV) throw notFound()
  const { objects } = await env.BUCKET.list({ prefix: PREFIX, limit: 50 })
  const items = await Promise.all(
    objects
      .filter((o) => o.size <= MAX_CONTENT)
      .map(async (o) => {
        const obj = await env.BUCKET.get(o.key)
        return {
          key: o.key.slice(PREFIX.length),
          size: o.size,
          content: (await obj?.text()) ?? '',
        }
      }),
  )
  return items
})

const saveFile = createServerFn({ method: 'POST' })
  .validator((data: { key: string; content: string }) => data)
  .handler(async ({ data }) => {
    if (!import.meta.env.DEV) throw notFound()
    if (!KEY_RE.test(data.key)) {
      throw new Error(
        'Nome inválido: use até 64 letras, números, ponto, hífen ou sublinhado.',
      )
    }
    if (data.content.length > MAX_CONTENT) {
      throw new Error('O conteúdo pode ter no máximo 10 KB.')
    }
    if (await isRateLimited('demo')) {
      throw new Error('Muitas requisições. Tente de novo em um minuto.')
    }
    await env.BUCKET.put(`${PREFIX}${data.key}`, data.content)
    return { success: true }
  })

export const Route = createFileRoute('/demo/r2')({
  beforeLoad: () => {
    if (!import.meta.env.DEV) throw notFound()
  },
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
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <p className="island-kicker">Armazenamento</p>
          <CardTitle className="text-2xl">Demo do R2</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <ul className="space-y-3">
            {files.map((f) => (
              <li key={f.key} className="rounded-lg border p-3">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{f.key}</span>
                  <span className="text-xs text-muted-foreground">
                    {f.size} bytes
                  </span>
                </div>
                <pre className="text-xs whitespace-pre-wrap text-muted-foreground">
                  {f.content}
                </pre>
              </li>
            ))}
            {files.length === 0 && (
              <li className="rounded-lg border p-3 text-center text-muted-foreground">
                Nenhum arquivo ainda.
              </li>
            )}
          </ul>

          <form onSubmit={handleSubmit} className="flex flex-col gap-2">
            <Input name="key" placeholder="nome-do-arquivo.txt" />
            <Textarea name="content" placeholder="Conteúdo" />
            <Button type="submit">Salvar no R2</Button>
          </form>
        </CardContent>
      </Card>
    </main>
  )
}
