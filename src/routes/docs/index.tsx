import { createFileRoute, redirect } from '@tanstack/react-router'
import { docs } from '#/lib/content/collections'

// /docs não tem conteúdo próprio: leva à primeira página, na ordem do `order`.
export const Route = createFileRoute('/docs/')({
  beforeLoad: () => {
    const first = docs[0]
    if (first) {
      throw redirect({ to: '/docs/$slug', params: { slug: first.slug } })
    }
  },
})
