import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { createAuthHarness } from '#/test/auth-harness'

let h: Awaited<ReturnType<typeof createAuthHarness>>

beforeAll(async () => {
  h = await createAuthHarness({ PASSWORD_LOGIN_ENABLED: 'true' })
}, 60_000)
afterAll(() => h?.dispose())

describe('senha contra as mais comuns (Better Auth montado)', () => {
  it('recusa senha comum no cadastro com PASSWORD_TOO_COMMON', async () => {
    const res = await h.post('/sign-up/email', {
      email: 'comum@exemplo.test',
      password: 'password123',
      name: 'Comum',
    })
    expect(res.status).toBe(400)
    expect(((await res.json()) as { code: string }).code).toBe(
      'PASSWORD_TOO_COMMON',
    )
  })

  it('aceita senha boa no cadastro', async () => {
    const res = await h.post('/sign-up/email', {
      email: 'boa@exemplo.test',
      password: 'cavalo-bateria-grampo-7',
      name: 'Boa',
    })
    expect(res.status).toBe(200)
  })
})
