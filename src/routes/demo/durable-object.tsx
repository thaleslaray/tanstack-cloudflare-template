import { useState } from 'react'
import { createFileRoute, useRouter } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { env } from 'cloudflare:workers'
import type { Counter } from '../../server'

const increment = createServerFn({ method: 'POST' }).handler(async () => {
  // cf v2 nao infere a classe do DO em bindings.durableObject com nome de Worker (auto-referencia)
  const counter = (env.COUNTER as DurableObjectNamespace<Counter>).getByName('global')
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
      <section className="demo-panel w-full max-w-2xl">
        <p className="island-kicker mb-2">Estado</p>
        <h1 className="demo-title mb-6">Durable Object Demo</h1>
        <p className="mb-4 text-4xl font-bold">{value ?? '—'}</p>
        <button
          className="demo-button"
          onClick={async () => {
            setValue(await increment())
            router.invalidate()
          }}
        >
          Incrementar
        </button>
      </section>
    </main>
  )
}
