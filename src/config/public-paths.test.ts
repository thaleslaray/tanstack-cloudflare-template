import { describe, expect, it } from 'vitest'

import { isPrerenderable } from './public-paths'

describe('isPrerenderable', () => {
  it.each(['/', '/blog', '/blog/x', '/docs', '/docs/x', '/termos', '/blog/x/'])(
    'aceita %s',
    (path) => {
      expect(isPrerenderable(path)).toBe(true)
    },
  )

  it.each(['/login', '/conta', '/demo/r2', '/api/auth/x', '/blog?x=1'])(
    'recusa %s',
    (path) => {
      expect(isPrerenderable(path)).toBe(false)
    },
  )
})
