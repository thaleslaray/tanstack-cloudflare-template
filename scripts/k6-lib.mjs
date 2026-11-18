// Funções puras do scripts/k6.mjs: sem rede e sem disco, para testar fácil.
import { createHash } from 'node:crypto'

export const LINK_INSTALAR =
  'https://grafana.com/docs/k6/latest/set-up/install-k6/'

const SISTEMAS = { darwin: 'macos', linux: 'linux', win32: 'windows' }
const ARQUITETURAS = { x64: 'amd64', arm64: 'arm64' }
// Combinações que o k6 não publica como arquivo avulso.
const SEM_BINARIO = new Set(['windows-arm64'])

// Nome do arquivo oficial do k6 para este sistema e esta arquitetura.
export function nomeDoArquivo(versao, sistema, arquitetura) {
  const so = SISTEMAS[sistema]
  const arq = ARQUITETURAS[arquitetura]
  if (!so || !arq || SEM_BINARIO.has(`${so}-${arq}`)) {
    throw new Error(
      `Não há k6 avulso para ${sistema}/${arquitetura}. Instale pelas formas oficiais: ${LINK_INSTALAR} (ou aponte K6_BIN para o programa).`,
    )
  }
  const tipo = so === 'linux' ? 'tar.gz' : 'zip'
  const pasta = `k6-v${versao}-${so}-${arq}`
  return {
    arquivo: `${pasta}.${tipo}`,
    tipo,
    pasta,
    programa: so === 'windows' ? 'k6.exe' : 'k6',
  }
}

// Lê o arquivo de somas ("<sha256>  <arquivo>" por linha) e acha a do arquivo.
export function acharSoma(texto, arquivo) {
  for (const linha of texto.split(/\r?\n/)) {
    const m = linha.trim().match(/^([0-9a-fA-F]{64})\s+\*?(.+)$/)
    if (m && m[2] === arquivo) return m[1].toLowerCase()
  }
  throw new Error(`A soma de ${arquivo} não está no arquivo de somas.`)
}

export function sha256(dados) {
  return createHash('sha256').update(dados).digest('hex')
}

// Recusa (lança erro) se a soma dos dados não for a esperada.
export function conferirSoma(dados, esperada) {
  const real = sha256(dados)
  if (real !== esperada.toLowerCase()) {
    throw new Error(
      `A soma SHA-256 não confere (esperada ${esperada.toLowerCase()}, veio ${real}).`,
    )
  }
}
