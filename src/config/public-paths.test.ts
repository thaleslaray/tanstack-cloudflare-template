import { describe, expect, it } from 'vitest'

import {
  isPrerenderable,
  ROBOTS_DISALLOW,
  SITEMAP_STATIC_PATHS,
} from './public-paths'

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

describe('sitemap e robots', () => {
  it('toda página fixa do sitemap é pré-renderizável', () => {
    for (const path of SITEMAP_STATIC_PATHS) {
      expect(isPrerenderable(path)).toBe(true)
    }
  })

  it('nada bloqueado no robots.txt é pré-renderizável', () => {
    for (const path of ROBOTS_DISALLOW) {
      expect(isPrerenderable(path.replace(/\/$/, '/x'))).toBe(false)
    }
  })
})
