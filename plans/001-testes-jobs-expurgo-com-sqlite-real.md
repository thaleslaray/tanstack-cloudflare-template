# Plano 001: Testar os jobs que lembram e apagam contas encerradas, com SQLite de verdade

> **Instruções para quem executa**: siga este plano passo a passo. Rode cada
> comando de verificação e confirme o resultado esperado antes de ir para o
> passo seguinte. Se acontecer qualquer coisa da seção "Condições de STOP",
> pare e relate: não improvise. Ao terminar, se existir `plans/README.md`,
> atualize a linha deste plano (a não ser que um revisor tenha dito que ele
> cuida do índice). Explique o que fizer em pt-BR, simples e direto.
>
> **Conferência de drift (rode primeiro)**: este plano foi escrito contra o
> commit `bb7333e` MAIS mudanças ainda não commitadas na árvore de trabalho
> (2026-11-13). Por isso `git diff` sozinho não basta: confira os trechos.
> Rode, na raiz do repositório:
>
> ```sh
> git diff --stat bb7333e..HEAD -- src/lib/jobs.ts src/lib/account.ts src/lib/jobs.test.ts src/test src/db drizzle vitest.config.ts AGENTS.md
> grep -n "lt(user.deletedAt, purgeCutoff(new Date()))" src/lib/jobs.ts
> grep -n "gte(user.deletedAt, purgeCutoff(now))" src/lib/jobs.ts
> grep -n "const PURGE_BATCH = 25" src/lib/jobs.ts
> grep -n "export function resetAccountHandlers" src/lib/account.ts
> ls drizzle/*.sql | wc -l
> ls src/test src/lib/jobs-contas.test.ts 2>&1
> ```
>
> Esperado: o `git diff --stat` vazio (se `HEAD` ainda é `bb7333e`) ou sem
> nenhum desses caminhos; os quatro `grep` devolvem uma linha cada (linhas
> 127, 79, 111 e 153, nessa ordem); `5` migrações; `src/test` tem só
> `cloudflare-workers.ts` e `fake-db.ts`; e `src/lib/jobs-contas.test.ts` NÃO
> existe ("No such file or directory"). Qualquer diferença: compare o código
> com os trechos da seção "Estado atual"; se não baterem, é condição de STOP.

## Status

- **Prioridade**: P1
- **Esforço**: S
- **Risco**: LOW (só acrescenta arquivos de teste e duas frases no `AGENTS.md`; nenhum código do app muda)
- **Depende de**: nenhum
- **Categoria**: tests
- **Planejado em**: commit `bb7333e` + árvore de trabalho de 2026-11-13; confira o drift pelos trechos citados

## Por que isso importa

`src/lib/jobs.ts` tem dois jobs do cron diário que mexem em contas de gente de
verdade e não têm teste nenhum: `conta.lembrar-exclusao` (manda o e-mail do
dia 5) e `conta.apagar-encerradas` (apaga a conta de vez depois de 7 dias, em
cascata). A decisão de QUEM é apagado é uma comparação de data dentro de um
`where`. Se alguém inverter esse corte (`lt` por `gte`), o cron passa a apagar
contas que acabaram de ser encerradas, e nenhum teste acusa: o banco de
mentira usado hoje (`src/test/fake-db.ts`) não executa SQL.

Depois deste plano, esses dois jobs rodam nos testes contra um SQLite de
verdade, com as migrações do projeto aplicadas, e o teste confere o que sobrou
no banco. Inverter o corte deixa 10 dos 14 testes novos vermelhos (medido).

## Estado atual

Tudo abaixo foi lido nos arquivos em disco em 2026-11-13.

### Arquivos e o papel de cada um

- `src/lib/jobs.ts` — registro dos jobs do cron. `runJobs(env)` roda os quatro,
  nesta ordem: `auth.limpar-expirados`, `conta.lembrar-exclusao`,
  `conta.apagar-encerradas`, `auditoria.retencao`. Cada job roda isolado (erro
  de um vira `'erro'` no resultado e não derruba os outros) e imprime
  `[jobs] <nome>: <detalhe>` com `console.log`. **Não mexa neste arquivo.**
- `src/lib/account.ts` — sem bindings: prazos (`ACCOUNT_RETENTION_DAYS = 7`,
  `PURGE_REMINDER_DAY = 5`), `purgeCutoff`, `reminderCutoff`, `purgeDateFor`,
  e os registros `onAccountDeletionGuard`, `onBeforeAccountDelete`,
  `AccountDeletionBlocked`, `resetAccountHandlers` (linha 153, "só para testes").
- `src/lib/jobs.test.ts` — teste que existe hoje. Só confere `auditCutoff` e o
  job `auditoria.retencao`, com o `fakeDb`. **Não mexa: continua valendo.**
- `src/test/fake-db.ts` — banco de mentira: um `Proxy` que devolve sempre o
  mesmo resultado e só anota as chamadas. O próprio arquivo avisa (linha 4):
  "Não executa SQL: serve para ver SE o código chama delete/update, não o SQL."
  O `batch` devolve sempre `[meta, meta]`. Não dá para expressar `where`,
  `returning` nem cascata com ele.
- `src/db/index.ts` — `getDb(d1)`: `drizzle(d1, { schema })` do
  `drizzle-orm/d1`. Fora de um pedido (cron, testes) usa o D1 que recebeu.
- `src/db/auth-schema.ts` — tabela `user` com `deletedAt` e `purgeRemindedAt`
  (`integer`, modo `timestamp_ms`, ou seja, milissegundos); `session` e
  `account` têm `userId` com `onDelete: 'cascade'`.
- `src/db/schema.ts` — `clientes.userId` com `onDelete: 'cascade'`;
  `audit_log` SEM chave estrangeira (sobrevive à exclusão da conta).
- `drizzle/0000_dry_skreet.sql` … `drizzle/0004_ordinary_sentinels.sql` — as
  cinco migrações. Entre as instruções há `--> statement-breakpoint`, que para
  o SQLite é só um comentário (`--`): o arquivo inteiro roda de uma vez.
- `src/lib/email.ts` — `sendEmailSafely(params)` (linha 113): chama
  `sendEmail` e engole o erro. É o único export que `jobs.ts` usa daqui.
- `src/lib/audit.ts` — `audit()` é no-op sem sink registrado
  (`if (sinks.size === 0) return`). `onAudit(nome, sink)` registra um sink e
  devolve a função que o remove. `jobs.ts` NÃO registra sink nenhum.
