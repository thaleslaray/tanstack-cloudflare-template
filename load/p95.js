// Teste de carga com metas de p95. Rode com `npm run load` (veja load/README.md).
//
// Cinco cenários, cada um com a tag `cenario` e a sua própria meta. As rotas e
// a escrita vêm de load/rotas.json (ajuste às telas do produto; o padrão é o
// exemplo do template):
//   estatico         GET das publicasEstaticas (pré-renderizadas)      p95 < 100 ms
//   ssr_publico      GET das publicasSsr (renderizadas no Worker)      p95 < 300 ms
//   ssr_logado       GET das logadas, com cookie de sessão             p95 < 500 ms
//   escrita_logada   cria e apaga um registro (server function)        p95 < 600 ms
//   rajada_login     8 POSTs seguidos de pedir código de login         a partir do 6º, 429
//
// As sessões vêm de `npm run load:sessoes` (load/.sessoes.json) ou de SESSOES_JSON.
import { check, fail } from 'k6'
import { sha256 } from 'k6/crypto'
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
import {
  idDeBuild,
  importsRelativos,
  temIdDeServerFn,
  urlsDeJs,
} from './ids.js'
import {
  mensagem404,
  numeroDaRodada,
  preencherCampos,
  rotasParaConferir,
  validarRotas,
} from './rotas.js'

// --- Rotas medidas (load/rotas.json) ---------------------------------------
// Erro de formato falha aqui, antes de qualquer pedido.
const rotas = validarRotas(JSON.parse(open('./rotas.json')))

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
  // Cenário sem rota configurada em rotas.json não entra.
  scenarios: {
    ...(rotas.publicasEstaticas.length
      ? { estatico: cenario('estatico', 'estatico') }
      : {}),
    ...(rotas.publicasSsr.length
      ? { ssr_publico: cenario('ssr_publico', 'ssrPublico') }
      : {}),
    ...(rotas.logadas.length
      ? { ssr_logado: cenario('ssr_logado', 'ssrLogado') }
      : {}),
    ...(rotas.escrita
      ? { escrita_logada: cenario('escrita_logada', 'escritaLogada') }
      : {}),
    ...(SEM_RAJADA ? {} : { rajada_login: cenarioRajada('rajadaLogin') }),
  },
  thresholds: {
    ...(rotas.publicasEstaticas.length
      ? { 'http_req_duration{cenario:estatico}': ['p(95)<100'] }
      : {}),
    ...(rotas.publicasSsr.length
      ? { 'http_req_duration{cenario:ssr_publico}': ['p(95)<300'] }
      : {}),
    ...(rotas.logadas.length
      ? { 'http_req_duration{cenario:ssr_logado}': ['p(95)<500'] }
      : {}),
    ...(rotas.escrita
      ? {
          'http_req_duration{cenario:escrita_logada}': ['p(95)<600'],
          // O servidor responde 200 até quando recusa os campos (o erro vai no
          // corpo): sem esta meta, uma escrita que nunca grava passaria batida.
          'checks{cenario:escrita_logada}': ['rate>0.99'],
        }
      : {}),
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
// O navegador chama a função de criar (`escrita.criar.funcao`) por POST em /_serverFn/<id>. O id vem do
// build e não é fixo. Três jeitos, nesta ordem (o primeiro que der certo vale):
//  1. CRIAR_FN_ID e APAGAR_FN_ID, passados à mão;
//  2. `vite dev`: o id é um base64 do arquivo, legível em `escrita.arquivoDev`;
//  3. build (preview, staging, produção): o id é `sha256("<arquivo>--<função>_createServerFn_handler")`
//     (load/ids.js). O roteiro CALCULA o id e CONFERE que ele aparece nos JS
//     que o navegador recebe da `escrita.pagina` (`.handler(fn("<hash>"))`, seguindo
//     os imports dos chunks). Se não aparecer (o TanStack mudou a conta), o plano B
//     acha a chamada `await X({data:{<campo>:...` no JS da página e segue o
//     import de X até a definição.
// Nada disso deu certo? O cenário escrita_logada cai para GET da `escrita.pagina`
// (veja o README).

function baixar(caminho, cookie) {
  const r = http.get(BASE_URL + caminho, {
    headers: cabecalhos({ Cookie: cookie }),
    tags: { cenario: 'setup' },
    responseCallback: http.expectedStatuses(200, 404),
  })
  return r.status === 200 ? r.body : ''
}

function descobrirNoDev(cookie, esc) {
  const js = baixar(esc.arquivoDev, cookie)
  const pega = (nome) => {
    const m = new RegExp(`${nome} = [^;]*?createClientRpc\\("([^"]+)"\\)`).exec(
      js,
    )
    return m ? m[1] : null
  }
  return { criar: pega(esc.criar.funcao), apagar: pega(esc.apagar.funcao) }
}

// Baixa os JS que a página cita e, a partir deles, os chunks que importam (até
// `limite` arquivos): é onde o id de uma server function pode estar.
function jsDaPagina(cookie, pagina, limite = 80) {
  const html = baixar(pagina, cookie)
  const fila = urlsDeJs(html)
  const vistos = {}
  while (fila.length > 0 && Object.keys(vistos).length < limite) {
    const url = fila.shift()
    const caminho = url.startsWith('/') ? url : `/assets/${url}`
    if (caminho in vistos) continue
    const corpo = baixar(caminho, cookie)
    vistos[caminho] = corpo
    for (const nome of importsRelativos(corpo)) fila.push(`/assets/${nome}`)
  }
  return vistos
}

// O id calculado (load/ids.js) só vale se existir nos JS servidos.
function descobrirPorHash(cookie, esc) {
  const arquivos = jsDaPagina(cookie, esc.pagina)
  const corpos = Object.keys(arquivos).map((k) => arquivos[k])
  const achar = (funcao) => {
    const id = idDeBuild(sha256Hex, esc.arquivoDev, funcao)
    return corpos.some((js) => temIdDeServerFn(js, id)) ? id : null
  }
  return { criar: achar(esc.criar.funcao), apagar: achar(esc.apagar.funcao) }
}

function sha256Hex(texto) {
  return sha256(texto, 'hex')
}

function descobrirNoBuild(cookie, esc) {
  const primeiroCampo = Object.keys(esc.criar.campos)[0]
  const html = baixar(esc.pagina, cookie)
  const arquivos = []
  const re = /(?:src|href)="([^"]+\.js)"/g
  for (let m = re.exec(html); m; m = re.exec(html)) arquivos.push(m[1])

  // Procura o chunk da tela de clientes entre os que a página já pré-carrega;
  // se não estiver lá, tenta o nome padrão do chunk em /assets.
  let chunk = ''
  for (const url of arquivos) {
    const corpo = baixar(url, cookie)
    if (corpo.includes(`data:{${primeiroCampo}:`)) {
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
          // Até 6000 caracteres entre a definição e o `.handler(`: um validador
          // escrito inline pode ser longo. Aceita os três tipos de aspas.
          `[,;\\s]${interno}=[\\w$]+\\(\\{method:[\`'"]POST[\`'"]\\}\\).{0,6000}?\\.handler\\([\\w$]+\\([\`'"]([0-9a-f]{64})[\`'"]\\)\\)`,
        ).exec(fonte)
        return def ? def[1] : null
      }
    }
    return null
  }
  return {
    criar: seguir(`${primeiroCampo}:`),
    apagar: seguir(`${esc.apagar.campo}:`),
  }
}

