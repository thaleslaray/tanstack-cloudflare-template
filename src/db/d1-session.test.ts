import { describe, expect, it, vi } from 'vitest'

import {
  bookmarkCookie,
  bookmarkFromRequest,
  currentD1Session,
  isValidBookmark,
  type RequestD1Session,
  runWithD1Session,
  withD1Bookmark,
} from './d1-session'

const BOOKMARK = '00000085-0000024c-00004c6d-8e61117bf38d7adb71b934ebbf891683'
const fakeSession = (bookmark: string | null): RequestD1Session => ({
  prepare: vi.fn(),
  batch: vi.fn(),
  getBookmark: () => bookmark,
})
const req = (cookie?: string, url = 'http://localhost:3000/') =>
  new Request(url, { headers: cookie ? { cookie } : {} })

describe('isValidBookmark', () => {
  it('aceita o formato de bookmark do D1', () => {
    expect(isValidBookmark(BOOKMARK)).toBe(true)
  })
  it('recusa texto fora do formato', () => {
    for (const bad of [
      '',
      'abc',
      'x-y-z',
      '<script>',
      `${BOOKMARK};evil=1`,
      'a'.repeat(300),
      42,
      null,
    ]) {
      expect(isValidBookmark(bad)).toBe(false)
    }
  })
})

describe('bookmarkFromRequest', () => {
  it('lê o cookie d1-bookmark entre outros', () => {
    expect(bookmarkFromRequest(req(`a=1; d1-bookmark=${BOOKMARK}; b=2`))).toBe(
      BOOKMARK,
    )
  })
  it('ignora cookie ausente ou inválido', () => {
    expect(bookmarkFromRequest(req())).toBeUndefined()
    expect(bookmarkFromRequest(req('a=1'))).toBeUndefined()
    expect(bookmarkFromRequest(req('d1-bookmark=lixo'))).toBeUndefined()
  })
})

describe('bookmarkCookie', () => {
  it('só marca Secure em https', () => {
    expect(bookmarkCookie(BOOKMARK, req())).not.toContain('Secure')
    const https = bookmarkCookie(
      BOOKMARK,
      req(undefined, 'https://app.exemplo.com/'),
    )
    expect(https).toContain('Secure')
    expect(https).toContain('HttpOnly')
    expect(https).toContain('SameSite=Lax')
    expect(https).toContain('Max-Age=3600')
  })
})

describe('withD1Bookmark', () => {
  it('grava o bookmark no Set-Cookie e mantém o corpo', async () => {
    const res = withD1Bookmark(new Response('ok'), fakeSession(BOOKMARK), req())
    expect(res.headers.get('set-cookie')).toContain(`d1-bookmark=${BOOKMARK}`)
    expect(await res.text()).toBe('ok')
  })
  it('sem bookmark devolve a mesma resposta', () => {
    const original = new Response('ok')
    expect(withD1Bookmark(original, fakeSession(null), req())).toBe(original)
  })
  it('funciona com headers imutáveis (redirect)', () => {
    const res = withD1Bookmark(
      Response.redirect('http://localhost:3000/x', 302),
      fakeSession(BOOKMARK),
      req(),
    )
    expect(res.status).toBe(302)
    expect(res.headers.get('set-cookie')).toContain('d1-bookmark=')
  })
})

describe('runWithD1Session', () => {
  it('só existe dentro do pedido', async () => {
    const session = fakeSession(null)
    expect(currentD1Session()).toBeUndefined()
    await runWithD1Session(session, async () => {
      await Promise.resolve()
      expect(currentD1Session()).toBe(session)
    })
    expect(currentD1Session()).toBeUndefined()
  })
})
