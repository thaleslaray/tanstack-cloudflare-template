import { env } from 'cloudflare:workers'
import { createFileRoute, useRouter } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { useState } from 'react'
import { Button } from '#/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '#/components/ui/card'
import { isRateLimited } from '#/lib/rate-limit'

const increment = createServerFn({ method: 'POST' }).handler(async () => {
  if (await isRateLimited('demo')) {
    throw new Error('Muitas requisições. Tente de novo em um minuto.')
  }
  // `wrangler types` já tipa COUNTER como DurableObjectNamespace<Counter>.
  const counter = env.COUNTER.getByName('global')
  return await counter.increment()
})

export const Route = createFileRoute('/demo/durable-object')({
  component: DemoDO,
})

function DemoDO() {
  const router = useRouter()
  const [value, setValue] = useState<number | null>(null)

  return (
    <main className="demo-page demo-center">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <p className="island-kicker">Estado</p>
          <CardTitle className="text-2xl">Demo do Durable Object</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-4xl font-semibold">{value ?? '—'}</p>
          <Button
            onClick={async () => {
              setValue(await increment())
              router.invalidate()
            }}
          >
            Incrementar
          </Button>
        </CardContent>
      </Card>
    </main>
  )
}
