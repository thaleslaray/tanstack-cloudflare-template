// Teste de carga com metas de p95. Rode com `npm run load` (veja load/README.md).
//
// Cinco cenários, cada um com a tag `cenario` e a sua própria meta:
//   estatico         GET / e /blog (páginas pré-renderizadas)          p95 < 100 ms
//   ssr_publico      GET /login (renderizada no Worker)                p95 < 300 ms
//   ssr_logado       GET /app e /app/clientes, com cookie de sessão    p95 < 500 ms
//   escrita_logada   cria um cliente (server function) e o apaga       p95 < 600 ms
//   rajada_login     8 POSTs seguidos de pedir código de login         a partir do 6º, 429
//
// As sessões vêm de `npm run load:sessoes` (load/.sessoes.json) ou de SESSOES_JSON.
import { check, fail } from 'k6'
import http from 'k6/http'

import {
  BASE_URL,
  cabecalhos,
  cenario,
  cenarioRajada,
  ipDeTeste,
  isLocal,
  PROFILE,
} from './config.js'

// --- Sessões --------------------------------------------------------------
// Formato: [{ "email": "...", "cookie": "nome=valor; outro=valor" }, ...]
// SESSOES_JSON aceita o JSON em si ou o caminho de um arquivo (relativo a este).
function lerSessoes() {
  let texto = __ENV.SESSOES_JSON
  if (texto && !texto.trim().startsWith('[')) texto = open(texto)
  if (!texto) {
    try {
      texto = open('./.sessoes.json')
    } catch (_) {
      return []
    }
  }
  return JSON.parse(texto)
}
const sessoes = lerSessoes()

const SEM_RAJADA = __ENV.SEM_RAJADA === '1'

function cookieDoVU() {
  return sessoes[(__VU - 1) % sessoes.length].cookie
}

export const options = {
  // O `vite dev` escuta só em ::1; o k6 tentaria 127.0.0.1 e levaria "connection refused".
  ...(isLocal() ? { dns: { policy: 'preferIPv6' } } : {}),
  // SEM_RAJADA=1 tira a rajada no login: contra um app publicado ela mandaria
  // e-mails de verdade pelo provedor e gastaria a cota de envio.
  scenarios: {
    estatico: cenario('estatico', 'estatico'),
    ssr_publico: cenario('ssr_publico', 'ssrPublico'),
    ssr_logado: cenario('ssr_logado', 'ssrLogado'),
    escrita_logada: cenario('escrita_logada', 'escritaLogada'),
    ...(SEM_RAJADA ? {} : { rajada_login: cenarioRajada('rajadaLogin') }),
  },
  thresholds: {
    'http_req_duration{cenario:estatico}': ['p(95)<100'],
    'http_req_duration{cenario:ssr_publico}': ['p(95)<300'],
    'http_req_duration{cenario:ssr_logado}': ['p(95)<500'],
    'http_req_duration{cenario:escrita_logada}': ['p(95)<600'],
    // Falha = qualquer status fora do esperado de cada requisição (o 429 da
    // rajada é esperado e não entra na conta).
    http_req_failed: ['rate<0.01'],
    ...(SEM_RAJADA ? {} : { 'checks{cenario:rajada_login}': ['rate==1'] }),
  },
  // O resumo mostra p95 por cenário.
  summaryTrendStats: ['avg', 'med', 'p(90)', 'p(95)', 'max'],
}

const OK = http.expectedStatuses(200)
const OK_OU_429 = http.expectedStatuses(200, 429)

// --- Descoberta das server functions ---------------------------------------
// O navegador chama `createClienteFn` por POST em /_serverFn/<id>. O id vem do
// build e não é fixo:
//  - no `vite dev` é um base64 do arquivo, legível em /src/lib/clientes-fns.ts;
//  - em produção é um hash que só existe nos JS da página. Achamos o trecho
//    `await X({data:{nome:...` no JS da tela de clientes e seguimos o import de
//    X até o `.handler(fn(`<hash>`))` no arquivo que o define.
// Se nada disso der certo, passe CRIAR_FN_ID e APAGAR_FN_ID. Sem ids, o
// cenário escrita_logada cai para GET /app/clientes (veja o README).

function baixar(caminho, cookie) {
  const r = http.get(BASE_URL + caminho, {
    headers: cabecalhos({ Cookie: cookie }),
    tags: { cenario: 'setup' },
    responseCallback: http.expectedStatuses(200, 404),
  })
  return r.status === 200 ? r.body : ''
}

function descobrirNoDev(cookie) {
  const js = baixar('/src/lib/clientes-fns.ts', cookie)
  const pega = (nome) => {
    const m = new RegExp(`${nome} = [^;]*?createClientRpc\\("([^"]+)"\\)`).exec(
      js,
    )
    return m ? m[1] : null
  }
  return { criar: pega('createClienteFn'), apagar: pega('deleteClienteFn') }
}

