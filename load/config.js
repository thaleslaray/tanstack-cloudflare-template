// Configuração do teste de carga (k6). Lida pelo load/p95.js.
//
// Variáveis de ambiente:
//   BASE_URL  endereço do app (padrão http://localhost:3000)
//   PROFILE   "smoke" (padrão) ou "escada"
//
// Perfis (a taxa é o total de requisições por segundo, somando os cenários):
//   smoke   1 req/s por 15 s. Só prova que o script funciona.
//   escada  30 s de aquecimento a 2 req/s, depois 5, 20 e 50 req/s, 2 min cada
//           (uns 9 mil pedidos no total; veja o orçamento no load/README.md).

export const BASE_URL = (__ENV.BASE_URL || 'http://localhost:3000').replace(
  /\/+$/,
  '',
)
export const PROFILE = __ENV.PROFILE || 'smoke'

if (PROFILE !== 'smoke' && PROFILE !== 'escada') {
  throw new Error(`PROFILE inválido: "${PROFILE}". Use "smoke" ou "escada".`)
}

/** true quando o alvo é a máquina local (onde o teste pode forjar o IP). */
export function isLocal() {
  return /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(BASE_URL)
}

// Como o total de req/s se divide entre os cenários, e quantas requisições
// cada rodada (iteração) de cada cenário faz. A taxa de rodadas por segundo é
// total * peso / pedidos-por-rodada.
export const PESOS = {
  estatico: { peso: 0.35, pedidos: 1 },
  ssr_publico: { peso: 0.2, pedidos: 1 },
  ssr_logado: { peso: 0.3, pedidos: 1 },
  escrita_logada: { peso: 0.15, pedidos: 2 }, // cria + apaga (a limpeza não conta na meta)
}

// A rajada de login é fixa: uma rodada de 8 POSTs a cada 10 s (escada) ou a
// cada 15 s (smoke), para o IP não ficar sempre bloqueado.
const TIME_UNIT = '10s'
const PISO = 2 // pelo menos 2 rodadas a cada 10 s no smoke, para o cenário aparecer

// k6 só aceita taxa inteira por unidade de tempo: usamos "N por 10 s".
function porDezSegundos(rodadasPorSegundo, piso = 1) {
  return Math.max(piso, Math.round(rodadasPorSegundo * 10))
}

const ESCADA = [
  { duration: '30s', total: 2 },
  { duration: '2m', total: 5 },
  { duration: '2m', total: 20 },
  { duration: '2m', total: 50 },
]

/** Monta o bloco de um cenário que reparte o total de req/s pelo seu peso. */
export function cenario(nome, exec) {
  const { peso, pedidos } = PESOS[nome]
  const tags = { cenario: nome }
  if (PROFILE === 'smoke') {
    return {
      executor: 'constant-arrival-rate',
      exec,
      rate: porDezSegundos((1 * peso) / pedidos, PISO),
      timeUnit: TIME_UNIT,
      duration: '15s',
      preAllocatedVUs: 5,
      maxVUs: 20,
      tags,
    }
  }
  return {
    executor: 'ramping-arrival-rate',
    exec,
    startRate: porDezSegundos((ESCADA[0].total * peso) / pedidos),
    timeUnit: TIME_UNIT,
    // Cada degrau sobe até a taxa nova em 5 s e a segura até o fim.
    stages: ESCADA.flatMap((s, i) => {
      const alvo = porDezSegundos((s.total * peso) / pedidos)
      return i === 0
        ? [{ duration: s.duration, target: alvo }]
        : [
            { duration: '5s', target: alvo },
            { duration: s.duration, target: alvo },
          ]
    }),
    preAllocatedVUs: 20,
    maxVUs: 200,
    tags,
  }
}

/** Cenário da rajada de login: taxa própria, 1 rodada a cada 10 s. */
export function cenarioRajada(exec) {
  const tags = { cenario: 'rajada_login' }
  if (PROFILE === 'smoke') {
    return {
      executor: 'constant-arrival-rate',
      exec,
      rate: 1,
      timeUnit: '15s',
      duration: '15s',
      preAllocatedVUs: 1,
      maxVUs: 5,
      tags,
    }
  }
  return {
    executor: 'constant-arrival-rate',
    exec,
    rate: 1,
    timeUnit: '10s',
    duration: '7m35s', // 30 s + 3 degraus de 2 min + 3 subidas de 5 s
    preAllocatedVUs: 2,
    maxVUs: 10,
    tags,
  }
}

/** Cabeçalhos de um visitante comum (o app confere a origem em escritas). */
export function cabecalhos(extra = {}) {
  return { Origin: BASE_URL, ...extra }
}

/**
 * IP de teste para o cf-connecting-ip. Só em localhost: lá o app confia no
 * cabeçalho porque não há borda da Cloudflare. Na borda ele é sobrescrito pelo
 * IP real de quem roda o k6, e aqui devolvemos nada.
 */
export function ipDeTeste(a, b) {
  return isLocal() ? { 'cf-connecting-ip': `10.${a % 250}.${b % 250}.7` } : {}
}
