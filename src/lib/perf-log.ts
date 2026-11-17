// Registro de desempenho por pedido, ligado pela variável `PERF_LOG`.
// Sem bindings aqui: `src/server.ts` lê a variável e chama estas funções.
//
// Desligado (o padrão), o servidor só compara uma string por pedido: nenhum
// D1 é embrulhado e nenhuma linha sai. Ligado, sai UMA linha JSON por pedido
// em `console.log` (aparece no `wrangler tail` e nos logs do painel):
//
//   {"perf":1,"method":"GET","path":"/app/clientes","status":200,"ms":412,
//    "colo":"GIG","idas":3,"fila":2,
//    "d1":[{"q":"select session","at":0,"ms":180},{"q":"select clientes","at":182,"ms":210}]}
//
// - `ms`: do começo do pedido até o handler devolver a resposta (o corpo de
//   uma página em streaming pode terminar depois); consultas que rodam depois
//   da resposta (`waitUntil`, como a auditoria) não entram.
// - `colo`: onde o Worker rodou de fato (aeroporto do data center, de
//   `request.cf.colo`). O cabeçalho de RESPOSTA `cf-placement` só existe depois
//   que a resposta sai do Worker: pegue-o com `curl -sI`.
// - `idas`: quantas idas ao D1; `fila`: a cadeia mais longa de idas uma depois
//   da outra (`Promise.all` e `db.batch` contam como UMA). Cada nível custa uma
//   viagem de rede até o banco.
// - `d1[].at`/`ms`: quando a ida começou e quanto durou, em ms desde o início.
// - `d1[].r`/`p`: de onde o D1 respondeu (`meta.served_by_region`, ex.: "ENAM", e
//   se foi o primário), quando o resultado traz (`all`, `run` e `batch` trazem;
//   `first` e `raw` não; no D1 local não existe). `d1_regioes` junta as regiões
//   vistas no pedido. Compare com `colo`: Worker no Rio e D1 em ENAM = cada ida
//   atravessa o continente (veja a skill /deploy, "Onde o Worker roda").
import type { Ida } from '#/db/d1-trace'
import { resumirIdas } from '#/db/d1-trace'

/** `true`, `1` ou `on` ligam; qualquer outra coisa (vazio, `0`, ausente) desliga. */
export function perfLogLigado(valor: unknown): boolean {
  return typeof valor === 'string' && /^(1|true|on)$/i.test(valor.trim())
}

type EntradaDaLinha = {
  method: string
  /** URL completa do pedido: só o caminho entra na linha (query pode ter segredo). */
  url: string
  status: number
  ms: number
  colo?: string
  idas: Pick<Ida, 'sql' | 'start' | 'end' | 'regiao' | 'primario'>[]
}

/** A linha JSON de um pedido. */
export function linhaDeDesempenho(e: EntradaDaLinha): string {
  const { idas, emFila } = resumirIdas(e.idas)
  return JSON.stringify({
    perf: 1,
    method: e.method,
    path: new URL(e.url).pathname,
    status: e.status,
    ms: Math.round(e.ms),
    colo: e.colo ?? null,
    idas,
    fila: emFila,
    d1_regioes: [
      ...new Set(e.idas.flatMap((i) => (i.regiao ? [i.regiao] : []))),
    ],
    d1: e.idas.map((i) => ({
      q: i.sql,
      at: Math.round(i.start),
      ms: Math.round(i.end - i.start),
      ...(i.regiao ? { r: i.regiao } : {}),
      ...(i.primario === undefined ? {} : { p: i.primario }),
    })),
  })
}
