import { useState } from 'react'
import { createFileRoute, useRouter } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { env } from 'cloudflare:workers'
import { Button } from '#/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '#/components/ui/card'
import type { Counter } from '../../server'

const increment = createServerFn({ method: 'POST' }).handler(async () => {
  // cf v2 nao infere a classe do DO em bindings.durableObject com nome de Worker (auto-referencia)
  const counter = (env.COUNTER as DurableObjectNamespace<Counter>).getByName(
    'global',
  )
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
          <p className="text-4xl font-bold">{value ?? '—'}</p>
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