// --- setup ----------------------------------------------------------------
// Confere, antes de começar, que nenhuma rota configurada responde 404: num
// produto que trocou ou removeu uma tela, medir página que não existe só
// mediria o 404.
function conferirRotas(cookie) {
  for (const { caminho, logada } of rotasParaConferir(rotas)) {
    const r = http.get(BASE_URL + caminho, {
      headers: logada ? cabecalhos({ Cookie: cookie }) : cabecalhos(),
      redirects: logada ? 0 : 5,
      tags: { cenario: 'setup' },
      responseCallback: http.expectedStatuses({ min: 200, max: 399 }, 404),
    })
    if (r.status === 404) fail(mensagem404(caminho))
  }
}

export function setup() {
  const precisaSessao = rotas.logadas.length > 0 || rotas.escrita !== null
  if (precisaSessao && sessoes.length === 0) {
    fail(
      'Sem sessões. Rode `npm run load:sessoes` (localhost) ou passe SESSOES_JSON (veja load/README.md).',
    )
  }
  const cookie = sessoes.length ? sessoes[0].cookie : ''

  // 404 numa rota configurada: para antes de gastar um pedido de medição.
  conferirRotas(cookie)

  // A sessão ainda vale? Sem ela a área logada redireciona para /login.
  const testada = rotas.logadas[0] ?? rotas.escrita?.pagina
  if (testada) {
    const app = http.get(BASE_URL + testada, {
      headers: cabecalhos({ Cookie: cookie }),
      redirects: 0,
      tags: { cenario: 'setup' },
      responseCallback: http.expectedStatuses(200),
    })
    if (app.status !== 200) {
      fail(
        `A sessão de ${sessoes[0].email} não vale (GET ${testada} deu ${app.status}). Gere de novo com npm run load:sessoes.`,
      )
    }
  }

  const esc = rotas.escrita
  if (!esc) {
    console.warn(
      'escrita DESLIGADA em load/rotas.json: a gravação (a parte mais lenta do app) NÃO será medida. ' +
        'Ligue a escrita com os campos que passam na validação do produto (veja load/README.md).',
    )
    return { criar: null, apagar: null }
  }
  let ids = {
    criar: __ENV.CRIAR_FN_ID || null,
    apagar: __ENV.APAGAR_FN_ID || null,
  }
  if (!ids.criar || !ids.apagar) {
    const achados = isLocal()
      ? descobrirNoDev(cookie, esc)
      : { criar: null, apagar: null }
    let viaBuild = achados
    let como = 'vite dev'
    if (!(achados.criar && achados.apagar)) {
      viaBuild = descobrirPorHash(cookie, esc)
      como = 'sha256 do arquivo e da função, conferido nos JS servidos'
      if (!(viaBuild.criar && viaBuild.apagar)) {
        viaBuild = descobrirNoBuild(cookie, esc)
        como = 'chamada achada no JS da página (plano B)'
      }
    }
    ids = {
      criar: ids.criar || viaBuild.criar,
      apagar: ids.apagar || viaBuild.apagar,
    }
    if (ids.criar && ids.apagar)
      console.log(`ids das server functions: ${como}`)
  }
  if (!ids.criar || !ids.apagar) {
    console.warn(
      `Não achei os ids das server functions: escrita_logada vai fazer GET ${esc.pagina} no lugar.`,
    )
  } else {
    console.log(
      `server functions: criar=${ids.criar.slice(0, 12)}... apagar=${ids.apagar.slice(0, 12)}...`,
    )
    conferirEscrita(ids, esc, cookie)
  }
  return ids
}

