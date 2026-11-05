import handler from '@tanstack/react-start/server-entry'
import { DurableObject } from 'cloudflare:workers'

export class Counter extends DurableObject {
  async increment(): Promise<number> {
    const value = ((await this.ctx.storage.get<number>('value')) ?? 0) + 1
    await this.ctx.storage.put('value', value)
    return value
  }
}

export default {
  fetch(request) {
    return handler.fetch(request)
  },
  async scheduled(event, _env, _ctx) {
    console.log('cron', event.cron)
  },
} satisfies ExportedHandler<Env>
