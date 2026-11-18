import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// A colocação do Worker no wrangler.jsonc segue o que a Cloudflare documenta
// (https://developers.cloudflare.com/workers/configuration/placement/): UMA
// estratégia só, e `region` no formato `{provedor}:{região}`. Esta conferência
// existe porque o jeito errado (smart + region juntos, ou região sem provedor)
// só aparece no deploy.
function placementDoWrangler(): Record<string, unknown> {
  const texto = readFileSync(
    join(import.meta.dirname, '..', 'wrangler.jsonc'),
    'utf8',
  )
    .split('\n')
    .filter((linha) => !/^\s*\/\//.test(linha))
    .join('\n')
    .replace(/,(\s*[}\]])/g, '$1')
  return JSON.parse(texto).placement
}

describe('placement do wrangler.jsonc', () => {
  const placement = placementDoWrangler()

  it('existe e usa uma estratégia só (mode, region, host ou hostname)', () => {
    expect(placement).toBeTruthy()
    const estrategias = ['mode', 'region', 'host', 'hostname'].filter(
      (k) => k in placement,
    )
    expect(estrategias, 'estratégias de placement se excluem').toHaveLength(1)
  })

  it('mode só aceita smart (ou off); region é {aws|gcp|azure}:região', () => {
    if ('mode' in placement) {
      expect(['smart', 'off']).toContain(placement.mode)
    }
    if ('region' in placement) {
      expect(String(placement.region)).toMatch(/^(aws|gcp|azure):[a-z0-9-]+$/)
    }
  })

  it('o padrão é region: o template tem banco (D1), então o Worker fica fixo perto dele', () => {
    expect(placement).toHaveProperty('region')
    expect(placement).not.toHaveProperty('mode')
  })
})
