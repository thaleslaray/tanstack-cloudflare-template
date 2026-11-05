import { createFileRoute, useRouter } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { env } from 'cloudflare:workers'
import { getDb } from '#/db/index'
import { desc } from 'drizzle-orm'
import { todos } from '#/db/schema'
import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '#/components/ui/card'
import { Input } from '#/components/ui/input'

const getTodos = createServerFn({
  method: 'GET',
}).handler(async () => {
  const db = getDb(env.DB)
  return await db.query.todos.findMany({
    orderBy: [desc(todos.createdAt)],
  })
})

const createTodo = createServerFn({
  method: 'POST',
})
  .validator((data: { title: string }) => data)
  .handler(async ({ data }) => {
    const db = getDb(env.DB)
    await db.insert(todos).values({ title: data.title })
    return { success: true }
  })

export const Route = createFileRoute('/demo/drizzle')({
  component: DemoDrizzle,
  loader: async () => await getTodos(),
})

function DemoDrizzle() {
  const router = useRouter()
  const todos = Route.useLoaderData()

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.target as HTMLFormElement)
    const title = formData.get('title') as string

    if (!title) return

    try {
      await createTodo({ data: { title } })
      router.invalidate()
      ;(e.target as HTMLFormElement).reset()
    } catch (error) {
      console.error('Falha ao criar tarefa:', error)
    }
  }

  return (
    <main className="demo-page demo-center">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <div className="flex items-center gap-4">
            <span className="flex h-14 w-14 items-center justify-center rounded-lg border p-3">
              <img
                src="/drizzle.svg"
                alt="Logo do Drizzle"
                className="h-8 w-8"
              />
            </span>
            <div>
              <p className="island-kicker mb-2">Banco de dados</p>
              <CardTitle className="text-2xl">Demo do Drizzle</CardTitle>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          <h2 className="text-lg font-semibold">Tarefas</h2>

          <ul className="space-y-3">
            {todos.map((todo) => (
              <li key={todo.id} className="rounded-lg border p-3">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{todo.title}</span>
                  <Badge variant="secondary">#{todo.id}</Badge>
                </div>
              </li>
            ))}
            {todos.length === 0 && (
              <li className="rounded-lg border p-3 text-center text-muted-foreground">
                Nenhuma tarefa ainda. Crie uma abaixo!
              </li>
            )}
          </ul>

          <form
            onSubmit={handleSubmit}
            className="flex flex-col gap-2 sm:flex-row"
          >
            <Input
              type="text"
              name="title"
              placeholder="Adicionar uma nova tarefa..."
              className="min-w-0 flex-1"
            />
            <Button type="submit" className="whitespace-nowrap">
              Adicionar tarefa
            </Button>
          </form>

          <Card className="bg-muted/40">
            <CardHeader>
              <CardTitle className="text-base">Feito com Drizzle ORM</CardTitle>
              <CardDescription>
                Drizzle ORM sobre Cloudflare D1 (SQLite)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p className="font-medium">Como configurar:</p>
              <ol className="list-inside list-decimal space-y-2 text-muted-foreground">
                <li>
                  Rode: <code>npm run db:generate</code>
                </li>
                <li>
                  Rode: <code>npm run db:migrate:local</code>
                </li>
              </ol>
            </CardContent>
          </Card>
        </CardContent>
      </Card>
    </main>
  )
}
