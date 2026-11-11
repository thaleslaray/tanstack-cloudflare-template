import { DurableObject, env } from 'cloudflare:workers'
import handler from '@tanstack/react-start/server-entry'
// Registra o sink da auditoria no D1 (audit_log). Sem esta linha, audit() é no-op.
import '#/lib/audit-d1'
// Registra o que cada módulo faz ao encerrar a conta e no "baixar meus dados".
import '#/lib/account-handlers'
import {
  bookmarkFromRequest,
  runWithD1Session,
  withD1Bookmark,
} from '#/db/d1-session'
import { D1_TRACE_HEADER, rastrearD1 } from '#/db/d1-trace'
import { runJobs } from '#/lib/jobs'
import { isCrossSiteServerFnCall } from '#/lib/same-origin'
import { withSecurityHeaders } from '#/lib/security-headers'

export class Counter extends DurableObject {
  async increment(): Promise<number> {
    const value = ((await this.ctx.storage.get<number>('value')) ?? 0) + 1
    await this.ctx.storage.put('value', value)
    return value
  }
}

export default {
  async fetch(request) {
    // Server functions só aceitam chamadas da própria origem (defesa contra CSRF).
    if (isCrossSiteServerFnCall(request)) {
      return withSecurityHeaders(
        new Response('Requisição cross-site recusada.', { status: 403 }),
        request,
      )
    }
    // Uma sessão D1 por pedido (Sessions API), compartilhada por todo `getDb`
    // chamado durante ele. O cookie `d1-bookmark` do pedido anterior garante que
    // quem acabou de escrever leia a própria escrita, mesmo vindo de uma réplica.
    const session = env.DB.withSession(
      bookmarkFromRequest(request) ?? 'first-unconstrained',
    )
    // Só em dev e com o header `x-d1-trace: 1`: conta as idas ao D1 do pedido.
    const trace =
      import.meta.env.DEV && request.headers.get(D1_TRACE_HEADER) === '1'
        ? rastrearD1(
            session,
            `${request.method} ${new URL(request.url).pathname}`,
          )
        : null
    const res = await runWithD1Session(trace?.sessao ?? session, () =>
      handler.fetch(request),
    )
    trace?.fim()
    return withSecurityHeaders(withD1Bookmark(res, session, request), request)
  },
  async scheduled(event, env, ctx) {
    console.log('[cron]', event.cron)
    ctx.waitUntil(
      runJobs(env).then((result) =>
        console.log('[cron] jobs:', JSON.stringify(result)),
      ),
    )
  },
} satisfies ExportedHandler<Env>