function descobrirNoBuild(cookie) {
  const html = baixar('/app/clientes', cookie)
  const arquivos = []
  const re = /(?:src|href)="([^"]+\.js)"/g
  for (let m = re.exec(html); m; m = re.exec(html)) arquivos.push(m[1])

  // Procura o chunk da tela de clientes entre os que a página já pré-carrega;
  // se não estiver lá, tenta o nome padrão do chunk em /assets.
  let chunk = ''
  for (const url of arquivos) {
    const corpo = baixar(url, cookie)
    if (corpo.includes('data:{nome:')) {
      chunk = corpo
      break
    }
  }
  if (!chunk) return { criar: null, apagar: null }

  const seguir = (padraoChamada) => {
    const chamada = new RegExp(
      `await ([\\w$]+)\\(\\{data:\\{${padraoChamada}`,
    ).exec(chunk)
    if (!chamada) return null
    const local = chamada[1]
    const imports = /import\{([^}]*)\}from["`']\.\/([^"`']+)["`']/g
    for (let i = imports.exec(chunk); i; i = imports.exec(chunk)) {
      for (const parte of i[1].split(',')) {
        const [exportado, apelido = exportado] = parte.trim().split(/\s+as\s+/)
        if (apelido !== local) continue
        const fonte = baixar(`/assets/${i[2]}`, cookie)
        // O bloco `export{...}` do arquivo diz qual variável interna sai com este nome.
        const bloco = /export\{([^}]*)\}/.exec(fonte)
        const partes = bloco ? bloco[1].split(',') : []
        let interno = exportado
        for (const p of partes) {
          const [de, como = de] = p.trim().split(/\s+as\s+/)
          if (como === exportado) interno = de
        }
        interno = interno.replace('$', '\\$')
        const def = new RegExp(
          `[,;\\s]${interno}=[\\w$]+\\(\\{method:\`POST\`\\}\\).{0,400}?\\.handler\\([\\w$]+\\(\`([0-9a-f]{64})\`\\)\\)`,
        ).exec(fonte)
        return def ? def[1] : null
      }
    }
    return null
  }
  return { criar: seguir('nome:'), apagar: seguir('id:') }
}

// --- setup ----------------------------------------------------------------
export function setup() {
  if (sessoes.length === 0) {
    fail(
      'Sem sessões. Rode `npm run load:sessoes` (localhost) ou passe SESSOES_JSON (veja load/README.md).',
    )
  }
  const cookie = sessoes[0].cookie

  // A sessão ainda vale? Sem ela o /app redireciona para /login.
  const app = http.get(`${BASE_URL}/app`, {
    headers: cabecalhos({ Cookie: cookie }),
    redirects: 0,
    tags: { cenario: 'setup' },
    responseCallback: http.expectedStatuses(200),
  })
  if (app.status !== 200) {
    fail(
      `A sessão de ${sessoes[0].email} não vale (GET /app deu ${app.status}). Gere de novo com npm run load:sessoes.`,
    )
  }

  let ids = {
    criar: __ENV.CRIAR_FN_ID || null,
    apagar: __ENV.APAGAR_FN_ID || null,
  }
  if (!ids.criar || !ids.apagar) {
    const achados = isLocal()
      ? descobrirNoDev(cookie)
      : { criar: null, apagar: null }
    const viaBuild =
      achados.criar && achados.apagar ? achados : descobrirNoBuild(cookie)
    ids = {
      criar: ids.criar || viaBuild.criar,
      apagar: ids.apagar || viaBuild.apagar,
    }
  }
  if (!ids.criar || !ids.apagar) {
    console.warn(
      'Não achei os ids das server functions: escrita_logada vai fazer GET /app/clientes no lugar.',
    )
  } else {
    console.log(
      `server functions: criar=${ids.criar.slice(0, 12)}... apagar=${ids.apagar.slice(0, 12)}...`,
    )
  }
  return ids
}

// --- Cenários ---------------------------------------------------------------
export function estatico() {
  const caminho = __ITER % 2 === 0 ? '/' : '/blog'
  const r = http.get(BASE_URL + caminho, { responseCallback: OK })
  check(r, { 'estático 200': (x) => x.status === 200 })
}

export function ssrPublico() {
  const r = http.get(`${BASE_URL}/login`, { responseCallback: OK })
  check(r, { 'login 200': (x) => x.status === 200 })
}

export function ssrLogado() {
  const caminho = __ITER % 2 === 0 ? '/app' : '/app/clientes'
  const r = http.get(BASE_URL + caminho, {
    headers: { Cookie: cookieDoVU() },
    redirects: 0, // um redirect para /login seria sessão perdida: conta como falha
    responseCallback: OK,
  })
  check(r, { 'área logada 200': (x) => x.status === 200 })
}

