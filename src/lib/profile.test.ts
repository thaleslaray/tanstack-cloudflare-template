import { describe, expect, it } from 'vitest'

import { NAME_MAX_LENGTH, sanitizeProfileUpdate } from './profile'

describe('sanitizeProfileUpdate', () => {
  it('corta o nome no limite', () => {
    const out = sanitizeProfileUpdate({ name: 'a'.repeat(500) })
    expect(out.name).toHaveLength(NAME_MAX_LENGTH)
  })

  it('aceita a URL da foto do próprio app e nulo', () => {
    expect(
      sanitizeProfileUpdate({ image: '/api/avatar/abc123?v=1700000000000' })
        .image,
    ).toBe('/api/avatar/abc123?v=1700000000000')
    expect(sanitizeProfileUpdate({ image: '/api/avatar/abc123' }).image).toBe(
      '/api/avatar/abc123',
    )
    expect(sanitizeProfileUpdate({ image: null })).toEqual({ image: null })
  })

  it('descarta image que não é a foto do app', () => {
    for (const image of [
      'https://evil.com/x.png',
      '//evil.com/api/avatar/x',
      'javascript:alert(1)',
      '/api/avatar/../../x',
      '/outra/coisa',
      42,
    ]) {
      expect(sanitizeProfileUpdate({ name: 'ok', image }).image).toBeUndefined()
    }
  })

  it('não mexe no que não veio', () => {
    expect(sanitizeProfileUpdate({})).toEqual({})
  })
})
