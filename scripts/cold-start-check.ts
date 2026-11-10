// Teste de regressão do "servidor frio": garante que o servidor de
// desenvolvimento continua servindo páginas depois que o PRIMEIRO pedido que
// ele recebe é abandonado no meio. Uso: `npm run test:cold` (com o
// `npm run dev` desligado; o teste sobe o próprio servidor em outra porta).
//
// O defeito que ele trava (2026-11-10): no `vite dev`, o Worker roda no
// workerd, onde toda operação de entrada e saída pertence ao pedido que a
// começou. Um `import()` dinâmico é uma dessas operações. Se um componente
// `React.lazy` declarado no escopo do módulo é renderizado no servidor, quem
// dispara o `import()` é o primeiro pedido que chega. Quando esse pedido
// termina antes de o módulo carregar (um HEAD, ou alguém que abre a página e
// sai), a promessa fica presa a um pedido morto. Como o `lazy` é do módulo,
// TODOS os pedidos seguintes esperam por ela para sempre: nenhuma página
// responde até reiniciar o servidor. A regra que evita isso está no AGENTS.md
// ("React.lazy só no cliente") e em src/rules.test.ts.
//
// O roteiro: servidor recém-iniciado; para cada página de PAGES, o primeiro
// pedido que ela recebe é abandonado (um HEAD com User-Agent de navegador,
// que termina sem esperar a renderização, ou um GET fechado logo depois de
// enviado); em seguida, um GET comum em cada uma precisa responder inteiro.
// O par mínimo que reproduzia o defeito era HEAD / seguido de GET /.
import { type ChildProcess, spawn } from 'node:child_process'
import net from 'node:net'

const PORT = Number(process.env.COLD_PORT) || 3907
const BASE = `http://localhost:${PORT}`
const BROWSER_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36'
const READY_TIMEOUT_MS = 60_000
const PAGE_TIMEOUT_MS = 10_000

// Uma página de cada tipo: landing, conteúdo MDX, formulário, e a área logada
// (sem sessão ela redireciona para /login, e o `fetch` segue).
const PAGES: Array<{ path: string; abandon: 'head' | 'get' }> = [
  { path: '/', abandon: 'head' },
  { path: '/blog', abandon: 'get' },
  { path: '/login', abandon: 'head' },
  { path: '/app/clientes', abandon: 'get' },
]

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

function startDevServer(): { child: ChildProcess; ready: Promise<void> } {
  const child = spawn(
    'npx',
    ['vite', 'dev', '--port', String(PORT), '--strictPort'],
    { stdio: ['ignore', 'pipe', 'pipe'], detached: true },
  )
  let output = ''
  const ready = new Promise<void>((resolve, reject) => {
    const timer = setTimeout(
      () =>
        reject(new Error(`o servidor não subiu em 60 s. Saída:\n${output}`)),
      READY_TIMEOUT_MS,
    )
    const onData = (chunk: Buffer) => {
      output += chunk.toString()
      if (output.includes('ready in')) {
        clearTimeout(timer)
        resolve()
      }
    }
    child.stdout?.on('data', onData)
    child.stderr?.on('data', onData)
    child.on('exit', (code) => {
      clearTimeout(timer)
      reject(new Error(`o servidor saiu com código ${code}. Saída:\n${output}`))
    })
  })
  return { child, ready }
}

function stop(child: ChildProcess) {
  // `detached: true` deu ao servidor o próprio grupo de processos: o sinal no
  // grupo (pid negativo) leva junto o workerd que o Vite iniciou.
  try {
    if (child.pid) process.kill(-child.pid, 'SIGTERM')
  } catch {
    // já saiu
  }
}

// Pedido abandonado, com User-Agent de navegador. `head`: como o de uma
// ferramenta que só confere se o servidor está de pé; espera a resposta (ou
// 3 s) e fecha. `get`: como quem abre a página e sai; fecha 150 ms depois de
// enviar, sem ler nada.
function abandonedRequest(path: string, kind: 'head' | 'get'): Promise<void> {
  return new Promise((resolve) => {
    const method = kind === 'head' ? 'HEAD' : 'GET'
    let timer: ReturnType<typeof setTimeout>
    const socket = net.connect(PORT, 'localhost', () => {
      socket.write(
        `${method} ${path} HTTP/1.1\r\nHost: localhost:${PORT}\r\nUser-Agent: ${BROWSER_UA}\r\nAccept: text/html\r\n\r\n`,
      )
      timer = setTimeout(done, kind === 'head' ? 3000 : 150)
    })
    const done = () => {
      clearTimeout(timer)
      socket.destroy()
      resolve()
    }
    if (kind === 'head') socket.once('data', done)
    socket.once('error', done)
  })
}

// Devolve o motivo da falha, ou undefined se a página veio inteira.
async function checkPage(path: string): Promise<string | undefined> {
  try {
    const response = await fetch(`${BASE}${path}`, {
      headers: { 'User-Agent': BROWSER_UA },
      signal: AbortSignal.timeout(PAGE_TIMEOUT_MS),
    })
    const html = await response.text()
    if (response.status !== 200) return `${path} respondeu ${response.status}`
    if (!html.includes('</html>'))
      return `${path} veio incompleta (sem </html>)`
  } catch {
    return `${path} não respondeu em ${PAGE_TIMEOUT_MS / 1000} s`
  }
}

async function main() {
  const { child, ready } = startDevServer()
  try {
    await ready
    for (const page of PAGES) {
      await abandonedRequest(page.path, page.abandon)
    }
    await sleep(500)

    let failure: string | undefined
    for (const page of PAGES) {
      failure = await checkPage(page.path)
      if (failure) break
    }

    if (failure) {
      console.error(
        `\nFALHOU: depois de primeiros pedidos abandonados, ${failure}.\n` +
          'Causa provável: um React.lazy (ou outro import() guardado no escopo\n' +
          'do módulo) está sendo renderizado no servidor. Envolva o componente\n' +
          'em <ClientOnly>. Veja "React.lazy só no cliente" no AGENTS.md.\n',
      )
      process.exitCode = 1
    } else {
      console.log(
        'ok: o servidor frio continua servindo páginas depois de primeiros pedidos abandonados.',
      )
    }
  } finally {
    stop(child)
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
