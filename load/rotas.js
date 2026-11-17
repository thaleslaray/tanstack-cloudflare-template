// Validação da configuração das rotas medidas (load/rotas.json). Arquivo puro:
// roda no k6 e nos testes (load/rotas.test.ts), sem nada de Node nem do k6.

const LISTAS = ['publicasEstaticas', 'publicasSsr', 'logadas']

function listaDeRotas(valor, nome) {
  if (valor === undefined) return []
  if (!Array.isArray(valor)) {
    throw new Error(`rotas.json: "${nome}" tem de ser uma lista de caminhos.`)
  }
  for (const r of valor) {
    if (typeof r !== 'string' || !r.startsWith('/')) {
      throw new Error(
        `rotas.json: "${nome}" tem um caminho inválido (${JSON.stringify(r)}). Use textos que começam com "/".`,
      )
    }
  }
  return valor
}

function texto(valor, nome) {
  if (typeof valor !== 'string' || valor.trim() === '') {
    throw new Error(`rotas.json: "${nome}" é obrigatório (texto não vazio).`)
  }
  return valor
}

/**
 * Confere o objeto lido de rotas.json e devolve a configuração normalizada.
 * `escrita` é opcional (null, ausente ou `false` desliga o cenário de escrita);
 * os marcadores `{n}` e `{num}` nos valores de `criar.campos` viram o identificador da rodada.
 * Lança Error com mensagem em pt-BR quando algo está errado.
 */
export function validarRotas(bruto) {
  if (!bruto || typeof bruto !== 'object' || Array.isArray(bruto)) {
    throw new Error('rotas.json: o arquivo tem de ser um objeto JSON.')
  }
  const config = {
    publicasEstaticas: listaDeRotas(
      bruto.publicasEstaticas,
      'publicasEstaticas',
    ),
    publicasSsr: listaDeRotas(bruto.publicasSsr, 'publicasSsr'),
    logadas: listaDeRotas(bruto.logadas, 'logadas'),
    escrita: null,
  }
  if (LISTAS.every((l) => config[l].length === 0)) {
    throw new Error(
      'rotas.json: nenhuma rota configurada. Preencha publicasEstaticas, publicasSsr ou logadas.',
    )
  }
  const e = bruto.escrita
  if (e) {
    if (typeof e !== 'object' || Array.isArray(e)) {
      throw new Error('rotas.json: "escrita" tem de ser um objeto (ou null).')
    }
    const pagina = texto(e.pagina, 'escrita.pagina')
    if (!pagina.startsWith('/')) {
      throw new Error('rotas.json: "escrita.pagina" tem de começar com "/".')
    }
    const campos = e.criar?.campos
    if (
      !campos ||
      typeof campos !== 'object' ||
      Array.isArray(campos) ||
      Object.keys(campos).length === 0
    ) {
      throw new Error(
        'rotas.json: "escrita.criar.campos" tem de ser um objeto com ao menos um campo.',
      )
    }
    for (const [k, v] of Object.entries(campos)) {
      if (typeof v !== 'string') {
        throw new Error(
          `rotas.json: o campo "${k}" de escrita.criar.campos tem de ser texto.`,
        )
      }
    }
    config.escrita = {
      pagina,
      arquivoDev: texto(e.arquivoDev, 'escrita.arquivoDev'),
      criar: { funcao: texto(e.criar.funcao, 'escrita.criar.funcao'), campos },
      apagar: {
        funcao: texto(e.apagar?.funcao, 'escrita.apagar.funcao'),
        campo: texto(e.apagar?.campo, 'escrita.apagar.campo'),
      },
    }
  }
  return config
}

/**
 * Troca os marcadores nos valores dos campos:
 *  - `{n}` vira `<VU>-<rodada>` (letras, dígitos e hífen: serve para nome e e-mail);
 *  - `{num}` vira 6 dígitos (`<VU>` e `<rodada>` juntos, com zeros à esquerda): serve
 *    para campo SÓ de dígitos, como telefone (`"11987{num}"` dá 11 dígitos).
 */
export function preencherCampos(campos, n, num = '000000') {
  const saida = {}
  for (const k of Object.keys(campos)) {
    saida[k] = campos[k].split('{n}').join(n).split('{num}').join(num)
  }
  return saida
}

/** O `{num}` de uma rodada: 6 dígitos, único por (VU, rodada) enquanto houver menos de 10 mil rodadas por VU. */
export function numeroDaRodada(vu, rodada) {
  return String((vu % 100) * 10000 + (rodada % 10000)).padStart(6, '0')
}

/** Todas as rotas a conferir antes de começar: [{ caminho, logada }]. */
export function rotasParaConferir(config) {
  const lista = []
  for (const r of config.publicasEstaticas)
    lista.push({ caminho: r, logada: false })
  for (const r of config.publicasSsr) lista.push({ caminho: r, logada: false })
  for (const r of config.logadas) lista.push({ caminho: r, logada: true })
  if (config.escrita)
    lista.push({ caminho: config.escrita.pagina, logada: true })
  return [
    ...new Map(lista.map((x) => [`${x.logada}:${x.caminho}`, x])).values(),
  ]
}

/** Mensagem de erro para uma rota configurada que respondeu 404. */
export function mensagem404(caminho) {
  return `A rota ${caminho} respondeu 404. Ela está em load/rotas.json mas não existe neste app. Ajuste o arquivo às telas do produto (veja load/README.md).`
}
