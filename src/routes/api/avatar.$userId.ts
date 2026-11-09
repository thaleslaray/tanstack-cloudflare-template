import { env } from 'cloudflare:workers'
import { createFileRoute } from '@tanstack/react-router'

import { avatarKey, isValidUserId } from '#/lib/avatar'

// A foto é pública (aparece ao lado do nome) e a URL tem versão (`?v=`), então
// o cache pode ser longo e imutável. O ETag permite responder 304 sem corpo.
// Sem `?v=` a URL não muda quando a foto muda: cache curto (5 min).
// `Content-Security-Policy: sandbox` impede que a imagem execute script se
// alguém abrir a URL direto no navegador.
export const Route = createFileRoute('/api/avatar/$userId')({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        if (!isValidUserId(params.userId)) {
          return new Response('Não encontrado.', { status: 404 })
        }
        const object = await env.BUCKET.get(avatarKey(params.userId), {
          onlyIf: request.headers,
        })
        if (!object) return new Response('Não encontrado.', { status: 404 })
        const headers = new Headers({
          'Cache-Control': new URL(request.url).searchParams.has('v')
            ? 'public, max-age=31536000, immutable'
            : 'public, max-age=300',
          'Content-Security-Policy': 'sandbox',
          'X-Content-Type-Options': 'nosniff',
          ETag: object.httpEtag,
          'Content-Type':
            object.httpMetadata?.contentType ?? 'application/octet-stream',
        })
        // Com `onlyIf`, o R2 devolve o objeto sem corpo quando o ETag bate.
        if (!('body' in object))
          return new Response(null, { status: 304, headers })
        return new Response(object.body, { headers })
      },
    },
  },
})