// Uma escrita de verdade ANTES de medir: os campos de `escrita.criar.campos`
// passam na validação do produto? Se o produto recusa (telefone no formato
// errado, e-mail inválido...), cada rodada mediria um erro. Cria um registro e
// apaga em seguida; se criar falha, PARA com o que o servidor respondeu.
function conferirEscrita(ids, esc, cookie) {
  const r = http.post(
    `${BASE_URL}/_serverFn/${ids.criar}`,
    corpoServerFn(preencherCampos(esc.criar.campos, 'setup', '000000')),
    {
      headers: cabecalhos({
        Cookie: cookie,
        'content-type': 'application/json',
        accept: 'application/json',
        'x-tsr-serverFn': 'true',
      }),
      tags: { cenario: 'setup' },
      // Qualquer status: quem decide é a conferência abaixo, com mensagem clara.
      responseCallback: http.expectedStatuses({ min: 200, max: 599 }),
    },
  )
  const id = /"s":"([0-9a-f-]{36})"/.exec(r.body)
  if (r.status !== 200 || id === null) {
    fail(
      `A escrita falhou ANTES de medir (POST /_serverFn/${ids.criar.slice(0, 12)}... deu ${r.status}). ` +
        `O produto recusou os campos de escrita.criar.campos em load/rotas.json (ou o id ${id === null ? 'não veio na resposta' : 'veio'}). ` +
        'Eles têm de passar na validação do produto: ' +
        'telefone no formato certo (ex.: "1198765{n}"), e-mail válido, texto dentro dos limites, e `{n}` vira "<VU>-<rodada>" (letras e hífen). ' +
        `Resposta do servidor: ${String(r.body).slice(0, 300)}`,
    )
  }
  http.post(
    `${BASE_URL}/_serverFn/${ids.apagar}`,
    corpoServerFn({ [esc.apagar.campo]: id[1] }),
    {
      headers: cabecalhos({
        Cookie: cookie,
        'content-type': 'application/json',
        accept: 'application/json',
        'x-tsr-serverFn': 'true',
      }),
      tags: { cenario: 'setup' },
      responseCallback: http.expectedStatuses({ min: 200, max: 599 }),
    },
  )
}

// --- Cenários ---------------------------------------------------------------
export function estatico() {
  const caminho =
    rotas.publicasEstaticas[__ITER % rotas.publicasEstaticas.length]
  const r = http.get(BASE_URL + caminho, { responseCallback: OK })
  check(r, { 'estático 200': (x) => x.status === 200 })
}

export function ssrPublico() {
  const caminho = rotas.publicasSsr[__ITER % rotas.publicasSsr.length]
  const r = http.get(BASE_URL + caminho, { responseCallback: OK })
  check(r, { 'página pública 200': (x) => x.status === 200 })
}

export function ssrLogado() {
  const caminho = rotas.logadas[__ITER % rotas.logadas.length]
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
    const r = http.get(BASE_URL + rotas.escrita.pagina, {
      headers: { Cookie: cookie },
      redirects: 0,
      responseCallback: OK,
    })
    check(r, { 'página de escrita 200 (plano B)': (x) => x.status === 200 })
    return
  }
  const n = `${__VU}-${__ITER}`
  const criado = chamarServerFn(
    ids.criar,
    preencherCampos(
      rotas.escrita.criar.campos,
      n,
      numeroDaRodada(__VU, __ITER),
    ),
    cookie,
    {}, // herda cenario:escrita_logada: é este pedido que tem meta
  )
  const id = /"s":"([0-9a-f-]{36})"/.exec(criado.body)
  const ok = check(criado, {
    'registro criado': (x) => x.status === 200 && id !== null,
  })
  if (!ok) return
  // Limpeza: apaga o que criou (no exemplo, para não bater no teto de CLIENTES_MAX). Tem
  // outra tag, então não entra no p95 da escrita.
  const apagado = chamarServerFn(
    ids.apagar,
    { [rotas.escrita.apagar.campo]: id[1] },
    cookie,
    { cenario: 'escrita_logada_limpeza' },
  )
  check(apagado, { 'registro apagado': (x) => x.status === 200 })
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
