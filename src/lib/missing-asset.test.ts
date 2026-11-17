import { describe, expect, it } from 'vitest'

import { isAssetPath, missingAssetResponse } from './missing-asset'

describe('missing-asset', () => {
  it('reconhece só a pasta /assets/', () => {
    expect(isAssetPath('/assets/index-abc123.js')).toBe(true)
    expect(isAssetPath('/assets/fonts/x.woff2')).toBe(true)
    for (const p of [
      '/',
      '/app',
      '/assets',
      '/blog/assets/x',
      '/meus-assets/x',
    ]) {
      expect(isAssetPath(p), p).toBe(false)
    }
  })

  it('responde 404 em texto puro, sem cache, nunca HTML', async () => {
    const res = missingAssetResponse()
    expect(res.status).toBe(404)
    expect(res.headers.get('content-type')).toContain('text/plain')
    expect(res.headers.get('cache-control')).toBe('no-store')
    expect(await res.text()).not.toContain('<')
  })
})
