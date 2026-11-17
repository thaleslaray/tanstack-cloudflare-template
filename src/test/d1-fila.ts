// Ferramenta de teste: conta as consultas EM FILA que uma função ou rota faz ao
// D1, para um teste afirmar "no máximo 2 em fila" (a meta do template para rota
// de leitura). Cada nível em fila custa uma viagem de rede até o banco; no
// computador local tudo responde em 1 ms e esconde o problema, então aqui o
// banco ganha um atraso artificial: consultas que saem JUNTAS (`Promise.all`,
// `db.batch`) se sobrepõem no atraso e contam como um nível; consultas uma
// depois da outra empilham.
//
// A conta é lógica (um relógio de eventos, não milissegundos), então o
// resultado não oscila com a máquina: o atraso só garante que as consultas
// simultâneas de fato se sobreponham.
//
//   const { filaMax } = await medirFila(h.env.DB, () => listClientesFn())
//   expect(filaMax).toBeLessThanOrEqual(2)
import { type RequestD1Session, runWithD1Session } from '#/db/d1-session'

type Ida = { sql: string; inicio: number; fim: number }

/** A cadeia mais longa de idas em que cada uma começou depois de a anterior acabar. */
export function filaMaxima(idas: Pick<Ida, 'inicio' | 'fim'>[]): number {
  const ordenadas = [...idas].sort((a, b) => a.inicio - b.inicio)
  const nivel: number[] = []
  for (const [i, ida] of ordenadas.entries()) {
    let melhor = 0
    for (let j = 0; j < i; j++) {
      if (ordenadas[j].fim <= ida.inicio) melhor = Math.max(melhor, nivel[j])
    }
    nivel[i] = melhor + 1
  }
  return Math.max(0, ...nivel)
}

type Declaracao = D1PreparedStatement & { __real?: D1PreparedStatement }

/**
 * Embrulha um D1 (ou uma sessão D1) com atraso artificial por ida. Devolve a
 * sessão embrulhada e o que foi medido.
 */
export function d1ComAtraso(
  real: Pick<D1Database, 'prepare' | 'batch'>,
  atrasoMs = 20,
) {
  let relogio = 0
  const idas: Ida[] = []
  const espera = () => new Promise((r) => setTimeout(r, atrasoMs))

  async function ida<T>(sql: string, fn: () => Promise<T>): Promise<T> {
    const inicio = relogio++
    await espera()
    try {
      return await fn()
    } finally {
      idas.push({ sql, inicio, fim: relogio++ })
    }
  }

  function envolver(stmt: D1PreparedStatement, sql: string): Declaracao {
    return {
      __real: stmt,
      bind: (...v: unknown[]) => envolver(stmt.bind(...v), sql),
      first: (...a: unknown[]) =>
        ida(sql, () =>
          (stmt.first as (...x: unknown[]) => Promise<unknown>)(...a),
        ),
      run: () => ida(sql, () => stmt.run()),
      all: () => ida(sql, () => stmt.all()),
      raw: (...a: unknown[]) =>
        ida(sql, () =>
          (stmt.raw as (...x: unknown[]) => Promise<unknown>)(...a),
        ),
    } as unknown as Declaracao
  }

  const sessao = {
    prepare: (sql: string) => envolver(real.prepare(sql), sql),
    // Um `batch` é UMA ida, não importa quantas declarações leve.
    batch: ((declaracoes: Declaracao[]) =>
      ida(`batch(${declaracoes.length})`, () =>
        real.batch(declaracoes.map((d) => d.__real ?? d)),
      )) as D1Database['batch'],
    getBookmark: () => null,
  } satisfies RequestD1Session

  return {
    sessao,
    /** O D1 embrulhado, para quem recebe um `D1Database` (ex.: `getDb(d1)`). */
    d1: sessao as unknown as D1Database,
    /** Quantas idas em fila (a cadeia mais longa); `Promise.all` e `batch` contam como uma. */
    filaMax: () => filaMaxima(idas),
    /** Quantas idas ao todo. */
    total: () => idas.length,
    /** As consultas, na ordem em que acabaram (para a mensagem de erro do teste). */
    consultas: () => idas.map((i) => i.sql),
  }
}

/**
 * Roda `fn` com o D1 lento no lugar do banco do pedido (todo `getDb` lá dentro
 * usa o embrulhado) e devolve o resultado e a medida.
 */
export async function medirFila<T>(
  real: Pick<D1Database, 'prepare' | 'batch'>,
  fn: () => Promise<T>,
  atrasoMs = 20,
) {
  const medidor = d1ComAtraso(real, atrasoMs)
  const resultado = await runWithD1Session(medidor.sessao, fn)
  return {
    resultado,
    filaMax: medidor.filaMax(),
    total: medidor.total(),
    consultas: medidor.consultas(),
  }
}
