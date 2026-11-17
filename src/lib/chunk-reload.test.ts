import { describe, expect, it, vi } from 'vitest'

import {
  CHUNK_RELOAD_KEY,
  CHUNK_RELOAD_WINDOW_MS,
  claimChunkReload,
  installChunkReload,
} from './chunk-reload'

function armazem(inicial: Record<string, string> = {}) {
  const dados = { ...inicial }
  return {
    dados,
    getItem: (k: string) => dados[k] ?? null,
    setItem: (k: string, v: string) => {
      dados[k] = v
    },
  }
}

describe('claimChunkReload', () => {
  it('a primeira vez libera e grava a hora', () => {
    const s = armazem()
    expect(claimChunkReload(s, 1_000)).toBe(true)
    expect(s.dados[CHUNK_RELOAD_KEY]).toBe('1000')
  })

  it('de novo dentro da janela não libera (sem laço)', () => {
    const s = armazem({ [CHUNK_RELOAD_KEY]: '1000' })
    expect(claimChunkReload(s, 1_000 + CHUNK_RELOAD_WINDOW_MS - 1)).toBe(false)
  })

  it('passada a janela, um deploy novo pode recarregar de novo', () => {
    const s = armazem({ [CHUNK_RELOAD_KEY]: '1000' })
    expect(claimChunkReload(s, 1_000 + CHUNK_RELOAD_WINDOW_MS)).toBe(true)
  })

  it('sem sessionStorage (ou ele quebrando) não recarrega', () => {
    expect(claimChunkReload(undefined)).toBe(false)
    const quebrado = {
      getItem: () => {
        throw new Error('bloqueado')
      },
      setItem: () => {},
    }
    expect(claimChunkReload(quebrado)).toBe(false)
  })
})

function janelaFalsa(storage = armazem()) {
  const ouvintes: Record<string, (e: Event) => void> = {}
  const reload = vi.fn()
  const win = {
    addEventListener: (nome: string, fn: (e: Event) => void) => {
      ouvintes[nome] = fn
    },
    location: { reload },
    sessionStorage: storage,
  } as unknown as Parameters<typeof installChunkReload>[0]
  const erro = () => {
    const evento = { preventDefault: vi.fn() } as unknown as Event
    ouvintes['vite:preloadError'](evento)
    return evento
  }
  return { win, reload, erro, ouvintes }
}

describe('installChunkReload', () => {
  it('no primeiro erro recarrega e segura o erro do Vite; no segundo, não', () => {
    const { win, reload, erro } = janelaFalsa()
    installChunkReload(win)
    const primeiro = erro()
    expect(reload).toHaveBeenCalledTimes(1)
    expect(primeiro.preventDefault).toHaveBeenCalled()
    const segundo = erro()
    expect(reload).toHaveBeenCalledTimes(1)
    expect(segundo.preventDefault).not.toHaveBeenCalled()
  })

  it('instalar duas vezes liga um ouvinte só', () => {
    const add = vi.fn()
    const win = {
      addEventListener: add,
      location: { reload: vi.fn() },
      sessionStorage: armazem(),
    } as unknown as Parameters<typeof installChunkReload>[0]
    installChunkReload(win)
    installChunkReload(win)
    expect(add).toHaveBeenCalledTimes(1)
  })
})
