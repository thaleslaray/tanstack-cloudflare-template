// Rastreio das idas ao D1. Serve para contar quantas consultas uma página faz e
// quantas ficam em fila (cada ida em fila custa uma viagem de rede até o banco).
// Sem bindings aqui; quem liga é `src/server.ts`, de dois jeitos:
// - em dev, com o header de pedido `x-d1-trace: 1` (uma linha `[d1]` por ida);
// - em qualquer ambiente, com a variável `PERF_LOG` (`src/lib/perf-log.ts`, uma
//   linha JSON por pedido). Desligado, nada é embrulhado: custo zero.
import type { RequestD1Session } from './d1-session'

export const D1_TRACE_HEADER = 'x-d1-trace'

export type Ida = {
  sql: string
  start: number
  end: number
  /** Região do D1 que respondeu (`meta.served_by_region`, ex.: `ENAM`); só no D1 remoto. */
  regiao?: string
  /** Se quem respondeu foi o primário (`meta.served_by_primary`): `false` = uma réplica. */
  primario?: boolean
}

/**
 * De onde o D1 respondeu, lido do `meta` do resultado (`all`, `run`, `batch`).
 * `first` e `raw` não trazem `meta`; no D1 local (`vite dev`) os campos não existem.
 */
export function origemDoResultado(
  resultado: unknown,
): Pick<Ida, 'regiao' | 'primario'> {
  const r = Array.isArray(resultado) ? resultado[0] : resultado
  const meta = (r as { meta?: Record<string, unknown> } | null | undefined)
    ?.meta
  const regiao =
    typeof meta?.served_by_region === 'string'
      ? meta.served_by_region
      : undefined
  const primario =
    typeof meta?.served_by_primary === 'boolean'
      ? meta.served_by_primary
      : undefined
  return { regiao, primario }
}

/** Quantas idas e qual a fila mais longa (idas que esperam a anterior acabar). */
export function resumirIdas(idas: Pick<Ida, 'start' | 'end'>[]) {
  const ordenadas = [...idas].sort((a, b) => a.start - b.start)
  const fundura: number[] = []
  for (const [i, ida] of ordenadas.entries()) {
    let melhor = 0
    for (let j = 0; j < i; j++) {
      if (ordenadas[j].end <= ida.start) {
        melhor = Math.max(melhor, fundura[j])
      }
    }
    fundura[i] = melhor + 1
  }
  return { idas: idas.length, emFila: Math.max(0, ...fundura) }
}

function resumirSql(sql: string) {
  const limpo = sql.replace(/\s+/g, ' ').trim()
  const de = /\bfrom\s+"?(\w+)"?/i.exec(limpo)?.[1]
  const into = /\binto\s+"?(\w+)"?/i.exec(limpo)?.[1]
  const update = /^update\s+"?(\w+)"?/i.exec(limpo)?.[1]
  const verbo = limpo.split(' ', 1)[0]?.toLowerCase() ?? '?'
  const tabela = de ?? into ?? update ?? '?'
  return `${verbo} ${tabela}`
}

type Rastreado = D1PreparedStatement & { __real: D1PreparedStatement }

/**
 * Envolve a sessão D1 do pedido: cada `all/run/raw/first` e cada `batch` vira
 * uma linha `[d1]` no terminal. `fim()` imprime o resumo do pedido.
 */
export function rastrearD1(
  session: RequestD1Session,
  rotulo: string,
  { log = true }: { log?: boolean } = {},
) {
  const inicio = performance.now()
  const idas: Ida[] = []

  async function medir<T>(sql: string, fn: () => Promise<T>): Promise<T> {
    const start = performance.now() - inicio
    let origem: Pick<Ida, 'regiao' | 'primario'> = {}
    try {
      const resultado = await fn()
      origem = origemDoResultado(resultado)
      return resultado
    } finally {
      const end = performance.now() - inicio
      idas.push({ sql, start, end, ...origem })
      if (log)
        console.log(
          `[d1] ${rotulo} +${start.toFixed(0)}ms (${(end - start).toFixed(0)}ms) ${sql}`,
        )
    }
  }

  function envolver(real: D1PreparedStatement, sql: string): Rastreado {
    const resumo = resumirSql(sql)
    return {
      __real: real,
      bind: (...valores: unknown[]) => envolver(real.bind(...valores), sql),
      first: (...args: unknown[]) =>
        medir(resumo, () =>
          (real.first as (...a: unknown[]) => Promise<unknown>)(...args),
        ),
      run: () => medir(resumo, () => real.run()),
      all: () => medir(resumo, () => real.all()),
      raw: (...args: unknown[]) =>
        medir(resumo, () =>
          (real.raw as (...a: unknown[]) => Promise<unknown>)(...args),
        ),
    } as unknown as Rastreado
  }

  const rastreada: RequestD1Session = {
    prepare: (sql: string) => envolver(session.prepare(sql), sql),
    batch: ((declaracoes: Rastreado[]) =>
      medir(`batch(${declaracoes.length})`, () =>
        session.batch(declaracoes.map((d) => d.__real ?? d)),
      )) as RequestD1Session['batch'],
    getBookmark: () => session.getBookmark(),
  }

  return {
    sessao: rastreada,
    /** As idas feitas até agora (consulta resumida e tempos em ms desde o início). */
    idas: () => idas,
    fim() {
      if (!log) return
      const { idas: total, emFila } = resumirIdas(idas)
      console.log(
        `[d1] ${rotulo} RESUMO: ${total} ida(s) ao D1, ${emFila} em fila`,
      )
    },
  }
}
