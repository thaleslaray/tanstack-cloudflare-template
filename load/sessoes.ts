// Gera as sessões de teste ANTES de rodar o k6.
//
//   LOG_FILE=/tmp/dev.log BASE_URL=http://localhost:3005 npx tsx load/sessoes.ts
//
// Para cada conta load-<n>@exemplo.test: pede o código de login, lê o código no
// log do servidor (a linha `[auth] código de login para <email>: <código>`,
// igual ao e2e/helpers.ts), confirma o código e guarda os cookies em
// load/.sessoes.json, que o load/p95.js lê.
//
// Variáveis: BASE_URL (padrão http://localhost:3000), LOG_FILE (padrão
// e2e/.dev.log), CONTAS (padrão 5).
//
// Só funciona assim em localhost, onde o código sai no log. Em staging, ou use
// um provedor de e-mail e preencha os cookies à mão, ou passe cookies prontos
// ao k6 com SESSOES_JSON (veja load/README.md).
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const baseUrl = (process.env.BASE_URL || 'http://localhost:3000').replace(
  /\/+$/,
  '',
)
const logFile = path.resolve(
  raiz,
  process.env.LOG_FILE || path.join('e2e', '.dev.log'),
)
const contas = Number(process.env.CONTAS) || 5
const saida = path.join(raiz, 'load', '.sessoes.json')
const local = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(
  baseUrl,
)

if (!local) {
  console.error(
    'BASE_URL não é localhost: o código de login não sai no log local.\n' +
      'Em staging, use um provedor de e-mail e monte o load/.sessoes.json com os\n' +
      'cookies, ou passe SESSOES_JSON ao k6 (veja load/README.md).',
  )
  process.exit(1)
}

function escapar(texto: string) {
  return texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

async function lerCodigo(email: string): Promise<string> {
  const padrao = new RegExp(
    `\\[auth\\] código de login para ${escapar(email)}: (\\d{6})`,
    'g',
  )
  const limite = Date.now() + 15_000
  while (Date.now() < limite) {
    if (fs.existsSync(logFile)) {
      // O último código do log é o mais novo (contas repetidas geram vários).
      const todos = [...fs.readFileSync(logFile, 'utf8').matchAll(padrao)]
      const ultimo = todos.at(-1)
      if (ultimo) return ultimo[1]
    }
    await new Promise((r) => setTimeout(r, 250))
  }
  throw new Error(
    `O código de ${email} não apareceu em ${logFile} em 15 s. ` +
      'O LOG_FILE é o arquivo onde o `vite dev` grava a saída?',
  )
}

async function post(caminho: string, corpo: unknown, ip: string) {
  return fetch(baseUrl + caminho, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin: baseUrl,
      // Um IP de teste por conta: o limite é 5 por minuto por IP e por e-mail.
      'cf-connecting-ip': ip,
    },
    body: JSON.stringify(corpo),
  })
}

const sessoes: { email: string; cookie: string }[] = []

for (let n = 1; n <= contas; n++) {
  const email = `load-${n}@exemplo.test`
  const ip = `10.99.0.${n}`
  const pedido = await post(
    '/api/auth/email-otp/send-verification-otp',
    { email, type: 'sign-in' },
    ip,
  )
  if (!pedido.ok) {
    throw new Error(`Pedir código para ${email}: HTTP ${pedido.status}`)
  }
  const otp = await lerCodigo(email)
  const entrada = await post('/api/auth/sign-in/email-otp', { email, otp }, ip)
  if (!entrada.ok) {
    throw new Error(`Entrar como ${email}: HTTP ${entrada.status}`)
  }
  // Guarda só nome=valor de cada cookie, pronto para o cabeçalho Cookie.
  const cookie = entrada.headers
    .getSetCookie()
    .map((c) => c.split(';')[0])
    .join('; ')
  if (!cookie) throw new Error(`Sem cookie de sessão para ${email}.`)
  sessoes.push({ email, cookie })
  console.log(`ok  ${email}`)
}

fs.writeFileSync(saida, `${JSON.stringify(sessoes, null, 2)}\n`)
console.log(
  `\n${sessoes.length} sessões gravadas em ${path.relative(raiz, saida)}`,
)
