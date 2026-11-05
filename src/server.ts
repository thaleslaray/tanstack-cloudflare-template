import handler from '@tanstack/react-start/server-entry'
import { DurableObject } from 'cloudflare:workers'
import { isCrossSiteServerFnCall } from '#/lib/same-origin'
import { withSecurityHeaders } from '#/lib/security-headers'
import { runJobs } from '#/lib/jobs'

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
    return withSecurityHeaders(await handler.fetch(request), request)
  },
  async scheduled(event, env, ctx) {
    console.log('[cron]', event.cron)
    ctx.waitUntil(
      runJobs(env).then((result) => console.log('[cron] jobs:', JSON.stringify(result))),
    )
  },
} satisfies ExportedHandler<Env>
