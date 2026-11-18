import { describe, expect, it } from 'vitest'

import { acharSoma, conferirSoma, nomeDoArquivo, sha256 } from './k6-lib.mjs'

describe('nomeDoArquivo', () => {
  it.each([
    ['darwin', 'arm64', 'k6-v1.2.3-macos-arm64.zip'],
    ['darwin', 'x64', 'k6-v1.2.3-macos-amd64.zip'],
    ['linux', 'x64', 'k6-v1.2.3-linux-amd64.tar.gz'],
    ['linux', 'arm64', 'k6-v1.2.3-linux-arm64.tar.gz'],
    ['win32', 'x64', 'k6-v1.2.3-windows-amd64.zip'],
  ])('%s/%s vira %s', (sistema, arq, esperado) => {
    expect(nomeDoArquivo('1.2.3', sistema, arq).arquivo).toBe(esperado)
  })

  it('diz o tipo e o nome do programa', () => {
    expect(nomeDoArquivo('1.2.3', 'win32', 'x64')).toMatchObject({
      tipo: 'zip',
      pasta: 'k6-v1.2.3-windows-amd64',
      programa: 'k6.exe',
    })
    expect(nomeDoArquivo('1.2.3', 'linux', 'x64')).toMatchObject({
      tipo: 'tar.gz',
      programa: 'k6',
    })
  })

  it('combinação sem binário dá erro com o link oficial', () => {
    expect(() => nomeDoArquivo('1.2.3', 'win32', 'arm64')).toThrow(
      /grafana\.com\/docs\/k6\/latest\/set-up\/install-k6/,
    )
    expect(() => nomeDoArquivo('1.2.3', 'freebsd', 'x64')).toThrow(/freebsd/)
  })
})

const h = (c: string) => c.repeat(64)
const texto = [
  `${h('a')}  k6-v1.2.3-linux-amd64.deb`,
  `${h('b')}  k6-v1.2.3-linux-amd64.tar.gz`,
  `${h('c')}  k6-v1.2.3-macos-arm64.zip`,
  '',
].join('\n')

describe('acharSoma', () => {
  it('acha a linha do arquivo certo', () => {
    expect(acharSoma(texto, 'k6-v1.2.3-linux-amd64.tar.gz')).toBe(h('b'))
    expect(acharSoma(texto, 'k6-v1.2.3-macos-arm64.zip')).toBe(h('c'))
  })

  it('aceita fim de linha do Windows e asterisco do modo binário', () => {
    expect(acharSoma(`${h('d')} *x.zip\r\n`, 'x.zip')).toBe(h('d'))
  })

  it('arquivo que não está na lista dá erro', () => {
    expect(() => acharSoma(texto, 'k6-v1.2.3-linux-amd64')).toThrow(/soma/)
  })
})

describe('conferirSoma', () => {
  const dados = Buffer.from('conteúdo')

  it('aceita a soma certa (maiúscula ou minúscula)', () => {
    const s = sha256(dados)
    expect(() => conferirSoma(dados, s)).not.toThrow()
    expect(() => conferirSoma(dados, s.toUpperCase())).not.toThrow()
  })

  it('recusa soma errada', () => {
    expect(() => conferirSoma(dados, 'ab'.repeat(32))).toThrow(/não confere/)
  })
})
