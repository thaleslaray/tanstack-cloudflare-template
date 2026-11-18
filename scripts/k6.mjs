// Roda o k6 sem o usuário instalar nada: usa K6_BIN, ou o k6 do PATH, ou
// baixa a versão fixa do site oficial (GitHub da Grafana), confere a soma
// SHA-256 e guarda em node_modules/.cache/k6/<versão>/.
// Uso: node scripts/k6.mjs run load/p95.js   (igual a `k6 run load/p95.js`)
import { spawn, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { acharSoma, conferirSoma, nomeDoArquivo } from './k6-lib.mjs'

// Versão fixa (estável de 18/11/2026). Para trocar, mude aqui e rode de novo.
const VERSAO = '2.4.0'
const BASE = `https://github.com/grafana/k6/releases/download/v${VERSAO}`

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

async function baixar(url) {
  const r = await fetch(url, { redirect: 'follow' })
  if (!r.ok) throw new Error(`Falha ao baixar ${url}: HTTP ${r.status}`)
  return Buffer.from(await r.arrayBuffer())
}

function k6NoPath() {
  const r = spawnSync('k6', ['version'], { stdio: 'ignore' })
  return r.status === 0
}

async function garantirBinario() {
  const { arquivo, pasta, programa } = nomeDoArquivo(
    VERSAO,
    process.platform,
    process.arch,
  )
  const destino = path.join(raiz, 'node_modules', '.cache', 'k6', VERSAO)
  const binario = path.join(destino, programa)
  if (fs.existsSync(binario)) return binario

  console.error(`[k6] baixando k6 v${VERSAO} (${arquivo})...`)
  const soma = acharSoma(
    (await baixar(`${BASE}/k6-v${VERSAO}-checksums.txt`)).toString('utf8'),
    arquivo,
  )
  const dados = await baixar(`${BASE}/${arquivo}`)
  conferirSoma(dados, soma) // diferente: lança erro, nada é gravado nem rodado
  console.error('[k6] soma SHA-256 conferida.')

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'k6-'))
  try {
    const arq = path.join(tmp, arquivo)
    fs.writeFileSync(arq, dados)
    // O tar do Mac, do Linux e do Windows 10+ abre .tar.gz e .zip.
    const x = spawnSync('tar', ['-xf', arq, '-C', tmp], { stdio: 'inherit' })
    if (x.status !== 0) throw new Error('Não consegui extrair o arquivo do k6.')
    fs.mkdirSync(destino, { recursive: true })
    fs.copyFileSync(path.join(tmp, pasta, programa), binario)
    if (process.platform !== 'win32') fs.chmodSync(binario, 0o755)
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true })
  }
  return binario
}

async function main() {
  let comando
  if (process.env.K6_BIN) comando = process.env.K6_BIN
  else if (k6NoPath()) comando = 'k6'
  else comando = await garantirBinario()

  const filho = spawn(comando, process.argv.slice(2), { stdio: 'inherit' })
  filho.on('error', (e) => {
    console.error(`[k6] não consegui rodar ${comando}: ${e.message}`)
    process.exit(1)
  })
  filho.on('exit', (codigo, sinal) => {
    process.exit(codigo ?? (sinal ? 1 : 0))
  })
}

main().catch((e) => {
  console.error(`[k6] ${e.message}`)
  process.exit(1)
})
