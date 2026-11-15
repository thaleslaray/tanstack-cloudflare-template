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

describe('/update-user (Better Auth montado)', () => {
  it('descarta image externa e corta o nome', async () => {
    const { cookie, body } = await h.signIn('perfil@exemplo.test')
    const res = await h.post(
      '/update-user',
      { name: 'n'.repeat(400), image: 'https://evil.com/x.png' },
      { cookie },
    )
    expect(res.status).toBe(200)
    const row = await h.db
      .prepare('select name, image from user where id = ?')
      .bind(body.user.id)
      .first<{ name: string; image: string | null }>()
    expect(row?.name).toHaveLength(100)
    expect(row?.image).toBeNull()
  })

  it('aceita a URL da foto do próprio app', async () => {
    const { cookie, body } = await h.signIn('perfil2@exemplo.test')
    const image = `/api/avatar/${body.user.id}?v=1`
    const res = await h.post('/update-user', { image }, { cookie })
    expect(res.status).toBe(200)
    const row = await h.db
      .prepare('select image from user where id = ?')
      .bind(body.user.id)
      .first<{ image: string | null }>()
    expect(row?.image).toBe(image)
  })
})