- `vitest.config.ts` — ambiente `node`, alias de `cloudflare:workers` para
  `src/test/cloudflare-workers.ts`, e o alias `#/` → `src/`.
- `src/rules.test.ts` — regras do projeto por texto. Ignora a pasta
  `src/test/` e os arquivos `*.test.ts` ("Código só de teste não segue as
  regras do app"), então os dois arquivos novos não passam por ela.

### Os dois jobs, como estão hoje

`src/lib/jobs.ts:68-107` (lembrete):

```ts
registerJob({
  name: 'conta.lembrar-exclusao',
  async run(env) {
    const db = getDb(env.DB)
    const now = new Date()
    const due = await db
      .select({ id: user.id })
      .from(user)
      .where(
        and(
          lt(user.deletedAt, reminderCutoff(now)),
          gte(user.deletedAt, purgeCutoff(now)),
          isNull(user.purgeRemindedAt),
        ),
      )
    let reminded = 0
    for (const { id } of due) {
      const [claimed] = await db
        .update(user)
        .set({ purgeRemindedAt: now })
        .where(
          and(
            eq(user.id, id),
            isNotNull(user.deletedAt),
            isNull(user.purgeRemindedAt),
          ),
        )
        .returning({ email: user.email, deletedAt: user.deletedAt })
      if (!claimed?.deletedAt) continue
      await sendEmailSafely({
        to: claimed.email,
        ...accountPurgeReminderEmail({
          purgeAt: purgeDateFor(claimed.deletedAt),
        }),
      })
      reminded++
    }
    return `lembradas=${reminded}`
  },
})
```

`src/lib/jobs.ts:111-154` (expurgo):

```ts
const PURGE_BATCH = 25
// ...
registerJob({
  name: 'conta.apagar-encerradas',
  async run(env) {
    const db = getDb(env.DB)
    const due = await db
      .select({ id: user.id, email: user.email })
      .from(user)
      .where(
        and(
          isNotNull(user.deletedAt),
          lt(user.deletedAt, purgeCutoff(new Date())),
        ),
      )
      // As mais antigas primeiro: ninguém fica para sempre no fim da fila.
      .orderBy(asc(user.deletedAt))
      .limit(PURGE_BATCH)
    let purged = 0
    let kept = 0
    for (const ref of due) {
      try {
        await runAccountDeletionGuards(ref)
        await runBeforeAccountDelete(ref)
        await db.delete(user).where(eq(user.id, ref.id))
        // Sem e-mail: a conta sumiu e o registro não guarda dado pessoal.
        await audit({
          action: 'account.deleted',
          targetType: 'user',
          targetId: ref.id,
        })
        purged++
      } catch (error) {
        console.error(`[jobs] conta ${ref.id} mantida`, error)
        kept++
      }
    }
    return `apagadas=${purged} mantidas=${kept}`
  },
})
```

`src/lib/account.ts:80-88` (os cortes):

```ts
/** Contas encerradas ANTES deste instante já passaram do prazo: apagar. */
export function purgeCutoff(now: Date): Date {
  return new Date(now.getTime() - ACCOUNT_RETENTION_DAYS * DAY_MS)
}

/** Contas encerradas antes deste instante já estão no dia do lembrete. */
export function reminderCutoff(now: Date): Date {
  return new Date(now.getTime() - PURGE_REMINDER_DAY * DAY_MS)
}
```

As comparações são estritas (`<`): com exatamente 5 dias a conta ainda não é
lembrada; com exatamente 7 dias ainda não é apagada (e ainda é lembrada, pelo
`gte`).

### O achado conferido

Os fatos do achado que deu origem a este plano foram conferidos no código e
estão corretos: os dois jobs não têm teste; `jobs.test.ts` só cobre
`auditoria.retencao`; o `fakeDb` não expressa `where`/`returning`/`batch`; o
lembrete é reivindicado por update condicional com `.returning()`; o expurgo
filtra `deletedAt < purgeCutoff`, ordena por `deletedAt` e limita a
`PURGE_BATCH` (25). Dois detalhes que o achado não dizia e que os testes
precisam respeitar:

- `audit()` não grava nada no teste a não ser que o próprio teste registre um
  sink com `onAudit`. O sink de verdade (`src/lib/audit-d1.ts`) só entra pelo
  `src/server.ts`.
- As limpezas de verdade (`src/lib/account-handlers.ts`: foto no R2, e-mail na
  auditoria) também só entram pelo `src/server.ts`. O teste NÃO importa esse
  arquivo (ele precisa de `env.BUCKET`); registra guards e limpezas próprios
  com `onAccountDeletionGuard`/`onBeforeAccountDelete` e limpa tudo com
  `resetAccountHandlers()` no `afterEach`.

### A decisão do harness (já tomada: não reabra)

**Escolhido: `node:sqlite` (embutido no Node) por baixo do driver
`drizzle-orm/d1` de verdade, através de um adaptador pequeno com a interface do
D1.** Nenhuma dependência nova. O que foi avaliado em `node_modules/`:

| Opção | Instalado? | Por que sim / não |
| --- | --- | --- |
| `better-sqlite3` | Não (só o adaptador `drizzle-orm/better-sqlite3`) | Dependência nova, nativa (compila no `npm ci`). Descartado. |
| `@libsql/client` | Não (só `drizzle-orm/libsql`) | Dependência nova. Descartado. |
| `node:sqlite` + adaptador com cara de D1 | Sim, vem no Node | **Escolhido.** O teste usa o MESMO driver da produção (`drizzle-orm/d1`, via `getDb` real): `returning`, `meta.changes` e `batch` passam pelo mesmo código. Roda em ~35 ms. |
| `drizzle-orm/sqlite-proxy` sobre `node:sqlite` | Sim | Driver diferente do da produção: o resultado de `delete` não tem `meta.changes`, que `jobs.ts` lê. Descartado. |
| D1 do miniflare via `getPlatformProxy` do `wrangler` | Sim (`wrangler` 4.158, `miniflare` 5 beta) | É o D1 de verdade, mas sobe o `workerd` a cada arquivo de teste, lê o `wrangler.jsonc` inteiro (Durable Object, rate limit, R2) e abre portas locais. Lento e frágil para um teste de unidade; o AGENTS.md já reserva o "D1 de verdade dentro do workerd" para o `@cloudflare/vitest-pool-workers`, como próximo passo. Descartado aqui. |

Custo da escolha, para ficar registrado: `node:sqlite` precisa do **Node 22.16
ou mais novo** (`statement.columns()` e `statement.setReturnArrays()` entraram
no 22.16.0; conferido na documentação do Node 22). O CI usa `node-version: 22`
(`.github/workflows/ci.yml:27`), que instala o 22.x mais recente. No Node 22 o
teste imprime um `ExperimentalWarning: SQLite is an experimental feature`:
é esperado, não é erro. O adaptador não é o D1: sem Sessions API, sem réplica,
sem limites da plataforma. É o mesmo motor (SQLite), com chaves estrangeiras
ligadas como no D1.

O harness e os testes deste plano já foram escritos e rodados contra o
código atual (fora do repositório): 14 testes passam, `tsc` e Biome limpos.
Conferido de novo em 2026-11-13, numa cópia da árvore de trabalho com os dois
blocos dos passos 2 e 3 extraídos deste arquivo (Node 26.12, `drizzle-orm`
0.45.4, `vitest` 4.1.12): `Tests  14 passed (14)`; suíte inteira
`27 passed (27)` / `226 passed (226)` (linha de base sem eles: `212 passed`);
com o corte do expurgo invertido, `Tests  10 failed | 4 passed (14)`.
**Copie os dois arquivos exatamente como estão nos passos 2 e 3.**

### Convenções do repositório que valem aqui

- Comentários e nomes de teste em pt-BR, simples e diretos (o público é quem
  está aprendendo). Sem travessão no meio da frase.
- Formatação do Biome: aspas simples, sem ponto e vírgula, vírgula no fim,
  2 espaços. Imports com `#/` (ex.: `#/lib/jobs`).
- Teste fica ao lado do código (`src/lib/*.test.ts`); utilitário de teste fica
  em `src/test/`.
- Padrão para trocar um módulo no teste, tirado de `src/lib/jobs.test.ts:6-9`
  (o `vi.hoisted` + `vi.mock` vêm ANTES do import do módulo testado):

  ```ts
  const state = vi.hoisted(() => ({ db: undefined as unknown }))
  vi.mock('#/db/index', () => ({ getDb: () => state.db }))

  import { AUDIT_RETENTION_DAYS, auditCutoff, runJobs } from '#/lib/jobs'
  ```

  O teste novo usa o mesmo padrão, mas para o e-mail (`#/lib/email`); o
  `getDb` fica o de verdade.
- D1 é SQLite: sem transação aninhada; `db.batch([...])` é a transação.
- Segredo nunca aparece em teste nem em plano. Estes testes não usam nenhum.

## Comandos de que você vai precisar

| Para quê | Comando | Esperado |
| --- | --- | --- |
| Versão do Node | `node -v` | `v22.16.0` ou mais novo |
| Só os testes novos | `npx vitest run src/lib/jobs-contas.test.ts` | `Tests  14 passed (14)` |
| Todos os testes | `npm run test` | sai com 0; nenhum teste falha |
| Tipos | `npm run typecheck` | sai com 0, sem erros |
| Lint e formato | `npm run check` | sai com 0 |
| Arrumar formato | `npx biome check --write src/test/sqlite-d1.ts src/lib/jobs-contas.test.ts` | sai com 0 |

Não precisa de `npm install`, `npm run build`, `npm run e2e` nem de deploy:
nada do app muda. NÃO rode `npm run check:fix` (ele reformataria arquivos de
outras pessoas que estão com mudanças não commitadas); use o comando da última
linha da tabela, só nos dois arquivos novos.

## Escopo

**Dentro do escopo** (os únicos arquivos que você pode criar ou alterar):

- `src/test/sqlite-d1.ts` (criar)
- `src/lib/jobs-contas.test.ts` (criar)
- `AGENTS.md` (duas frases, passo 5)
- `plans/README.md` (só a linha de status deste plano, se o arquivo existir)

**Fora do escopo** (NÃO toque, mesmo parecendo relacionado):

- `src/lib/jobs.ts` e `src/lib/account.ts` — o plano é testar o comportamento
  de hoje, não mudar. Se um teste novo falhar, o defeito é assunto para
  relatar (STOP), não para "consertar" o job. A única exceção é a edição
  temporária do passo 4, desfeita no mesmo passo.
- `src/lib/jobs.test.ts` e `src/test/fake-db.ts` — continuam como estão; outros
  testes (`src/lib/account-handlers.test.ts`) usam o `fakeDb`.
- `package.json` / `package-lock.json` — nenhuma dependência nova. Se achar que
  precisa de uma, é STOP.
- `vitest.config.ts` — o alias `#/` e o ambiente `node` já servem.
- `drizzle/` — o harness só LÊ as migrações.
- `README.md` e `content/docs/comecando.mdx` (dizem "Node.js 22 ou mais
  novo") — ficam para o dono decidir; veja "Notas de manutenção".
- Testes dos outros jobs (`auth.limpar-expirados`) e dos handlers do R2.
- A árvore de trabalho tem dezenas de arquivos modificados e não commitados
  por outra pessoa. Não reverta, não formate e não commite nenhum deles.

## Fluxo de git

- Não crie branch e **não faça commit**: a árvore tem mudanças não commitadas
  de outra pessoa (inclusive no `AGENTS.md`), e um commit seu as levaria junto.
  Deixe os arquivos novos e a edição do `AGENTS.md` na árvore de trabalho e
  relate o que mudou. Se o operador pedir commit, o estilo do repositório é
  uma frase em pt-BR no presente, sem prefixo (ex. do `git log`:
  `Tira as notas internas (HANDOFF e REVISAO) do repositório`), e só com
  `git add src/test/sqlite-d1.ts src/lib/jobs-contas.test.ts`.
- Não faça push nem abra PR.

## Passos

### Passo 1: Conferir o Node e a linha de base

Rode:

```sh
node -e "const {DatabaseSync}=require('node:sqlite');const s=new DatabaseSync(':memory:').prepare('select 1');process.exit(typeof s.columns==='function'&&typeof s.setReturnArrays==='function'?0:1)" && echo NODE_OK
npm run test 2>&1 | tail -6
```

**Verificação**: a primeira linha imprime `NODE_OK` (pode vir junto um
`ExperimentalWarning`; tudo bem). A segunda termina com
`Test Files  26 passed (26)` e `Tests  212 passed (212)` (a contagem medida em
2026-11-13; se a árvore mudou e os números forem outros, anote-os: o que
importa é nenhum teste falhando). Se não aparecer `NODE_OK`, ou se já houver
teste falhando antes de você mexer: STOP.

### Passo 2: Criar o harness `src/test/sqlite-d1.ts`

Crie o arquivo `src/test/sqlite-d1.ts` com exatamente este conteúdo:

```ts
// Banco de verdade para testes: um SQLite em memória (`node:sqlite`, que já vem
// no Node 22.16+) com as migrações de `drizzle/` aplicadas, vestido com a
// mesma interface do D1 que o Drizzle usa (`prepare`, `bind`, `all`, `run`,
// `raw`, `batch`). Assim `getDb(env.DB)` de verdade roda SQL de verdade: datas
// de corte, `where`, `returning`, cascata e `batch` são conferidos, não só
// "chamou delete". Use `fakeDb` (src/test/fake-db.ts) quando bastar saber SE
// o código chamou algo; use este quando o que importa é O QUE o SQL faz.
//
// Não é o D1: não tem Sessions API, réplica nem limites da plataforma. É o
// mesmo motor (SQLite) com chaves estrangeiras ligadas, como no D1.
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { DatabaseSync, StatementSync } from 'node:sqlite'

type Param = null | number | bigint | string | Uint8Array

const MIGRATIONS_DIR = join(import.meta.dirname, '../../drizzle')

function statement(sqlite: DatabaseSync, sql: string, params: Param[] = []) {
  const meta = (changes = 0, lastRowId: number | bigint = 0) => ({
    changes,
    last_row_id: Number(lastRowId),
    duration: 0,
    rows_read: 0,
    rows_written: changes,
    size_after: 0,
    changed_db: changes > 0,
    served_by: 'node:sqlite',
  })
  // Instrução que devolve linhas (SELECT ou `returning`): `all`. As outras: `run`.
  const execute = (arrays: boolean) => {
    const prepared = sqlite.prepare(sql)
    if (prepared.columns().length === 0) {
      const info = prepared.run(...params)
      return {
        rows: [] as unknown[],
        meta: meta(Number(info.changes), info.lastInsertRowid),
      }
    }
    prepared.setReturnArrays(arrays)
    const rows = prepared.all(...params) as unknown[]
    return { rows, meta: meta() }
  }
  return {
    bind: (...values: Param[]) => statement(sqlite, sql, values),
    async all() {
      const { rows, meta } = execute(false)
      return { success: true, results: rows, meta }
    },
    async run() {
      const { rows, meta } = execute(false)
      return { success: true, results: rows, meta }
    },
    async raw() {
      return execute(true).rows
    },
    async first() {
      return execute(false).rows[0] ?? null
    },
  }
}

/**
 * Um D1 de mentira por fora e SQLite de verdade por dentro, já migrado.
 * Crie um por teste (`beforeEach`): é instantâneo e nada vaza entre testes.
 * `sqlite` é o banco cru, para um teste espiar ou preparar algo em SQL puro.
 */
export function sqliteD1(): { d1: D1Database; sqlite: DatabaseSync } {
  if (typeof StatementSync.prototype.setReturnArrays !== 'function') {
    throw new Error(
      `src/test/sqlite-d1.ts precisa do Node 22.16 ou mais novo (você está no ${process.version}).`,
    )
  }
  const sqlite = new DatabaseSync(':memory:')
  sqlite.exec('PRAGMA foreign_keys = ON')
  // Mesma ordem do `wrangler d1 migrations apply`: pelo nome do arquivo.
  // `--> statement-breakpoint` é comentário de SQL: o arquivo roda inteiro.
  for (const file of readdirSync(MIGRATIONS_DIR).sort()) {
    if (!file.endsWith('.sql')) continue
    sqlite.exec(readFileSync(join(MIGRATIONS_DIR, file), 'utf8'))
  }
  const d1 = {
    prepare: (sql: string) => statement(sqlite, sql),
    // No D1, `batch` é uma transação: ou tudo vale, ou nada.
    async batch(statements: { all: () => Promise<unknown> }[]) {
      sqlite.exec('BEGIN')
      try {
        const results: unknown[] = []
        for (const item of statements) results.push(await item.all())
        sqlite.exec('COMMIT')
        return results
      } catch (error) {
        sqlite.exec('ROLLBACK')
        throw error
      }
    },
    async exec(sql: string) {
      sqlite.exec(sql)
      return { count: 0, duration: 0 }
    },
  }
  // Cast: só o que o Drizzle chama está implementado (sem `withSession`/`dump`).
  return { d1: d1 as unknown as D1Database, sqlite }
}
```

O que ele faz, para você entender (não mude):

- `sqliteD1()` abre um SQLite em memória, liga as chaves estrangeiras e roda
  os `.sql` de `drizzle/` em ordem de nome (a mesma ordem do
  `wrangler d1 migrations apply`).
- Devolve `d1`, um objeto com os métodos do D1 que o Drizzle chama
  (`prepare(sql).bind(...).all() / .run() / .raw()`, e `batch`), e `sqlite`, o
  banco cru.
- `raw()` devolve as linhas como arrays (é o que o Drizzle usa quando a
  consulta escolhe colunas); `all()`/`run()` devolvem `{ results, meta }`, com
  `meta.changes` igual ao do D1.

**Verificação**:

```sh
npx tsc --noEmit 2>&1 | tail -5; echo "tsc=$?"
npx biome check src/test/sqlite-d1.ts; echo "biome=$?"
```

Esperado: nenhuma linha de erro citando `src/test/sqlite-d1.ts` e `biome=0`.
(Se o `npx tsc --noEmit` reclamar de `worker-configuration.d.ts` ausente, rode
`npm run typecheck` no lugar: ele gera os tipos antes.) Se o Biome acusar só
formatação, rode
`npx biome check --write src/test/sqlite-d1.ts` e confira de novo.

### Passo 3: Criar os testes `src/lib/jobs-contas.test.ts`

Crie o arquivo `src/lib/jobs-contas.test.ts` com exatamente este conteúdo:

```ts
// Os dois jobs que mexem em contas encerradas (src/lib/jobs.ts), rodando contra
// SQLite de verdade (src/test/sqlite-d1.ts): aqui o que se confere é o
// resultado no banco. Um corte de data invertido apagaria contas ativas; estes
// testes ficam vermelhos se isso acontecer.
import { eq } from 'drizzle-orm'
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  type MockInstance,
  vi,
} from 'vitest'

import { account, session, user } from '#/db/auth-schema'
import { getDb } from '#/db/index'
import { clientes } from '#/db/schema'
import {
  AccountDeletionBlocked,
  onAccountDeletionGuard,
  onBeforeAccountDelete,
  resetAccountHandlers,
} from '#/lib/account'
import { type AuditRecord, onAudit } from '#/lib/audit'
import { sqliteD1 } from '#/test/sqlite-d1'

// E-mail de mentira: o teste só quer saber para quem e com que assunto saiu.
const mail = vi.hoisted(() => ({ send: vi.fn(async (_: unknown) => {}) }))
vi.mock('#/lib/email', () => ({ sendEmailSafely: mail.send }))

import { runJobs } from '#/lib/jobs'

const DAY = 86_400_000
// O cron roda às 03:00 UTC; os jobs leem a hora com `new Date()`.
const NOW = new Date('2026-11-20T03:00:00Z')
const daysAgo = (days: number) => new Date(NOW.getTime() - days * DAY)

let banco: ReturnType<typeof sqliteD1>
let env: Env
let db: ReturnType<typeof getDb>
let log: MockInstance<typeof console.log>
let removeSink: () => void
let audited: AuditRecord[]

/** Cria uma conta; `deletedAt: null` é conta ativa. */
async function addUser(
  id: string,
  deletedAt: Date | null,
  purgeRemindedAt: Date | null = null,
) {
  await db.insert(user).values({
    id,
    name: id,
    email: `${id}@exemplo.com`,
    deletedAt,
    purgeRemindedAt,
  })
}

const userIds = async () =>
  (await db.select({ id: user.id }).from(user)).map((row) => row.id).sort()

const remindedAt = async (id: string) =>
  (
    await db
      .select({ at: user.purgeRemindedAt })
      .from(user)
      .where(eq(user.id, id))
  )[0]?.at

const logged = (job: string) =>
  log.mock.calls.map(([line]) => String(line)).find((l) => l.includes(job))

beforeEach(() => {
  // Só o relógio (`Date`) é de mentira: promises e timers seguem normais.
  vi.useFakeTimers({ now: NOW, toFake: ['Date'] })
  banco = sqliteD1()
  env = { DB: banco.d1 } as unknown as Env
  db = getDb(env.DB)
  mail.send.mockClear()
  log = vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
  audited = []
  removeSink = onAudit('teste', async (record) => {
    audited.push(record)
  })
})

afterEach(() => {
  removeSink()
  resetAccountHandlers()
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('job conta.lembrar-exclusao', () => {
  it('lembra só a conta de 6 dias; a de 4, a de 8 e a ativa ficam sem e-mail', async () => {
    await addUser('ativa', null)
    await addUser('d4', daysAgo(4))
    await addUser('d6', daysAgo(6))
    await addUser('d8', daysAgo(8))

    const result = await runJobs(env)

    expect(result['conta.lembrar-exclusao']).toBe('ok')
    expect(logged('conta.lembrar-exclusao')).toBe(
      '[jobs] conta.lembrar-exclusao: lembradas=1',
    )
    expect(mail.send).toHaveBeenCalledTimes(1)
    const sent = mail.send.mock.calls[0][0] as { to: string; subject: string }
    expect(sent.to).toBe('d6@exemplo.com')
    // Encerrada em 14/11, apagada 7 dias depois: 21/11.
    expect(sent.subject).toContain('21 de novembro de 2026')
    expect(await remindedAt('d6')).toEqual(NOW)
    expect(await remindedAt('d4')).toBeNull()
    expect(await remindedAt('ativa')).toBeNull()
  })

  it('na segunda rodada não manda o lembrete de novo', async () => {
    await addUser('d6', daysAgo(6))

    await runJobs(env)
    await runJobs(env)

    expect(mail.send).toHaveBeenCalledTimes(1)
    const lines = log.mock.calls.map(([line]) => String(line))
    expect(lines.filter((l) => l.includes('conta.lembrar-exclusao'))).toEqual([
      '[jobs] conta.lembrar-exclusao: lembradas=1',
      '[jobs] conta.lembrar-exclusao: lembradas=0',
    ])
  })

  it('quem já foi lembrada não recebe outro, mesmo dentro do prazo', async () => {
    await addUser('d6', daysAgo(6), daysAgo(1))

    await runJobs(env)

    expect(mail.send).not.toHaveBeenCalled()
    expect(await remindedAt('d6')).toEqual(daysAgo(1))
  })

  it('se outro cron reivindicou no meio do caminho, este não manda o e-mail', async () => {
    await addUser('d6', daysAgo(6))
    // Simula a corrida: o job já leu a lista e, logo antes do update que
    // reivindica o lembrete, "outro cron" grava `purge_reminded_at`.
    const prepare = banco.d1.prepare.bind(banco.d1)
    let raced = false
    banco.d1.prepare = (query: string) => {
      if (!raced && query.startsWith('update "user"')) {
        raced = true
        banco.sqlite.exec(
          "UPDATE user SET purge_reminded_at = 1 WHERE id = 'd6'",
        )
      }
      return prepare(query)
    }

    await runJobs(env)

    expect(raced).toBe(true)
    expect(mail.send).not.toHaveBeenCalled()
    expect(logged('conta.lembrar-exclusao')).toBe(
      '[jobs] conta.lembrar-exclusao: lembradas=0',
    )
  })

  it('limites exatos: 5 dias em ponto ainda não lembra; 7 dias em ponto ainda lembra', async () => {
    await addUser('d5', daysAgo(5))
    await addUser('d7', daysAgo(7))

    await runJobs(env)

    expect(mail.send).toHaveBeenCalledTimes(1)
    expect((mail.send.mock.calls[0][0] as { to: string }).to).toBe(
      'd7@exemplo.com',
    )
    expect(await remindedAt('d5')).toBeNull()
  })
})

describe('job conta.apagar-encerradas', () => {
  it('apaga só a conta de 8 dias; a de 4, a de 6 e a ativa continuam', async () => {
    await addUser('ativa', null)
    await addUser('d4', daysAgo(4))
    await addUser('d6', daysAgo(6))
    await addUser('d8', daysAgo(8))

    const result = await runJobs(env)

    // Os quatro jobs rodam de verdade contra o SQLite (inclusive o `batch`).
    expect(result).toEqual({
      'auth.limpar-expirados': 'ok',
      'conta.lembrar-exclusao': 'ok',
      'conta.apagar-encerradas': 'ok',
      'auditoria.retencao': 'ok',
    })
    expect(logged('conta.apagar-encerradas')).toBe(
      '[jobs] conta.apagar-encerradas: apagadas=1 mantidas=0',
    )
    expect(await userIds()).toEqual(['ativa', 'd4', 'd6'])
  })

  it('no instante exato do prazo (7 dias) a conta ainda fica', async () => {
    await addUser('d7', daysAgo(7))
    await addUser('d7mais1ms', new Date(daysAgo(7).getTime() - 1))

    await runJobs(env)

    expect(await userIds()).toEqual(['d7'])
  })

  it('conta ativa nunca é apagada, nem com lembrete antigo gravado', async () => {
    // Conta restaurada pelo suporte: `deletedAt` zerado, `purgeRemindedAt` ficou.
    await addUser('restaurada', null, daysAgo(30))

    await runJobs(env)

    expect(await userIds()).toEqual(['restaurada'])
    expect(mail.send).not.toHaveBeenCalled()
  })

  it('leva junto sessões, logins e clientes da conta (cascata) e não toca nos de outra', async () => {
    await addUser('d8', daysAgo(8))
    await addUser('ativa', null)
    for (const id of ['d8', 'ativa']) {
      await db.insert(session).values({
        id: `s-${id}`,
        token: `t-${id}`,
        userId: id,
        // Sessão ainda válida: o job `auth.limpar-expirados` não a apaga.
        expiresAt: new Date(NOW.getTime() + DAY),
      })
      await db.insert(account).values({
        id: `a-${id}`,
        accountId: id,
        providerId: 'google',
        userId: id,
      })
      await db.insert(clientes).values({
        id: `c-${id}`,
        userId: id,
        nome: 'Ana',
        email: 'ana@exemplo.com',
      })
    }

    await runJobs(env)

    expect(await db.select({ id: session.id }).from(session)).toEqual([
      { id: 's-ativa' },
    ])
    expect(await db.select({ id: account.id }).from(account)).toEqual([
      { id: 'a-ativa' },
    ])
    expect(await db.select({ id: clientes.id }).from(clientes)).toEqual([
      { id: 'c-ativa' },
    ])
  })

  it('audita account.deleted com o id e sem o e-mail', async () => {
    await addUser('d8', daysAgo(8))

    await runJobs(env)

    expect(audited).toHaveLength(1)
    expect(audited[0]).toMatchObject({
      action: 'account.deleted',
      targetType: 'user',
      targetId: 'd8',
      actorId: null,
      actorEmail: null,
    })
  })

  it('guard que lança mantém a conta, pula a limpeza e não trava as outras', async () => {
    await addUser('bloqueada', daysAgo(9))
    await addUser('livre', daysAgo(8))
    const cleaned: string[] = []
    onAccountDeletionGuard('teste', async (ref) => {
      if (ref.id === 'bloqueada') {
        throw new AccountDeletionBlocked('Há uma assinatura ativa.')
      }
    })
    onBeforeAccountDelete('teste', async (ref) => {
      cleaned.push(ref.id)
    })

    const result = await runJobs(env)

    // O job não falha: a conta bloqueada fica para a noite seguinte.
    expect(result['conta.apagar-encerradas']).toBe('ok')
    expect(logged('conta.apagar-encerradas')).toBe(
      '[jobs] conta.apagar-encerradas: apagadas=1 mantidas=1',
    )
    expect(await userIds()).toEqual(['bloqueada'])
    expect(cleaned).toEqual(['livre'])
    expect(audited.map((record) => record.targetId)).toEqual(['livre'])
  })

  it('limpeza (onBeforeAccountDelete) que falha também mantém a conta', async () => {
    await addUser('d8', daysAgo(8))
    onBeforeAccountDelete('teste', async () => {
      throw new Error('R2 fora do ar')
    })

    await runJobs(env)

    expect(await userIds()).toEqual(['d8'])
    expect(audited).toEqual([])
  })

  it('a limpeza recebe id e e-mail da conta, com a linha ainda no banco', async () => {
    await addUser('d8', daysAgo(8))
    const seen: { ref: unknown; stillThere: boolean }[] = []
    onBeforeAccountDelete('teste', async (ref) => {
      seen.push({ ref, stillThere: (await userIds()).includes(ref.id) })
    })

    await runJobs(env)

    expect(seen).toEqual([
      { ref: { id: 'd8', email: 'd8@exemplo.com' }, stillThere: true },
    ])
    expect(await userIds()).toEqual([])
  })

  it('apaga no máximo 25 por noite, as mais antigas primeiro', async () => {
    // 27 contas vencidas: u08 encerrada há 8 dias ... u34 há 34 dias.
    // Inseridas da mais nova para a mais velha, para a ordem não vir "de graça".
    for (let days = 8; days <= 34; days++) {
      await addUser(`u${String(days).padStart(2, '0')}`, daysAgo(days))
    }
    const order: string[] = []
    onBeforeAccountDelete('teste', async (ref) => {
      order.push(ref.id)
    })

    await runJobs(env)

    expect(logged('conta.apagar-encerradas')).toBe(
      '[jobs] conta.apagar-encerradas: apagadas=25 mantidas=0',
    )
    // Sobram as duas encerradas por último.
    expect(await userIds()).toEqual(['u08', 'u09'])
    // A mais antiga (34 dias) foi a primeira; a de 10 dias, a última.
    expect(order[0]).toBe('u34')
    expect(order.at(-1)).toBe('u10')
    expect(order).toEqual([...order].sort().reverse())

    await runJobs(env)
    expect(await userIds()).toEqual([])
  })
})
```

Pontos que parecem estranhos e são de propósito (não "arrume"):

- `vi.mock('#/lib/email', ...)` fica entre os imports, antes de
  `import { runJobs } from '#/lib/jobs'`: é o padrão do repositório.
- `vi.useFakeTimers({ now: NOW, toFake: ['Date'] })` congela só o relógio. Sem
  o `toFake`, os `await` do teste travariam.
- `getDb` é o de verdade; `env.DB` é o adaptador. Nada de `fakeDb` aqui.
- Um `runJobs(env)` roda os QUATRO jobs. Por isso, num mesmo teste, a conta de
  8 dias não recebe lembrete (job 2) e é apagada (job 3).
- No teste da corrida, o `'update "user"'` é o começo do SQL que o Drizzle
  gera para o update do lembrete.

**Verificação**: `npx vitest run src/lib/jobs-contas.test.ts 2>&1 | tail -6`
→ `Test Files  1 passed (1)` e `Tests  14 passed (14)`.

Se algum teste falhar: confira se os dois arquivos estão idênticos aos blocos
acima (erro de cópia é a causa mais provável). Se estiverem idênticos e ainda
falhar, é STOP: ou o código do job mudou, ou há um defeito de verdade nele.
Relate o nome do teste e a mensagem; NÃO altere a expectativa para passar e
NÃO altere `src/lib/jobs.ts`.

### Passo 4: Provar que os testes mordem (edição temporária, desfeita aqui)

Este passo simula o defeito que motivou o plano e confere que os testes ficam
vermelhos. Ele edita `src/lib/jobs.ts` por um minuto e desfaz.

1. Confirme que o arquivo está limpo: `git diff --quiet -- src/lib/jobs.ts && echo LIMPO`
   → `LIMPO`. Se não imprimir `LIMPO`, pule este passo inteiro e relate (alguém
   está mexendo no arquivo).
2. Em `src/lib/jobs.ts`, linha 127, troque `lt(user.deletedAt, purgeCutoff(new Date())),`
   por `gte(user.deletedAt, purgeCutoff(new Date())),` (só essa linha; `gte`
   já está importado no topo do arquivo).
3. Rode `npx vitest run src/lib/jobs-contas.test.ts 2>&1 | grep -E "Tests "`.
   Esperado: `Tests  10 failed | 4 passed (14)`. O essencial é ter falhas,
   entre elas "apaga só a conta de 8 dias; a de 4, a de 6 e a ativa continuam".
4. Desfaça à mão: na mesma linha 127, volte `gte(user.deletedAt, purgeCutoff(new Date())),`
   para `lt(user.deletedAt, purgeCutoff(new Date())),`. Não use `git checkout`
   (o `AGENTS.md` pede um "sim" do dono antes de comandos que descartam
   mudanças); a verificação abaixo confere que o arquivo voltou a ficar igual.

**Verificação**:

```sh
git diff --quiet -- src/lib/jobs.ts && echo LIMPO
npx vitest run src/lib/jobs-contas.test.ts 2>&1 | grep -E "Tests "
```

Esperado: `LIMPO` e `Tests  14 passed (14)`. Se não imprimir `LIMPO`, a
linha 127 não voltou ao original: compare com o trecho de "Estado atual" e
corrija à mão. Se no item 3 NENHUM teste falhou,
desfaça a edição (item 4) e pare: é STOP (os testes não estão exercitando o
job).

### Passo 5: Registrar no `AGENTS.md`

O `AGENTS.md` é a fonte das regras do projeto (e já tem mudanças não
commitadas de outra pessoa: altere SÓ as duas frases abaixo). Faça duas
trocas de texto exatas.

Troca 1, na seção "Comandos". De:

```
- `npm run test` — Vitest (unidades, ambiente node, `cloudflare:workers` substituído por `src/test/cloudflare-workers.ts`)
```

Para:

```
- `npm run test` — Vitest (unidades, ambiente node, `cloudflare:workers` substituído por `src/test/cloudflare-workers.ts`; pede Node 22.16+, por causa do `node:sqlite` de `src/test/sqlite-d1.ts`)
```

Troca 2, na seção "Decisões registradas". O item começa com
`- **Vitest puro, com stub de `cloudflare:workers`**` e termina com
`fora do escopo da volta para v1.` Acrescente, no FIM dessa mesma linha (depois
de `v1.`, com um espaço antes), este texto:

```
Para testar o que o SQL faz (datas de corte, `where`, `returning`, cascata, `batch`) sem sair do Node, use `sqliteD1()` de `src/test/sqlite-d1.ts`: um SQLite em memória (`node:sqlite`, sem dependência nova) com as migrações de `drizzle/` aplicadas e a interface do D1, passado como `env.DB` para o `getDb` de verdade; o molde é `src/lib/jobs-contas.test.ts`. O `fakeDb` (`src/test/fake-db.ts`) continua servindo quando basta saber SE o código chamou algo. Não é o D1 (sem Sessions API, réplica ou limites).
```

**Verificação**:

```sh
grep -c "pede Node 22.16+" AGENTS.md
grep -c "use \`sqliteD1()\` de \`src/test/sqlite-d1.ts\`" AGENTS.md
grep -c "Vitest puro, com stub" AGENTS.md
git diff --stat -- AGENTS.md | tail -1
```

Esperado: `1`, `1`, `1`. A última linha mostra o total de linhas alteradas do
arquivo, que já tinha mudanças antes de você; o que importa é que as suas
foram só essas duas (confira com `git diff -- AGENTS.md | grep -n "sqlite"`:
aparecem só as duas linhas que você mexeu, cada uma com um `-` e um `+`).

### Passo 6: Conferência final

```sh
npm run typecheck; echo "typecheck=$?"
npx biome check src/test/sqlite-d1.ts src/lib/jobs-contas.test.ts; echo "biome=$?"
npm run test 2>&1 | tail -6
git status --short -- src/test src/lib/jobs-contas.test.ts src/lib/jobs.ts src/lib/jobs.test.ts package.json package-lock.json vitest.config.ts drizzle
```

**Verificação**: `typecheck=0`; `biome=0`; os testes terminam com
`Test Files  27 passed (27)` e `Tests  226 passed (226)` (ou a linha de base
do passo 1 mais 1 arquivo e 14 testes); e o `git status` mostra exatamente:

```
?? src/lib/jobs-contas.test.ts
?? src/test/sqlite-d1.ts
 M src/test/cloudflare-workers.ts
```

(a última linha já estava modificada antes de você, por outra pessoa; não é
sua). Sobre o `npm run check` do projeto inteiro: rode e leia; se ele acusar
arquivos que NÃO são os seus dois, anote no relato e não mexa neles.

## Plano de testes

Arquivo novo: `src/lib/jobs-contas.test.ts`, 14 testes, no molde de
`src/lib/jobs.test.ts` (mesmo `vi.hoisted` + `vi.mock` antes do import), mas
com banco de verdade. "Agora" fixo em `2026-11-20T03:00:00Z`.

`job conta.lembrar-exclusao` (5 testes):

1. Contas encerradas há 4, 6 e 8 dias e uma ativa: só a de 6 recebe e-mail
   (destinatário certo, assunto com "21 de novembro de 2026", a data de
   apagar), `purgeRemindedAt` gravado com "agora"; as outras sem lembrete.
2. Segunda rodada não manda de novo (`lembradas=1` e depois `lembradas=0`).
3. Conta que já tinha `purgeRemindedAt` não recebe outro.
4. Corrida: outro cron grava `purge_reminded_at` entre a leitura e o update;
   este não manda e-mail (`lembradas=0`). Trava o `isNull` do update.
5. Limites exatos: 5 dias em ponto não lembra; 7 dias em ponto ainda lembra.

`job conta.apagar-encerradas` (9 testes):

6. 4, 6, 8 dias e ativa: só a de 8 some; os quatro jobs devolvem `'ok'`.
7. 7 dias em ponto fica; 7 dias e 1 ms some.
8. Conta ativa com `purgeRemindedAt` antigo (restaurada pelo suporte) fica.
9. Cascata: sessão, login (`account`) e cliente da conta apagada somem; os de
   outra conta ficam.
10. Auditoria: um evento `account.deleted` com `targetId` e sem e-mail.
11. Guard que lança `AccountDeletionBlocked`: a conta fica, a limpeza dela não
    roda, a outra conta é apagada, log `apagadas=1 mantidas=1`, job `'ok'`.
12. Limpeza (`onBeforeAccountDelete`) que lança: a conta fica, sem auditoria.
13. A limpeza recebe `{ id, email }` com a linha ainda no banco.
14. Lote: 27 contas vencidas → apaga 25, as mais antigas primeiro (ordem
    conferida pela ordem das limpezas), sobram as 2 mais novas; a segunda
    rodada apaga as 2.

E-mail: `#/lib/email` trocado por `vi.fn` (nenhum e-mail sai, nenhum binding).

Mutações já testadas contra estes testes (fora do repositório), todas pegas:
corte do expurgo invertido (10 dos 14 falham), corte do lembrete invertido,
`isNull` tirado do update do lembrete, `.limit` tirado, lote de 24 em vez de
25 e guard não chamado (cada uma derruba pelo menos 1 teste). Uma mutação sobrevive de propósito: tirar o `isNull`
do SELECT do lembrete não muda o resultado, porque o update repete a condição.

Verificação: `npx vitest run src/lib/jobs-contas.test.ts` → 14 passam;
`npm run test` → tudo passa.

## Critérios de pronto

Verificáveis por comando. TODOS têm de valer:

- [ ] `test -f src/test/sqlite-d1.ts && test -f src/lib/jobs-contas.test.ts && echo OK` imprime `OK`
- [ ] `npx vitest run src/lib/jobs-contas.test.ts` sai com 0 e mostra `Tests  14 passed (14)`
- [ ] `npm run test` sai com 0 (linha de base do passo 1 + 1 arquivo + 14 testes)
- [ ] `npm run typecheck` sai com 0
- [ ] `npx biome check src/test/sqlite-d1.ts src/lib/jobs-contas.test.ts` sai com 0
- [ ] `git diff --quiet -- src/lib/jobs.ts src/lib/jobs.test.ts src/test/fake-db.ts package.json package-lock.json vitest.config.ts drizzle && echo INTACTOS` imprime `INTACTOS`
- [ ] `grep -c "sqliteD1()" AGENTS.md` imprime `1` e `grep -c "pede Node 22.16+" AGENTS.md` imprime `1`
- [ ] `grep -n "fakeDb\|#/test/fake-db" src/lib/jobs-contas.test.ts` não devolve nada
- [ ] O passo 4 foi feito e relatado (quantos testes falharam com o corte invertido)
- [ ] Se existir `plans/README.md`, a linha deste plano foi atualizada

## Condições de STOP

Pare e relate (não improvise) se:

- O passo 1 não imprimir `NODE_OK` (Node mais velho que 22.16). Não instale
  outra versão do Node nem troque o harness por outra biblioteca.
- Os trechos de "Estado atual" não baterem com `src/lib/jobs.ts` ou
  `src/lib/account.ts` (o código mudou depois deste plano).
- `src/test/sqlite-d1.ts` ou `src/lib/jobs-contas.test.ts` já existirem.
- Com os dois arquivos copiados exatamente, algum dos 14 testes falhar: pode
  ser um defeito de verdade no job. Relate; não mude o job nem a expectativa.
- As migrações falharem ao aplicar (`sqlite.exec` lançando erro em
  `drizzle/*.sql`): alguma migração nova usa algo que o SQLite puro não aceita.
- Você concluir que precisa de dependência nova, de mexer no
  `vitest.config.ts` ou de alterar `src/lib/jobs.ts` além do passo 4.
- No passo 4, nenhum teste falhar com o corte invertido.
- Uma verificação falhar duas vezes depois de uma tentativa razoável de acerto.

## Notas de manutenção

- **Migração nova** (`npm run db:generate`): o harness aplica sozinho todo
  `.sql` de `drizzle/`. Coluna obrigatória nova em `user`, `session`,
  `account` ou `clientes` quebra os `insert` do teste: acrescente o campo em
  `addUser` (ou nos `insert` do teste da cascata).
- **Mudou os prazos** (`ACCOUNT_RETENTION_DAYS`, `PURGE_REMINDER_DAY`) ou o
  `PURGE_BATCH`: os testes usam 4, 5, 6, 7 e 8 dias e 27 contas, de propósito
  fixos. Vão falhar, e é para falhar: ajuste os números lendo o que mudou.
- **Mudou o texto do log dos jobs** ou o assunto do e-mail do lembrete
  (`accountPurgeReminderEmail`): há asserções sobre os dois.
- **Subiu o `drizzle-orm`**: o adaptador implementa só o que o driver
  `drizzle-orm/d1` chama hoje (`prepare`, `bind`, `all`, `run`, `raw`,
  `batch`). O teste da corrida depende de o SQL do update começar com
  `update "user"`. Se um desses mudar, o teste falha com erro claro.
- **Node**: os testes passam a pedir Node 22.16+. O `README.md:28` e o
  `content/docs/comecando.mdx:11` dizem "Node.js 22 ou mais novo"; ficou fora
  deste plano decidir se o texto vira "22.16" (decisão do dono: é a porta de
  entrada do aluno). Quando o `node:sqlite` deixar de ser experimental, o
  aviso `ExperimentalWarning` no Node 22 some sozinho.
- **O que o revisor deve olhar**: que `src/lib/jobs.ts` não mudou; que o teste
  usa o `getDb` de verdade (sem `vi.mock('#/db/index')`); e que o adaptador não
  cresceu para "imitar o D1 inteiro" (ele é pequeno de propósito).
- **Deixado para depois, de propósito**: (1) testar `auth.limpar-expirados`
  e os handlers de `src/lib/account-handlers.ts` com o mesmo harness (agora é
  barato); (2) migrar `closeAccountFn` (`src/lib/account-fns.ts`) para testes
  com SQLite; (3) `@cloudflare/vitest-pool-workers`, para D1/R2/DO de verdade
  dentro do workerd, que o AGENTS.md já registra como próximo passo.