// O corpo de uma server function é JSON no formato do seroval, o mesmo que o
// navegador manda. Para `{ data: { ... } }` de textos, o molde é este.
function corpoServerFn(campos) {
  const chaves = Object.keys(campos)
  return JSON.stringify({
    t: {
      t: 10,
      i: 0,
      p: {
        k: ['data'],
        v: [
          {
            t: 10,
            i: 1,
            p: {
              k: chaves,
              v: chaves.map((c) => ({ t: 1, s: campos[c] })),
            },
            o: 0,
          },
        ],
      },
      o: 0,
    },
    f: 127,
    m: [],
  })
}

function chamarServerFn(id, campos, cookie, tags) {
  return http.post(`${BASE_URL}/_serverFn/${id}`, corpoServerFn(campos), {
    headers: cabecalhos({
      Cookie: cookie,
      'content-type': 'application/json',
      accept: 'application/json',
      'x-tsr-serverFn': 'true',
    }),
    tags,
    responseCallback: OK,
  })
}

export function escritaLogada(ids) {
  const cookie = cookieDoVU()
  if (!ids.criar || !ids.apagar) {
    // Plano B documentado: sem os ids, só lê a tela de clientes.
    const r = http.get(`${BASE_URL}/app/clientes`, {
      headers: { Cookie: cookie },
      redirects: 0,
      responseCallback: OK,
    })
    check(r, { 'clientes 200 (plano B)': (x) => x.status === 200 })
    return
  }
  const n = `${__VU}-${__ITER}`
  const criado = chamarServerFn(
    ids.criar,
    {
      nome: `Cliente k6 ${n}`,
      email: `k6-${n}@exemplo.test`,
      situacao: 'ativo',
    },
    cookie,
    {}, // herda cenario:escrita_logada: é este pedido que tem meta
  )
  const id = /"s":"([0-9a-f-]{36})"/.exec(criado.body)
  const ok = check(criado, {
    'cliente criado': (x) => x.status === 200 && id !== null,
  })
  if (!ok) return
  // Limpeza: apaga o que criou para não bater no teto de CLIENTES_MAX. Tem
  // outra tag, então não entra no p95 da escrita.
  const apagado = chamarServerFn(ids.apagar, { id: id[1] }, cookie, {
    cenario: 'escrita_logada_limpeza',
  })
  check(apagado, { 'cliente apagado': (x) => x.status === 200 })
}

export function rajadaLogin() {
  const respostas = []
  const ip = ipDeTeste(__VU, __ITER)
  // Um e-mail novo por rodada: o limite por e-mail não atrapalha, só o do IP.
  for (let i = 1; i <= 8; i++) {
    const r = http.post(
      `${BASE_URL}/api/auth/email-otp/send-verification-otp`,
      JSON.stringify({
        email: `load-rajada-${__VU}-${__ITER}@exemplo.test`,
        type: 'sign-in',
      }),
      {
        headers: cabecalhos({ 'content-type': 'application/json', ...ip }),
        responseCallback: OK_OU_429,
      },
    )
    respostas.push(r.status)
  }
  check(respostas, {
    'rajada: do 6º ao 8º pedido vem 429': (s) =>
      s.slice(5).every((c) => c === 429),
    // Só em localhost o IP é nosso (cf-connecting-ip de teste). Na borda o IP é
    // o real e pode já estar contado de uma rodada anterior.
    'rajada: os 5 primeiros passam (só em localhost)': (s) =>
      !isLocal() || s.slice(0, 5).every((c) => c === 200),
  })
}

export function handleSummary(data) {
  // Guarda o resultado completo em JSON (load/resultado*.json está no .gitignore).
  const arquivo = __ENV.RESULTADO || `load/resultado-${PROFILE}.json`
  return {
    [arquivo]: JSON.stringify(data, null, 2),
    stdout: resumo(data),
  }
}

function resumo(data) {
  const linhas = [
    `\nPerfil: ${PROFILE}   Alvo: ${BASE_URL}\n`,
    'p95 por cenário:',
  ]
  for (const nome of [
    'estatico',
    'ssr_publico',
    'ssr_logado',
    'escrita_logada',
  ]) {
    const m = data.metrics[`http_req_duration{cenario:${nome}}`]
    const v = m?.values?.['p(95)']
    const t = m?.thresholds ? Object.values(m.thresholds)[0] : undefined
    const estado = t === undefined ? '' : t.ok ? 'OK' : 'ACIMA DA META'
    linhas.push(
      `  ${nome.padEnd(16)} ${v === undefined ? 'sem dados' : `${v.toFixed(1)} ms`}  ${estado}`,
    )
  }
  const rajada = data.metrics['checks{cenario:rajada_login}']
  linhas.push(
    `  rajada_login     checks ${rajada ? `${(rajada.values.rate * 100).toFixed(0)}%` : 'sem dados'}`,
  )
  const falhas = data.metrics.http_req_failed
  linhas.push(
    `  http_req_failed  ${falhas ? `${(falhas.values.rate * 100).toFixed(2)}%` : 'sem dados'} (meta < 1%)`,
  )
  return `${linhas.join('\n')}\n`
}
