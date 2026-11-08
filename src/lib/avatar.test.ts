import { describe, expect, it } from 'vitest'

import {
  AVATAR_MAX_BYTES,
  avatarKey,
  avatarUrl,
  checkAvatarFile,
  detectImageType,
  isValidUserId,
} from '#/lib/avatar'

const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]
const JPEG = [0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]
const WEBP = [0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x45, 0x42, 0x50]

describe('avatar', () => {
  it('monta chave do R2 e URL com versão', () => {
    expect(avatarKey('abc')).toBe('avatars/abc')
    expect(avatarUrl('abc', 123)).toBe('/api/avatar/abc?v=123')
  })

  it('aceita só PNG, JPEG e WebP de até 2 MB', () => {
    expect(checkAvatarFile({ type: 'image/png', size: 10 })).toBeNull()
    expect(
      checkAvatarFile({ type: 'image/webp', size: AVATAR_MAX_BYTES }),
    ).toBeNull()
    expect(checkAvatarFile({ type: 'image/gif', size: 10 })?.status).toBe(415)
    expect(checkAvatarFile({ type: 'text/html', size: 10 })?.status).toBe(415)
    expect(
      checkAvatarFile({ type: 'image/jpeg', size: AVATAR_MAX_BYTES + 1 })
        ?.status,
    ).toBe(413)
    expect(checkAvatarFile({ type: 'image/png', size: 0 })?.status).toBe(400)
  })

  it('reconhece o tipo real pelos primeiros bytes', () => {
    expect(detectImageType(new Uint8Array(PNG))).toBe('image/png')
    expect(detectImageType(new Uint8Array(JPEG))).toBe('image/jpeg')
    expect(detectImageType(new Uint8Array(WEBP))).toBe('image/webp')
    const html = new TextEncoder().encode('<html><script>')
    expect(detectImageType(html)).toBeNull()
    expect(detectImageType(new Uint8Array())).toBeNull()
  })

  it('recusa userId com barra ou ponto', () => {
    expect(isValidUserId('Ab3_x-9')).toBe(true)
    expect(isValidUserId('../segredo')).toBe(false)
    expect(isValidUserId('a/b')).toBe(false)
    expect(isValidUserId('')).toBe(false)
  })
})
