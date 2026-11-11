import { env, waitUntil } from 'cloudflare:workers'
import { createFileRoute } from '@tanstack/react-router'
import { eq } from 'drizzle-orm'

import { user } from '#/db/auth-schema'
import { getDb } from '#/db/index'
import { audit, requestMeta } from '#/lib/audit'
import { getAuth } from '#/lib/auth'
import {
  AVATAR_MAX_BYTES,
  avatarKey,
  avatarUrl,
  checkAvatarFile,
  detectImageType,
} from '#/lib/avatar'
import { isRateLimited, tooManyRequests } from '#/lib/rate-limit'
import { isCrossSiteRequest } from '#/lib/same-origin'

const text = (message: string, status: number) =>
  new Response(message, {
    status,
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  })

// Troca a foto de perfil: POST multipart com UM campo `file`. Não existe
// "remover", só substituir. Quem chama: src/components/account/avatar-upload.tsx.
export const Route = createFileRoute('/api/avatar')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // Rota de API não passa pela checagem das server functions: o cookie
        // vai junto, então recusamos aqui chamadas vindas de outro site.
        if (isCrossSiteRequest(request)) {
          return text('Requisição cross-site recusada.', 403)
        }
        // `disableCookieCache`: escrita em nome do usuário, lê a sessão no banco.
        const session = await getAuth(env, request).api.getSession({
          headers: request.headers,
          query: { disableCookieCache: true },
        })
        if (!session) return text('Entre na sua conta primeiro.', 401)
        // Depois da sessão: um anônimo não consegue gastar a cota de alguém.
        if (await isRateLimited('avatar', { headers: request.headers })) {
          return tooManyRequests()
        }
        // Barra corpo gigante antes de ler (folga para o envelope multipart).
        // Sem Content-Length não dá para saber o tamanho antes de ler: recusa.
        const lengthHeader = request.headers.get('content-length')
        if (lengthHeader === null) {
          return text('Envie o tamanho do arquivo (Content-Length).', 411)
        }
        const length = Number(lengthHeader)
        if (!Number.isFinite(length) || length > AVATAR_MAX_BYTES + 64 * 1024) {
          return text('A imagem precisa ter no máximo 2 MB.', 413)
        }

        const form = await request.formData().catch(() => null)
        const file = form?.get('file')
        if (!(file instanceof File)) {
          return text('Envie a imagem no campo "file".', 400)
        }
        const problem = checkAvatarFile(file)
        if (problem) return text(problem.message, problem.status)
        const bytes = new Uint8Array(await file.arrayBuffer())
        // O tipo vem dos bytes, não do que o navegador declarou.
        const type = detectImageType(bytes)
        if (!type) return text('Use uma imagem PNG, JPEG ou WebP.', 415)

        const userId = session.user.id
        await env.BUCKET.put(avatarKey(userId), bytes, {
          httpMetadata: { contentType: type },
        })
        const image = avatarUrl(userId, Date.now())
        await getDb(env.DB)
          .update(user)
          .set({ image, updatedAt: new Date() })
          .where(eq(user.id, userId))

        await audit(
          {
            action: 'account.avatar_set',
            actorId: userId,
            actorEmail: session.user.email,
            targetType: 'user',
            targetId: userId,
            meta: { type, size: bytes.byteLength },
            ...requestMeta(request.headers),
          },
          { waitUntil },
        )
        // A foto mudou direto no banco (não pelo Better Auth): o cookie de cache
        // da sessão ainda tem a foto velha. Relê do banco e devolve o cookie novo.
        const refreshed = await getAuth(env, request).api.getSession({
          headers: request.headers,
          query: { disableCookieCache: true },
          returnHeaders: true,
        })
        const res = Response.json({ image })
        for (const cookie of refreshed.headers.getSetCookie()) {
          res.headers.append('Set-Cookie', cookie)
        }
        return res
      },
    },
  },
})
