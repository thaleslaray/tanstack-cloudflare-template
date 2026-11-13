# Plano 002: Testar o isolamento por usuário em clientes e os guards de encerrar conta

> **Instruções para quem executa**: siga este plano passo a passo. Rode cada
> comando de verificação e confirme o resultado esperado antes de ir para o
> próximo passo. Se acontecer qualquer coisa da seção "Condições de STOP",
> pare e relate: não improvise. Ao terminar, atualize a linha deste plano em
> `plans/README.md` (se o arquivo existir), a menos que um revisor tenha dito
> que ele mesmo mantém o índice.
>
> **Conferência de drift (rode primeiro)**: este plano foi escrito contra o
> commit `bb7333e` MAIS mudanças ainda não commitadas na árvore de trabalho de
> 2026-11-13. Por isso `git diff bb7333e..HEAD` não basta: confira os trechos.
> Rode o bloco abaixo; cada linha tem de imprimir o número indicado no
> comentário. Qualquer diferença é condição de STOP.
>
> ```sh
> grep -n "and(eq(clientes.id, data.id), eq(clientes.userId, user.id))" src/lib/clientes-fns.ts  # 85:...
> grep -n "if ((row?.total ?? 0) >= CLIENTES_MAX)" src/lib/clientes-fns.ts                        # 52:...
> grep -n "const FRESH_SESSION_MS = 60 \* 60 \* 1000" src/lib/account-fns.ts                      # 23:...
> grep -n "if (sessionAge > FRESH_SESSION_MS)" src/lib/account-fns.ts                             # 55:...
> grep -n "export function closeOutcome" src/lib/account.ts                                       # 141:...
> grep -n "code: 'ACCOUNT_CLOSED'" src/lib/auth.ts                                                # 140:...
> grep -n "const match = pattern.exec" e2e/helpers.ts                                             # 38:...
> grep -c "" e2e/login.spec.ts                                                                    # 158
> ls src/lib/clientes-db.ts src/lib/clientes-db.test.ts 2>&1 | grep -c "No such file"             # 2
> ```

## Status

- **Prioridade**: P1
- **Esforço**: M
- **Risco**: LOW (refatoração sem mudança de comportamento + testes novos; o passo de e2e é o único com incerteza, veja as condições de STOP)
- **Depende de**: `plans/001-testes-jobs-expurgo-com-sqlite-real.md` (cria o harness `src/test/sqlite-d1.ts`, função `sqliteD1(): { d1, sqlite }`, que este plano reaproveita: variante A do Passo 1). Execute o 001 antes. Só se o 001 for marcado REJECTED em `plans/README.md` (ou o arquivo do plano for apagado) vale a variante B, que cria um harness próprio.
- **Categoria**: tests (com um toque de security: são os testes dos controles de acesso)
- **Planejado em**: commit `bb7333e` + árvore de trabalho de 2026-11-13; confira o drift pelos trechos citados (bloco acima)

## Por que isto importa

Este repositório é um template para alunos leigos: o que estiver aqui vai ser
copiado para dezenas de apps. Três controles de acesso dele não têm teste
nenhum, então um aluno (ou um agente) pode quebrá-los sem que nada fique
vermelho:

1. **Isolamento por usuário em clientes.** A única coisa que impede a pessoa B
   de apagar ou listar o cliente da pessoa A é um `eq(clientes.userId, user.id)`
   dentro de `src/lib/clientes-fns.ts`. Tirar essa condição não quebra nenhum
   teste hoje (`src/lib/clientes.test.ts` só testa `validarCliente`).
2. **Guards de encerrar conta.** `closeAccountFn` recusa e-mail não verificado e
   sessão com mais de 1 hora, mas essa lógica está escrita dentro da server
   function e não tem teste (só `closeOutcome`, que já é pura, tem).
3. **Conta encerrada não entra de novo.** O hook `ACCOUNT_CLOSED` de
   `src/lib/auth.ts` não tem teste em camada nenhuma: o e2e encerra a conta e
   nunca tenta entrar de novo com o mesmo e-mail.

Depois deste plano: as consultas de clientes ficam numa função que recebe o
banco (testável com SQL de verdade), os guards do encerramento viram uma função
pura com as fronteiras testadas, e o e2e prova que o e-mail encerrado é recusado.
Nenhum comportamento do app muda.

## Estado atual

Tudo abaixo foi lido nos arquivos em disco em 2026-11-13.

### Arquivos e papéis

- `src/lib/clientes-fns.ts` (100 linhas) — as três server functions de clientes
  (`listClientesFn`, `createClienteFn`, `deleteClienteFn`). As consultas ao banco
  estão escritas dentro dos handlers.
- `src/lib/clientes.ts` — regras sem bindings: `CLIENTES_MAX = 500`,
  `validarCliente`, tipo `NovoCliente = { nome: string; email: string; situacao: Situacao }`.
- `src/lib/clientes.test.ts` — só testa `validarCliente` (4 testes).
- `src/lib/account-fns.ts` (129 linhas) — `closeAccountFn` e `exportMyDataFn`.
- `src/lib/account.ts` (157 linhas) — regras puras do ciclo de vida da conta
  (sem bindings). `closeOutcome` começa na linha 141.
- `src/lib/account.test.ts` (206 linhas, 17 testes) — testa `account.ts`.
- `src/lib/auth.ts` — factory do Better Auth; o hook `ACCOUNT_CLOSED` está nas linhas 129-144.
- `src/lib/auth-failure.ts` — traduz o erro do servidor em mensagem pt-BR.
- `src/components/auth/email-otp-form.tsx` — formulário de login por código.
- `e2e/login.spec.ts` (158 linhas, 7 testes em série) e `e2e/helpers.ts`.
- `src/test/fake-db.ts` — banco de mentira que NÃO executa SQL (só registra
  chamadas). Não serve para testar isolamento: é preciso SQL de verdade.
- `src/test/cloudflare-workers.ts` — stub de `cloudflare:workers` nos testes.
- `src/db/index.ts` — `getDb(d1: D1Database)` devolve o Drizzle sobre o D1.
  Fora de um pedido (testes) usa o D1 passado direto.
- `drizzle/*.sql` — 5 migrações (`0000_...` a `0004_...`), separadas por
  `--> statement-breakpoint`.

### Trechos (confira que batem)

`src/lib/clientes-fns.ts:19-41` (sessão e listar):

```ts
async function requireUser() {
  const current = await getRequestSession()
  if (!current) throw new Error('Entre na sua conta primeiro.')
  return { user: current.user, headers: getRequest().headers }
}

export const listClientesFn = createServerFn({ method: 'GET' }).handler(
  async () => {
    const { user } = await requireUser()
    return getDb(env.DB)
      .select({
        id: clientes.id,
        nome: clientes.nome,
        email: clientes.email,
        situacao: clientes.situacao,
        createdAt: clientes.createdAt,
      })
      .from(clientes)
      .where(eq(clientes.userId, user.id))
      .orderBy(desc(clientes.createdAt))
      .limit(CLIENTES_MAX)
  },
)
```

`src/lib/clientes-fns.ts:45-58` (criar: conta e depois insere; não é atômico):

```ts
  .handler(async ({ data }) => {
    const { user, headers } = await requireUser()
    const db = getDb(env.DB)
    const [row] = await db
      .select({ total: count() })
      .from(clientes)
      .where(eq(clientes.userId, user.id))
    if ((row?.total ?? 0) >= CLIENTES_MAX) {
      throw new Error(
        `Você chegou ao limite de ${CLIENTES_MAX} clientes. Apague algum para adicionar outro.`,
      )
    }
    const id = crypto.randomUUID()
    await db.insert(clientes).values({ id, userId: user.id, ...data })
```

`src/lib/clientes-fns.ts:80-87` (apagar):

```ts
  .handler(async ({ data }) => {
    const { user, headers } = await requireUser()
    // O `and` com userId é o que impede apagar o cliente de outra pessoa.
    const apagados = await getDb(env.DB)
      .delete(clientes)
      .where(and(eq(clientes.id, data.id), eq(clientes.userId, user.id)))
      .returning({ id: clientes.id })
    if (apagados.length === 0) throw new Error('Cliente não encontrado.')
```

`src/lib/account-fns.ts:22-23` e `43-62` (os guards que serão extraídos):

```ts
// Mesmo valor de `session.freshAge` em src/lib/auth.ts.
const FRESH_SESSION_MS = 60 * 60 * 1000
```

```ts
export const closeAccountFn = createServerFn({ method: 'POST' }).handler(
  async () => {
    const { current, headers } = await requireSession()
    // Quem não confirmou o e-mail pode ter criado a conta no nome de outra pessoa.
    if (!current.user.emailVerified) {
      throw new Error('Confirme seu e-mail antes de encerrar a conta.')
    }
    // "freshAge" feito à mão: o do Better Auth só vale para os endpoints dele
    // (senha, e-mail), e aqui o login é por código. Sessão com mais de 1 hora
    // (cookie esquecido ou roubado) não encerra a conta.
    const sessionAge =
      Date.now() - new Date(current.session.createdAt).getTime()
    if (sessionAge > FRESH_SESSION_MS) {
      throw new Error(
        'Por segurança, entre de novo (peça um novo código) antes de encerrar a conta.',
      )
    }
    const me = { id: current.user.id, email: current.user.email }
    // Um guard pode recusar (ex.: assinatura ativa); a mensagem chega à tela.
    await runAccountDeletionGuards(me)
```

`src/lib/auth.ts:129-144` (o hook; este plano NÃO mexe nele, só o testa pelo e2e):

```ts
      session: {
        create: {
          before: async (newSession) => {
            const [owner] = await getDb(env.DB)
              .select({ deletedAt: userTable.deletedAt })
              .from(userTable)
              .where(eq(userTable.id, newSession.userId))
              .limit(1)
            if (owner?.deletedAt) {
              throw new APIError('FORBIDDEN', {
                message: 'Esta conta foi encerrada.',
                code: 'ACCOUNT_CLOSED',
              })
            }
          },
        },
      },
```

`src/lib/auth-failure.ts:67-68` (a mensagem que a tela mostra):

```ts
    case 'account_closed':
      return 'Esta conta foi encerrada e será apagada em breve. Para recuperá-la, fale com o suporte.'
```

`e2e/helpers.ts:33-41` (lê o PRIMEIRO código do log para o e-mail):

```ts
  const pattern = new RegExp(
    `\\[auth\\] código de login para ${escapeRegExp(email)}: (\\d{6})`,
  )
  const deadline = Date.now() + 15_000
  while (Date.now() < deadline) {
    const match = pattern.exec(fs.readFileSync(logPath, 'utf8'))
    if (match) return match[1]
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
```

`e2e/login.spec.ts:147-158` (o último teste do arquivo hoje):

```ts
test('encerra a conta: sai na hora e /app volta a pedir login', async () => {
  await page.getByRole('button', { name: 'Encerrar conta' }).click()
  const dialog = page.getByRole('dialog')
  const confirm = dialog.getByRole('button', { name: 'Encerrar conta' })
  await expect(confirm).toBeDisabled()
  await dialog.getByLabel(/Digite ENCERRAR/).fill('ENCERRAR')
  await confirm.click()

  await expect(page).toHaveURL(/\/$/)
  await page.goto('/app')
  await expect(page).toHaveURL(/\/login\?redirect=%2Fapp$/)
})
```

### Fatos conferidos que corrigem ou completam o achado original

1. **O hook `ACCOUNT_CLOSED` NÃO dispara ao pedir o código.** Ele roda em
   `session.create.before`, ou seja, só quando o código é ACEITO e o Better Auth
   vai criar a sessão. Pedir o código para um e-mail encerrado funciona
   normalmente (o código sai no log). A mensagem de conta encerrada só aparece
   depois de digitar o código certo e clicar em "Entrar". O passo de e2e tem de
   fazer o login inteiro, não só pedir o código.
2. **`readLoginCode` devolve o primeiro código do log.** Num segundo login com o
   MESMO e-mail ele devolveria o código antigo (já usado). É preciso um parâmetro
   para pular os códigos anteriores (Passo 6).
3. **Conta do rate limit.** Cada login pelo formulário faz 2 POSTs contados em
   `/api/auth/*`: `email-otp/send-verification-otp` e `sign-in/email-otp`
   (`/sign-out` e `/get-session` não contam: `src/lib/auth-rate-limit.ts:7`).
   Cada POST gasta 1 da chave por IP (`auth:<ip>`) e 1 da chave por e-mail
   (`auth-email:<email>`); o limite é 5 por 60 s (`wrangler.jsonc`, binding
   `PUBLIC_RATE_LIMIT`). O `npm run e2e` roda os arquivos em ordem alfabética
   com 1 worker: `guards.spec.ts` (1 login = 2 POSTs) e depois `login.spec.ts`
   (1 login = 2 POSTs). O passo novo faz mais 2: **6 POSTs por IP, acima de 5**,
   se tudo cair no mesmo minuto. Por e-mail são 4 (2 + 2), abaixo de 5.
   No servidor local a janela é FIXA e alinhada ao relógio
   (`node_modules/miniflare/dist/src/workers/ratelimit/ratelimit-object.worker.js`:
   `epoch = Math.floor(Date.now() / (period * 1e3))`): o contador zera quando o
   minuto do relógio vira. Por isso o passo novo espera a virada do minuto antes
   de pedir o código (Passo 7).
4. **A mensagem `account_closed` já tem teste de unidade** (`src/lib/auth-failure.test.ts`).
   O que não tem teste é o hook em si. O e2e cobre o hook de ponta a ponta.
5. **O teto `CLIENTES_MAX` é "conta e depois insere"**, sem transação. Dois
   pedidos simultâneos podem passar os dois do limite. Este plano TESTA o
   comportamento sequencial e NÃO corrige a corrida (fora de escopo).
6. **O e2e tem hoje 19 testes em 4 arquivos** (`npx playwright test --list`).
   Depois deste plano: 20.
7. **O achado dizia "use o harness do plano 001 se ele existir".** Ele existe:
   `plans/001-testes-jobs-expurgo-com-sqlite-real.md` cria
   `src/test/sqlite-d1.ts` (SQLite em memória do `node:sqlite`, chaves
   estrangeiras ligadas, migrações de `drizzle/` aplicadas, devolve
   `{ d1, sqlite }` para passar ao `getDb` de verdade; pede Node 22.16+, e a
   máquina onde o plano foi escrito tem Node 26). Por isso a dependência é
   declarada no Status, e o Passo 1 confere por comando se o harness já está em
   disco. Em 2026-11-13 ele ainda NÃO está (`ls src/test` mostra só
   `cloudflare-workers.ts` e `fake-db.ts`): o plano 001 não foi executado.
8. **Os demais fatos do achado conferem** com o disco: o `and(eq(id), eq(userId))`
   do apagar (`clientes-fns.ts:85`), o "conta e depois insere" do teto
   (`clientes-fns.ts:48-58`), os dois guards de `closeAccountFn`
   (`account-fns.ts:46-59`), `closeOutcome` puro e testado (`account.ts:141`,
   `account.test.ts`), `clientes.test.ts` só com `validarCliente`, e o
   `e2e/login.spec.ts` que encerra a conta sem tentar entrar de novo. A única
   correção é a do item 1: o hook não reage ao PEDIDO do código, só ao login.

### Convenções do repositório que valem aqui

- Explicações e comentários em pt-BR, simples e diretos. Nomes de domínio em
  português (`listarClientes`, `criarCliente`), como em `src/lib/clientes.ts`.
- Padrão de arquivos em `src/lib/`: `<area>.ts` = regras puras sem bindings;
  `<area>-fns.ts` = server functions. Este plano acrescenta `<area>-db.ts` =
  consultas que recebem o `db` por parâmetro (sem `env`, sem `getRequest`).
- Código puro e testado junto, como `closeOutcome` em `src/lib/account.ts:141-150`
  com os testes em `src/lib/account.test.ts:182-206`. O molde de teste:

  ```ts
  describe('closeOutcome (pedidos simultâneos ao encerrar)', () => {
    const now = new Date('2026-11-20T03:00:00Z')

    it('1 linha mudada: este pedido encerrou, prazo a partir de agora', () => {
      expect(closeOutcome(1, null, now)).toEqual({
        first: true,
        purgeAt: purgeDateFor(now),
      })
    })
  ```

- Formatação (Biome): aspas simples, sem ponto e vírgula, vírgula final,
  2 espaços, imports organizados. `src/rules.test.ts` proíbe `process.env` e
  `import ... from 'wrangler'` em `src/`, EXCETO dentro de `src/test/` e em
  arquivos `*.test.ts` (linhas 15-27 de `src/rules.test.ts`).
- Bindings só via `import { env } from 'cloudflare:workers'`, lido dentro de
  função. `getDb(env.DB)` é factory por pedido: nunca guarde o `db` em variável
  de módulo fora de teste.
- Server function que muda estado usa `method: 'POST'`. Os nomes e o arquivo das
  server functions (`createClienteFn` em `src/lib/clientes-fns.ts`) NÃO podem
  mudar: o teste de carga (`load/p95.js`) acha o endpoint por esses nomes.
- D1 aceita no máximo 100 parâmetros por instrução: insert em lote tem de ser fatiado.

## Comandos que você vai precisar

| Para quê | Comando | Esperado |
|---|---|---|
| Tipos | `npm run typecheck` | exit 0, sem erros |
| Lint/formatação (só confere) | `npm run check` | exit 0 |
| Formatar só os seus arquivos | `npx biome check --write <arquivos>` | exit 0 |
| Testes de unidade | `npm run test` | todos passam |
| Um arquivo de teste | `npx vitest run src/lib/clientes-db.test.ts` | todos passam |
| Listar e2e sem rodar | `npx playwright test --list` | `Total: N tests in 4 files` |
| e2e completo | `npm run e2e` (porta ocupada: `E2E_PORT=3014 E2E_PREVIEW_PORT=4184 npm run e2e`) | `N passed` |

Não rode `npm run check:fix` no repositório inteiro: há mudanças de outras
pessoas na árvore de trabalho. Formate só os arquivos do escopo.

## Escopo

**Dentro do escopo** (os únicos arquivos que você pode criar ou modificar):

- `src/lib/clientes-db.ts` (criar)
- `src/lib/clientes-db.test.ts` (criar)
- `src/lib/clientes-fns.ts`
- `src/lib/account.ts`
- `src/lib/account.test.ts`
- `src/lib/account-fns.ts`
- `src/test/d1.ts` (criar, SÓ na variante B do Passo 1)
- `e2e/helpers.ts`
- `e2e/login.spec.ts`
- `e2e/README.md` (uma frase)
- `AGENTS.md` (três trocas de texto; quatro na variante B)
- `.claude/skills/tela/SKILL.md` (duas trocas de texto)
- `plans/README.md` (só a linha de status deste plano, se o arquivo existir)

**Fora do escopo** (NÃO toque, mesmo parecendo relacionado):

- `src/lib/auth.ts` — o hook `ACCOUNT_CLOSED` fica como está; ele é testado
  pelo e2e. Mexer nele muda o login de todo mundo.
- `src/routes/_app/app/clientes.tsx`, `src/components/account/account-data.tsx`
  — as telas chamam as mesmas server functions; nada muda para elas.
- `src/test/fake-db.ts`, `src/test/cloudflare-workers.ts`, `vitest.config.ts`,
  `playwright.config.ts`, `package.json`, `package-lock.json` — nenhuma
  dependência nova, nenhuma config nova.
- Corrigir a corrida do teto `CLIENTES_MAX` (contar e inserir não é atômico) —
  é mudança de comportamento; pede um plano próprio.
- Nomes, arquivo e mensagens de erro das server functions — `load/p95.js` e as
  telas dependem deles.
- `wrangler.jsonc` e o limite de 5/min — não aumente o limite para o teste passar.
- Qualquer outro arquivo modificado que apareça em `git status`: são mudanças
  não commitadas do dono do repositório. Não reverta, não formate, não commite.

## Fluxo de git

- A árvore de trabalho já tem mudanças não commitadas de outra pessoa, inclusive
  em arquivos deste escopo (`AGENTS.md`, `src/lib/account.ts`, `src/lib/account-fns.ts`,
  `src/lib/account.test.ts`, `.claude/skills/tela/SKILL.md`). Por isso:
  **NÃO crie branch, NÃO faça commit, NÃO faça push**, a menos que o operador
  peça. Deixe as mudanças na árvore de trabalho e liste no relato final os
  arquivos que você criou ou alterou.
- Se o operador pedir commit: mensagem em pt-BR no estilo do repositório, uma
  frase começando pela área, por exemplo `Testes: isolamento por usuário em clientes e guards de encerrar conta`
  (exemplos do `git log`: `Deploy: passo da réplica de leitura do D1 na skill e no README`,
  `Web perf: checklist no HTML do servidor e JS principal 21% menor`).

## Passos

### Passo 0: Medir a linha de base

Rode e anote os três números:

```sh
npx vitest run 2>&1 | grep -E "Test Files|Tests "
npx vitest run src/lib/account.test.ts 2>&1 | grep -E "Tests "
npx playwright test --list 2>&1 | tail -1
```

**Verificar**: o primeiro comando termina com todos passando (em 2026-11-13:
`Test Files  26 passed (26)` e `Tests  212 passed (212)`; se o plano 001 já
rodou, os números serão maiores, tudo bem: anote os que você viu). O segundo:
`Tests  17 passed (17)`. O terceiro: `Total: 19 tests in 4 files`. Se algum
teste já falha antes de você mexer, STOP.

### Passo 1: Escolher o banco de teste (com SQL de verdade)

Rode:

```sh
grep -l "export function sqliteD1" src/test/*.ts 2>/dev/null
ls plans/001-*.md 2>/dev/null && grep -l "sqlite-d1" plans/001-*.md 2>/dev/null
```

Decida pela tabela:

| 1º comando imprime `src/test/sqlite-d1.ts`? | 2º comando imprime algum arquivo? | O que fazer |
|---|---|---|
| sim | tanto faz | **Variante A**: use o harness que já existe. Não crie `src/test/d1.ts`. |
| não | sim | **STOP**: o plano 001 cria esse harness e ainda não foi executado. Relate "execute o plano 001 antes". |
| não | não | **Variante B**: crie `src/test/d1.ts` (abaixo). Só acontece se o plano 001 foi abandonado e o arquivo dele apagado. |

Se `plans/README.md` existir e marcar o 001 como `REJECTED`, trate a linha
"não / sim" como variante B (o harness nunca virá).

**Variante B** — crie `src/test/d1.ts` com exatamente este conteúdo:

```ts
// Banco de verdade para testes: o D1 local do Wrangler (o mesmo do
// `npm run dev`), em memória, com as migrações de `drizzle/` aplicadas.
// `getDb` de verdade roda SQL de verdade: `where`, `returning` e chave
// estrangeira são conferidos, não só "chamou delete". Use `fakeDb`
// (src/test/fake-db.ts) quando bastar saber SE o código chamou algo; use este
// quando o que importa é O QUE o SQL faz.
//
// `persist: false` = nada é gravado em `.wrangler/state/`: o banco do seu
// `npm run dev` não é tocado e cada `testDb()` começa vazio. O aviso
// "internal Durable Objects" que o Wrangler imprime é esperado (o teste não
// usa o Counter).
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { getPlatformProxy } from 'wrangler'

import { getDb } from '#/db/index'

const ROOT = join(import.meta.dirname, '../..')

/** Abra um por arquivo de teste (`beforeAll`) e feche no `afterAll`. */
export async function testDb() {
  const proxy = await getPlatformProxy<{ DB: D1Database }>({
    configPath: join(ROOT, 'wrangler.jsonc'),
    persist: false,
  })
  // Mesma ordem do `wrangler d1 migrations apply`: pelo nome do arquivo.
  const dir = join(ROOT, 'drizzle')
  const files = readdirSync(dir)
    .filter((name) => name.endsWith('.sql'))
    .sort()
  for (const file of files) {
    const statements = readFileSync(join(dir, file), 'utf8')
      .split('--> statement-breakpoint')
      .map((statement) => statement.trim())
      .filter(Boolean)
    for (const statement of statements) {
      await proxy.env.DB.prepare(statement).run()
    }
  }
  return { db: getDb(proxy.env.DB), dispose: () => proxy.dispose() }
}
```

(Este arquivo foi prototipado fora do repositório em 2026-11-13 com o Wrangler
instalado: sobe em cerca de 0,4 s, cria as 7 tabelas e não altera `.wrangler/state/`.)

**Verificar** (variante B): `npx tsc --noEmit` → exit 0, sem saída;
`npx vitest run src/rules.test.ts 2>&1 | grep -E "Tests "` → todos passam (a
regra "não importa o Wrangler" ignora `src/test/`).
**Verificar** (variante A): `grep -c "d1:" src/test/sqlite-d1.ts` → 1 ou mais
(a função devolve um objeto com a chave `d1`). Se der 0, STOP.

### Passo 2: Criar `src/lib/clientes-db.ts` (as consultas, recebendo o banco)

Crie `src/lib/clientes-db.ts` com exatamente este conteúdo. As consultas são as
MESMAS de `clientes-fns.ts`, só trocando `user.id` por `userId` e `data.id` por `id`:

```ts
// As consultas da tela de clientes. Cada função recebe o banco e o `userId`
// da sessão: TODA consulta filtra por ele, e é isso que impede uma pessoa de
// ler ou apagar o cliente de outra. Quem confere a sessão, valida o
// formulário e audita é src/lib/clientes-fns.ts.
//
// Ficam separadas das server functions para ter teste com SQL de verdade
// (src/lib/clientes-db.test.ts). Tirou um `eq(clientes.userId, ...)` daqui?
// O teste fica vermelho.
import { and, count, desc, eq } from 'drizzle-orm'

import type { getDb } from '#/db/index'
import { clientes } from '#/db/schema'
import { CLIENTES_MAX, type NovoCliente } from '#/lib/clientes'

type Db = ReturnType<typeof getDb>

/** Os clientes de UMA pessoa, do mais novo para o mais antigo. */
export function listarClientes(db: Db, userId: string) {
  return db
    .select({
      id: clientes.id,
      nome: clientes.nome,
      email: clientes.email,
      situacao: clientes.situacao,
      createdAt: clientes.createdAt,
    })
    .from(clientes)
    .where(eq(clientes.userId, userId))
    .orderBy(desc(clientes.createdAt))
    .limit(CLIENTES_MAX)
}

/**
 * Cria um cliente para a pessoa, até o teto de CLIENTES_MAX por pessoa.
 * Conta e depois insere (sem transação): dois pedidos ao mesmo tempo podem
 * passar um pouco do teto. É um teto contra abuso, não uma regra de negócio.
 */
export async function criarCliente(db: Db, userId: string, data: NovoCliente) {
  const [row] = await db
    .select({ total: count() })
    .from(clientes)
    .where(eq(clientes.userId, userId))
  if ((row?.total ?? 0) >= CLIENTES_MAX) {
    throw new Error(
      `Você chegou ao limite de ${CLIENTES_MAX} clientes. Apague algum para adicionar outro.`,
    )
  }
  const id = crypto.randomUUID()
  await db.insert(clientes).values({ id, userId, ...data })
  return { id }
}

/** Apaga o cliente SE ele for da pessoa. De outra pessoa = "não encontrado". */
export async function apagarCliente(db: Db, userId: string, id: string) {
  // O `and` com userId é o que impede apagar o cliente de outra pessoa.
  const apagados = await db
    .delete(clientes)
    .where(and(eq(clientes.id, id), eq(clientes.userId, userId)))
    .returning({ id: clientes.id })
  if (apagados.length === 0) throw new Error('Cliente não encontrado.')
  return { id }
}
```

**Verificar**: `npx tsc --noEmit` → exit 0, sem saída.

### Passo 3: Escrever `src/lib/clientes-db.test.ts`

Crie o arquivo. O CABEÇALHO depende da variante do Passo 1; o CORPO é igual.

Cabeçalho, **variante A** (`src/test/sqlite-d1.ts` existe):

```ts
// Isolamento por usuário e teto de clientes, contra SQLite de verdade: aqui o
// que se confere é o resultado no banco, não se a função "chamou delete".
// Se alguém tirar o `eq(clientes.userId, ...)` de uma consulta de
// src/lib/clientes-db.ts, estes testes ficam vermelhos.
import { beforeAll, describe, expect, it } from 'vitest'

import { user } from '#/db/auth-schema'
import { getDb } from '#/db/index'
import { clientes } from '#/db/schema'
import { CLIENTES_MAX } from '#/lib/clientes'
import { apagarCliente, criarCliente, listarClientes } from '#/lib/clientes-db'
import { sqliteD1 } from '#/test/sqlite-d1'

let db: ReturnType<typeof getDb>

beforeAll(async () => {
  db = getDb(sqliteD1().d1)
  await db.insert(user).values([
    { id: 'user-a', name: 'Ana', email: 'ana@exemplo.test' },
    { id: 'user-b', name: 'Bia', email: 'bia@exemplo.test' },
  ])
})
```

Cabeçalho, **variante B** (`src/test/d1.ts` criado no Passo 1):

```ts
// Isolamento por usuário e teto de clientes, contra SQLite de verdade: aqui o
// que se confere é o resultado no banco, não se a função "chamou delete".
// Se alguém tirar o `eq(clientes.userId, ...)` de uma consulta de
// src/lib/clientes-db.ts, estes testes ficam vermelhos.
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { user } from '#/db/auth-schema'
import type { getDb } from '#/db/index'
import { clientes } from '#/db/schema'
import { CLIENTES_MAX } from '#/lib/clientes'
import { apagarCliente, criarCliente, listarClientes } from '#/lib/clientes-db'
import { testDb } from '#/test/d1'

let db: ReturnType<typeof getDb>
let fechar: () => Promise<void>

beforeAll(async () => {
  const aberto = await testDb()
  db = aberto.db
  fechar = aberto.dispose
  await db.insert(user).values([
    { id: 'user-a', name: 'Ana', email: 'ana@exemplo.test' },
    { id: 'user-b', name: 'Bia', email: 'bia@exemplo.test' },
  ])
})

afterAll(async () => {
  await fechar()
})
```

Corpo (igual nas duas variantes; cole logo depois do cabeçalho). Os testes
rodam em ordem e dependem um do outro de propósito (o banco é um só por arquivo):

```ts

const A = 'user-a'
const B = 'user-b'
const novo = (nome: string) => ({
  nome,
  email: 'cliente@exemplo.test',
  situacao: 'ativo' as const,
})
const idsDe = async (userId: string) =>
  (await listarClientes(db, userId)).map((cliente) => cliente.id)

describe('isolamento por usuário', () => {
  it('B não lista o cliente de A', async () => {
    const { id } = await criarCliente(db, A, novo('Cliente da Ana'))
    expect(await idsDe(A)).toEqual([id])
    expect(await idsDe(B)).toEqual([])
  })

  it('B não apaga o cliente de A: erro igual ao de id inexistente', async () => {
    const [idDaAna] = await idsDe(A)
    await expect(apagarCliente(db, B, idDaAna)).rejects.toThrow(
      'Cliente não encontrado.',
    )
    await expect(apagarCliente(db, B, 'nao-existe')).rejects.toThrow(
      'Cliente não encontrado.',
    )
    // O cliente da Ana continua lá.
    expect(await idsDe(A)).toEqual([idDaAna])
  })

  it('A apaga o próprio cliente', async () => {
    const [idDaAna] = await idsDe(A)
    await expect(apagarCliente(db, A, idDaAna)).resolves.toEqual({
      id: idDaAna,
    })
    expect(await idsDe(A)).toEqual([])
  })
})

describe('teto de CLIENTES_MAX por pessoa', () => {
  it('o 500º entra, o 501º é recusado, e o teto de A não afeta B', async () => {
    expect(CLIENTES_MAX).toBe(500)
    // 499 linhas direto na tabela, de 10 em 10 (o D1 aceita no máximo 100
    // parâmetros por instrução; 10 linhas x 5 colunas = 50).
    const linhas = Array.from({ length: CLIENTES_MAX - 1 }, (_, i) => ({
      id: `semente-${i}`,
      userId: A,
      ...novo(`Cliente ${i}`),
    }))
    for (let i = 0; i < linhas.length; i += 10) {
      await db.insert(clientes).values(linhas.slice(i, i + 10))
    }

    await expect(criarCliente(db, A, novo('O 500º'))).resolves.toEqual({
      id: expect.any(String),
    })
    await expect(criarCliente(db, A, novo('O 501º'))).rejects.toThrow(
      'Você chegou ao limite de 500 clientes. Apague algum para adicionar outro.',
    )
    expect(await idsDe(A)).toHaveLength(CLIENTES_MAX)

    // O teto é por pessoa: B continua podendo criar.
    await expect(criarCliente(db, B, novo('Da Bia'))).resolves.toEqual({
      id: expect.any(String),
    })
    expect(await idsDe(B)).toHaveLength(1)
  })
})
```

**Verificar**: `npx vitest run src/lib/clientes-db.test.ts 2>&1 | grep -E "Tests |FAIL"`
→ `Tests  4 passed (4)`, nenhuma linha `FAIL`. (Protótipo de 2026-11-13: os 4
passam nas duas variantes, em menos de 1 s.)

**Prova de que o teste pega o bug** (obrigatória; desfaça no fim):

1. Em `src/lib/clientes-db.ts`, troque temporariamente
   `.where(and(eq(clientes.id, id), eq(clientes.userId, userId)))` por
   `.where(eq(clientes.id, id))`.
2. Rode `npx vitest run src/lib/clientes-db.test.ts 2>&1 | grep -E "Tests "` →
   tem de mostrar `2 failed` (os testes "B não apaga" e "A apaga o próprio").
3. Desfaça a troca. Rode de novo → `Tests  4 passed (4)`.
4. `grep -c "and(eq(clientes.id, id), eq(clientes.userId, userId))" src/lib/clientes-db.ts` → `1`.

Se no item 2 os testes continuarem passando, STOP: o teste não está exercitando o SQL.

### Passo 4: Fazer `src/lib/clientes-fns.ts` usar `clientes-db.ts`

Substitua o conteúdo de `src/lib/clientes-fns.ts` da linha 8 (primeiro
`import`) até o fim por isto. O comentário das linhas 1-7 fica como está.
`requireUser`, os validadores, as auditorias, os nomes exportados e as
mensagens não mudam; só as consultas saem dos handlers:

```ts
import { env, waitUntil } from 'cloudflare:workers'
import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'

import { getDb } from '#/db/index'
import { audit, requestMeta } from '#/lib/audit'
import { validarCliente } from '#/lib/clientes'
import { apagarCliente, criarCliente, listarClientes } from '#/lib/clientes-db'
import { getRequestSession } from '#/lib/request-session'

async function requireUser() {
  const current = await getRequestSession()
  if (!current) throw new Error('Entre na sua conta primeiro.')
  return { user: current.user, headers: getRequest().headers }
}

// As consultas (sempre filtradas pelo usuário da sessão) ficam em
// src/lib/clientes-db.ts, com teste de isolamento.
export const listClientesFn = createServerFn({ method: 'GET' }).handler(
  async () => {
    const { user } = await requireUser()
    return listarClientes(getDb(env.DB), user.id)
  },
)

export const createClienteFn = createServerFn({ method: 'POST' })
  .validator((data: unknown) => validarCliente(data))
  .handler(async ({ data }) => {
    const { user, headers } = await requireUser()
    const { id } = await criarCliente(getDb(env.DB), user.id, data)
    await audit(
      {
        action: 'cliente.created',
        actorId: user.id,
        actorEmail: user.email,
        targetType: 'cliente',
        targetId: id,
        ...requestMeta(headers),
      },
      { waitUntil },
    )
    return { id }
  })

export const deleteClienteFn = createServerFn({ method: 'POST' })
  .validator((data: { id: string }) => {
    if (typeof data?.id !== 'string' || !data.id || data.id.length > 64) {
      throw new Error('Cliente não encontrado.')
    }
    return { id: data.id }
  })
  .handler(async ({ data }) => {
    const { user, headers } = await requireUser()
    await apagarCliente(getDb(env.DB), user.id, data.id)
    await audit(
      {
        action: 'cliente.deleted',
        actorId: user.id,
        actorEmail: user.email,
        targetType: 'cliente',
        targetId: data.id,
        ...requestMeta(headers),
      },
      { waitUntil },
    )
    return { id: data.id }
  })
```

**Verificar**:

- `npx tsc --noEmit` → exit 0, sem saída (a tela `src/routes/_app/app/clientes.tsx` continua tipando).
- `grep -c "drizzle-orm" src/lib/clientes-fns.ts` → `0`
- `grep -c "userId" src/lib/clientes-fns.ts` → `0` (o filtro agora mora só em `clientes-db.ts`)
- `grep -n "export const" src/lib/clientes-fns.ts` → exatamente 3 linhas: `listClientesFn`, `createClienteFn`, `deleteClienteFn`
- `npx biome check src/lib/clientes-fns.ts src/lib/clientes-db.ts src/lib/clientes-db.test.ts` → exit 0. Se reclamar só de formatação ou ordem de imports, rode `npx biome check --write` nos MESMOS três arquivos e confira de novo.

### Passo 5: Extrair `assertCanClose` e testar as fronteiras

**5a. `src/lib/account.ts`** — insira este bloco imediatamente ANTES do
comentário `/**` que antecede `export function closeOutcome` (hoje esse
comentário começa na linha 134, com o texto `* Decide o que fazer depois do update condicional do encerramento`):

```ts
/**
 * Idade máxima da sessão para encerrar a conta: 1 hora. Mesmo valor de
 * `session.freshAge` em src/lib/auth.ts (lá em segundos, aqui em ms).
 */
export const CLOSE_SESSION_MAX_AGE_MS = 60 * 60 * 1000

/**
 * Quem pode pedir o encerramento agora? Lança erro em pt-BR (a mensagem chega
 * à tela) se não puder. Roda antes dos guards dos módulos.
 * - E-mail não confirmado: a conta pode ter sido criada no nome de outra pessoa.
 * - Sessão com mais de 1 hora (cookie esquecido ou roubado): pede login novo.
 *   É o "freshAge" feito à mão: o do Better Auth só vale para os endpoints
 *   dele (senha, e-mail), e aqui o login é por código. Exatamente 1 hora
 *   ainda passa (`>` estrito).
 */
export function assertCanClose(
  session: { createdAt: Date | string },
  user: { emailVerified: boolean },
  now: Date,
): void {
  if (!user.emailVerified) {
    throw new Error('Confirme seu e-mail antes de encerrar a conta.')
  }
  const sessionAge = now.getTime() - new Date(session.createdAt).getTime()
  if (sessionAge > CLOSE_SESSION_MAX_AGE_MS) {
    throw new Error(
      'Por segurança, entre de novo (peça um novo código) antes de encerrar a conta.',
    )
  }
}

```

(O nome é `CLOSE_SESSION_MAX_AGE_MS`, e não `FRESH_SESSION_MS`, porque
`src/lib/auth-audit-hook.ts:12` já tem um `FRESH_SESSION_MS` de 60 s com outro
significado. Não mexa naquele.)

**5b. `src/lib/account-fns.ts`** — três trocas:

1. No import de `#/lib/account` (linhas 11-16), acrescente `assertCanClose`,
   mantendo a ordem alfabética que o Biome usa:

   ```ts
   import {
     ACCOUNT_RETENTION_DAYS,
     assertCanClose,
     closeOutcome,
     collectAccountExport,
     runAccountDeletionGuards,
   } from '#/lib/account'
   ```

2. Apague as linhas 22-23 (e a linha em branco que sobrar em dobro):

   ```ts
   // Mesmo valor de `session.freshAge` em src/lib/auth.ts.
   const FRESH_SESSION_MS = 60 * 60 * 1000
   ```

3. Dentro de `closeAccountFn`, troque este bloco (hoje linhas 46-59):

   ```ts
       // Quem não confirmou o e-mail pode ter criado a conta no nome de outra pessoa.
       if (!current.user.emailVerified) {
         throw new Error('Confirme seu e-mail antes de encerrar a conta.')
       }
       // "freshAge" feito à mão: o do Better Auth só vale para os endpoints dele
       // (senha, e-mail), e aqui o login é por código. Sessão com mais de 1 hora
       // (cookie esquecido ou roubado) não encerra a conta.
       const sessionAge =
         Date.now() - new Date(current.session.createdAt).getTime()
       if (sessionAge > FRESH_SESSION_MS) {
         throw new Error(
           'Por segurança, entre de novo (peça um novo código) antes de encerrar a conta.',
         )
       }
   ```

   por:

   ```ts
       // E-mail confirmado e sessão com menos de 1 hora (src/lib/account.ts).
       assertCanClose(current.session, current.user, new Date())
   ```

   O resto da função (a partir de `const me = { id: current.user.id, ... }`)
   fica exatamente como está, inclusive o `const now = new Date()` mais abaixo.

**5c. `src/lib/account.test.ts`** — duas trocas:

1. No import de `#/lib/account` (linhas 3-20), acrescente `assertCanClose` e
   `CLOSE_SESSION_MAX_AGE_MS`. A lista fica:

   ```ts
   import {
     ACCOUNT_RETENTION_DAYS,
     AccountDeletionBlocked,
     accountPhase,
     assertCanClose,
     CLOSE_SESSION_MAX_AGE_MS,
     closeOutcome,
     collectAccountExport,
     onAccountDeletionGuard,
     onAccountExport,
     onBeforeAccountDelete,
     PURGE_REMINDER_DAY,
     purgeCutoff,
     purgeDateFor,
     reminderCutoff,
     reminderDue,
     resetAccountHandlers,
     runAccountDeletionGuards,
     runBeforeAccountDelete,
   } from '#/lib/account'
   ```

2. Acrescente no FIM do arquivo:

   ```ts

   describe('assertCanClose (quem pode pedir o encerramento)', () => {
     const now = new Date('2026-11-13T12:00:00Z')
     const sessionOf = (ageMs: number) => ({
       createdAt: new Date(now.getTime() - ageMs),
     })
     const verified = { emailVerified: true }

     it('e-mail verificado e sessão recente: pode encerrar', () => {
       expect(() => assertCanClose(sessionOf(0), verified, now)).not.toThrow()
       expect(() =>
         assertCanClose(sessionOf(59 * 60 * 1000), verified, now),
       ).not.toThrow()
     })

     it('e-mail não verificado: recusa, mesmo com sessão recém-criada', () => {
       expect(() =>
         assertCanClose(sessionOf(0), { emailVerified: false }, now),
       ).toThrow('Confirme seu e-mail antes de encerrar a conta.')
     })

     it('fronteira de 1 hora: exatamente 1 h passa, 1 ms a mais recusa', () => {
       expect(CLOSE_SESSION_MAX_AGE_MS).toBe(60 * 60 * 1000)
       expect(() =>
         assertCanClose(sessionOf(CLOSE_SESSION_MAX_AGE_MS), verified, now),
       ).not.toThrow()
       expect(() =>
         assertCanClose(sessionOf(CLOSE_SESSION_MAX_AGE_MS + 1), verified, now),
       ).toThrow('Por segurança, entre de novo')
     })

     it('aceita createdAt como texto ISO (como vem serializado)', () => {
       const createdAt = new Date(now.getTime() - CLOSE_SESSION_MAX_AGE_MS - 1)
       expect(() =>
         assertCanClose({ createdAt: createdAt.toISOString() }, verified, now),
       ).toThrow('Por segurança, entre de novo')
     })

     it('as duas falhas juntas: a do e-mail vem primeiro', () => {
       expect(() =>
         assertCanClose(
           sessionOf(CLOSE_SESSION_MAX_AGE_MS + 1),
           { emailVerified: false },
           now,
         ),
       ).toThrow('Confirme seu e-mail')
     })
   })
   ```

**Verificar**:

- `npx tsc --noEmit` → exit 0, sem saída
- `npx vitest run src/lib/account.test.ts 2>&1 | grep -E "Tests |FAIL"` → `Tests  22 passed (22)` (17 + 5)
- `grep -c "FRESH_SESSION_MS\|sessionAge" src/lib/account-fns.ts` → `0`
- `grep -c "assertCanClose(current.session, current.user, new Date())" src/lib/account-fns.ts` → `1`
- `npx biome check src/lib/account.ts src/lib/account-fns.ts src/lib/account.test.ts` → exit 0 (se for só formatação/ordem de imports, `npx biome check --write` nesses três e confira de novo)

### Passo 6: `e2e/helpers.ts` — ler o N-ésimo código do log

Em `e2e/helpers.ts`, substitua a função `readLoginCode` inteira (hoje linhas
23-45, do comentário `// Sem provedor de e-mail, ...` até o `}` que fecha a
função) por:

```ts
// Sem provedor de e-mail, o servidor de dev imprime o código no terminal; o Playwright
// redireciona essa saída para e2e/.dev.log. Lemos o arquivo até o código aparecer.
// `skip`: quantos códigos anteriores do MESMO e-mail pular (0 = o primeiro).
// Num segundo login com o mesmo e-mail, o primeiro código do log já foi usado.
export async function readLoginCode(email: string, skip = 0): Promise<string> {
  if (!fs.existsSync(logPath)) {
    throw new Error(
      'e2e/.dev.log não existe: este teste precisa que o Playwright suba o `vite dev` ' +
        '(webServer com reuseExistingServer: false). Pare qualquer servidor na porta 3000 ' +
        'e rode `npm run e2e`.',
    )
  }
  const pattern = new RegExp(
    `\\[auth\\] código de login para ${escapeRegExp(email)}: (\\d{6})`,
    'g',
  )
  const deadline = Date.now() + 15_000
  while (Date.now() < deadline) {
    const matches = [...fs.readFileSync(logPath, 'utf8').matchAll(pattern)]
    const match = matches[skip]
    if (match) return match[1]
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  throw new Error(
    `O código de login nº ${skip + 1} para ${email} não apareceu em e2e/.dev.log em 15 s.`,
  )
}
```

E troque a função `loginWithCode` (no fim do arquivo) para repassar o `skip`.
Só duas linhas mudam (a assinatura e a chamada de `readLoginCode`) e entra uma
linha de comentário:

```ts
// Faz o login por código na página /login já aberta (com ou sem ?redirect).
// `skip`: veja `readLoginCode` (use 1 no segundo login com o mesmo e-mail).
export async function loginWithCode(page: Page, email: string, skip = 0) {
  const emailInput = page.getByPlaceholder('voce@exemplo.com')
  const continuar = page.getByRole('button', { name: 'Continuar com e-mail' })

  await waitForHydration(emailInput)
  await emailInput.fill(email)
  await expect(continuar).toBeEnabled()
  await continuar.click()

  const codeInput = page.getByPlaceholder('000000')
  await expect(codeInput).toBeVisible()

  const code = await readLoginCode(email, skip)
  await codeInput.fill(code)
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
}
```

O formato da linha do log (`[auth] código de login para <email>: <código>`) NÃO
muda: quem a escreve é `src/lib/auth-otp.ts`, fora do escopo.

**Verificar**: `npx tsc --noEmit` → exit 0; `npx biome check e2e/helpers.ts` → exit 0;
`grep -c "skip" e2e/helpers.ts` → 7 ou mais.

### Passo 7: `e2e/login.spec.ts` — o e-mail encerrado não entra mais

1. Troque o comentário do topo (linhas 5-8) por:

   ```ts
   // O produto logado de ponta a ponta, com UM login só: entrar, navegar pela
   // área logada, cadastrar um cliente, trocar a foto, baixar os dados, apagar o
   // cliente, encerrar a conta e conferir que o mesmo e-mail não entra mais. Um
   // login por teste estouraria o rate limit (5 por minuto por IP nos endpoints
   // de login); a conta dos POSTs está no último teste.
   ```

2. Acrescente no FIM do arquivo (depois do teste `encerra a conta: ...`):

   ```ts

   test('conta encerrada não entra de novo: o código é aceito, mas o login é recusado', async () => {
     // Rate limit: cada login faz 2 POSTs contados em /api/auth/* (pedir o
     // código e entrar), 5 por minuto por IP. Até aqui o `npm run e2e` já fez 4
     // (guards.spec.ts + o login lá de cima); os 2 deste teste seriam o 5º e o
     // 6º. No servidor local a janela é o minuto do relógio: esperamos ele virar
     // e o contador zera. Custa até 1 minuto, uma vez só.
     test.setTimeout(150_000)
     await page.waitForTimeout(60_000 - (Date.now() % 60_000) + 2_000)

     // Pedir o código funciona (o servidor não revela que a conta foi
     // encerrada). É o segundo código deste e-mail no log: pula o primeiro.
     await page.goto('/login')
     await loginWithCode(page, email, 1)

     // Quem recusa é o hook `session.create.before` de src/lib/auth.ts
     // (ACCOUNT_CLOSED); a frase vem de src/lib/auth-failure.ts.
     await expect(
       page.getByText('Esta conta foi encerrada e será apagada em breve.'),
     ).toBeVisible()
     await expect(page).toHaveURL(/\/login$/)

     // E continua sem sessão.
     await page.goto('/app')
     await expect(page).toHaveURL(/\/login\?redirect=%2Fapp$/)
   })
   ```

   `page`, `email`, `loginWithCode`, `expect` e `test` já existem no arquivo
   (linhas 2-3 e 17-18). Não acrescente imports.

**Verificar (rápido, sem subir servidor)**:

- `npx tsc --noEmit` → exit 0
- `npx biome check e2e/login.spec.ts` → exit 0 (formatação: `npx biome check --write e2e/login.spec.ts`)
- `npx playwright test --list 2>&1 | tail -1` → `Total: 20 tests in 4 files`

**Verificar (de verdade)**: pare qualquer `npm run dev` seu e rode `npm run e2e`
(porta ocupada: `E2E_PORT=3014 E2E_PREVIEW_PORT=4184 npm run e2e`). Leva alguns
minutos (faz o build do preview) mais até 1 minuto da espera nova.
Esperado: última linha `20 passed`, e na lista a linha
`login.spec.ts ... conta encerrada não entra de novo: o código é aceito, mas o login é recusado`
com ✓.

Este passo NÃO foi executado por quem escreveu o plano (não havia permissão
para rodar o e2e). Se o teste novo falhar, leia a seção "Condições de STOP"
antes de mexer em qualquer coisa: algumas falhas aqui são ACHADOS, não erros seus.

### Passo 8: Atualizar a documentação

Trocas de texto exatas (procure a frase antiga; se não achar, STOP).

**`AGENTS.md`**

1. `Playwright (4 specs, 19 testes)` → `Playwright (4 specs, 20 testes)`
2. `` `closeOutcome` decidem a fase, o lembrete e o resultado do encerramento; sem bindings) ``
   → `` `closeOutcome` decidem a fase, o lembrete e o resultado do encerramento; `assertCanClose` recusa e-mail não verificado e sessão com mais de 1 h; sem bindings) ``
3. `` e `clientes-fns.ts` (listar, criar e apagar clientes da pessoa logada) ``
   → `` , `clientes-fns.ts` (listar, criar e apagar clientes da pessoa logada: sessão, validação e auditoria) e `clientes-db.ts` (as consultas, sempre filtradas pelo `userId`; recebem o `db`, por isso têm teste de isolamento em `clientes-db.test.ts`) ``
   (atenção: a frase antiga começa com um espaço antes de `e`; a nova começa com vírgula colada em `sem bindings)`. O resultado lido é: `` `clientes.ts` (limites e validação, sem bindings), `clientes-fns.ts` (...) e `clientes-db.ts` (...) ``.)
4. SÓ na variante B: `` `cloudflare:workers` substituído por `src/test/cloudflare-workers.ts`) ``
   (na linha do `npm run test`, seção Comandos; a mesma frase NÃO aparece em outro lugar com esse fecha-parênteses)
   → `` `cloudflare:workers` substituído por `src/test/cloudflare-workers.ts`; teste que precisa de SQL de verdade abre o D1 local em memória com `testDb()` de `src/test/d1.ts`) ``

**`e2e/README.md`**

- `baixa os dados em JSON e encerra a conta.` → `baixa os dados em JSON, encerra a conta e confere que o mesmo e-mail não entra mais (esse último teste espera o minuto do relógio virar, por causa do rate limit).`

**`.claude/skills/tela/SKILL.md`**

1. Troque

   ```
      - `src/routes/_app/app/clientes.tsx` + `src/lib/clientes-fns.ts` +
        `src/lib/clientes.ts`: a MESMA tela ligada ao banco, com apagar. É o
        exemplo completo de tudo que a seção 3 pede.
   ```

   por

   ```
      - `src/routes/_app/app/clientes.tsx` + `src/lib/clientes-fns.ts` +
        `src/lib/clientes-db.ts` + `src/lib/clientes.ts`: a MESMA tela ligada ao
        banco, com apagar. É o exemplo completo de tudo que a seção 3 pede.
   ```

2. Troque

   ```
      Confira a sessão dentro dela e filtre SEMPRE pelo `user.id` (modelo:
      `src/lib/clientes-fns.ts`). A rota chama no `loader`.
   ```

   por

   ```
      Confira a sessão dentro dela e filtre SEMPRE pelo `user.id` (modelo:
      `src/lib/clientes-fns.ts`; as consultas ficam em
      `src/lib/clientes-db.ts`, que recebe o `db` e o `userId` e tem teste de
      isolamento em `clientes-db.test.ts`). A rota chama no `loader`.
   ```

**Verificar**:

- `grep -c "20 testes" AGENTS.md` → `1`; `grep -c "19 testes" AGENTS.md` → `0`
- `grep -c "assertCanClose" AGENTS.md` → `1`; `grep -c "clientes-db.ts" AGENTS.md` → `1`
- `grep -c "não entra mais" e2e/README.md` → `1`
- `grep -c "clientes-db" .claude/skills/tela/SKILL.md` → `3`

### Passo 9: Conferência final

```sh
npm run typecheck
npm run check
npm run test 2>&1 | grep -E "Test Files|Tests |FAIL"
git status --short
```

**Verificar**:

- `npm run typecheck` → exit 0. Se ele alterar `worker-configuration.d.ts`
  (aparece em `git status` e não aparecia antes), STOP e relate: este plano não
  mexe em config.
- `npm run check` → exit 0.
- `npm run test` → nenhum `FAIL`; em relação ao Passo 0: 1 arquivo de teste a
  mais e 9 testes a mais (4 de clientes + 5 de `assertCanClose`). Vale o que
  você anotou no Passo 0 (com o plano 001 já executado, ele é maior que o de
  2026-11-13, que era 26 arquivos / 212 testes; sem o 001 o final seria
  `Test Files  27 passed (27)`, `Tests  221 passed (221)`).
- `git status --short`: comparado com antes de você começar, as ÚNICAS
  diferenças são os arquivos da lista "Dentro do escopo".

## Plano de testes

- **`src/lib/clientes-db.test.ts` (novo, 4 testes, SQL de verdade)**:
  B não lista o cliente de A; B não apaga o cliente de A (mesmo erro de id
  inexistente, e o cliente continua lá); A apaga o próprio; o 500º entra, o
  501º é recusado com a mensagem exata, e o teto de A não afeta B.
  Estrutura: um banco por arquivo (`beforeAll`), como descrito no Passo 3.
- **`src/lib/account.test.ts` (5 testes novos)**: caminho feliz; e-mail não
  verificado; fronteira de 1 h (exato passa, +1 ms recusa); `createdAt` em
  texto; ordem das recusas. Molde: o `describe('closeOutcome ...')` do mesmo arquivo.
- **`e2e/login.spec.ts` (1 teste novo)**: login completo com o e-mail encerrado
  mostra "Esta conta foi encerrada e será apagada em breve." e `/app` continua
  pedindo login.
- **Prova por mutação** (Passo 3): tirar o `eq(clientes.userId, userId)` do
  apagar faz 2 testes falharem.
- Verificação: `npm run test` (27 arquivos / 221 testes na linha de base de
  2026-11-13) e `npm run e2e` (`20 passed`).

## Critérios de pronto

Todos verificáveis por comando. TODOS têm de valer:

- [ ] `npm run typecheck` sai com 0
- [ ] `npm run check` sai com 0
- [ ] `npm run test` sai com 0, com 9 testes a mais que no Passo 0
- [ ] `npx vitest run src/lib/clientes-db.test.ts` → `Tests  4 passed (4)`
- [ ] `npx vitest run src/lib/account.test.ts` → `Tests  22 passed (22)`
- [ ] `grep -c "drizzle-orm\|userId" src/lib/clientes-fns.ts` → `0`
- [ ] `grep -c "and(eq(clientes.id, id), eq(clientes.userId, userId))" src/lib/clientes-db.ts` → `1` (a mutação do Passo 3 foi desfeita)
- [ ] `grep -c "FRESH_SESSION_MS\|sessionAge" src/lib/account-fns.ts` → `0`
- [ ] `npx playwright test --list | tail -1` → `Total: 20 tests in 4 files`
- [ ] `npm run e2e` → `20 passed`
- [ ] `git diff --stat -- src/lib/auth.ts wrangler.jsonc package.json package-lock.json vitest.config.ts playwright.config.ts` não mostra mudança feita por você (compare com o `git status` de antes de começar)
- [ ] Linha de status em `plans/README.md` atualizada (se o arquivo existir)

## Condições de STOP

Pare e relate (não improvise) se:

- Qualquer linha da "Conferência de drift" do topo não bater, ou um trecho da
  seção "Estado atual" for diferente do arquivo em disco.
- Passo 0: já existe teste falhando antes de você mexer.
- Passo 1: a tabela mandar parar (o plano 001 promete `src/test/sqlite-d1.ts` e
  o arquivo não existe), ou, na variante A, `getDb(sqliteD1().d1)` não tipar.
- Passo 1, variante B: `testDb()` falhar ao subir (erro do Wrangler/Miniflare,
  ou `import { getPlatformProxy } from 'wrangler'` não resolver). NÃO instale
  pacote novo (`better-sqlite3`, `miniflare`, etc.) nem mude `vitest.config.ts`
  para contornar: relate o erro.
- Passo 3: a prova por mutação NÃO deixar os testes vermelhos.
- Passo 4: o typecheck acusar erro em `src/routes/_app/app/clientes.tsx` (o tipo
  devolvido por `listClientesFn` mudou: não era para mudar).
- Passo 7, o teste novo falha com **"Muitas tentativas. Espere um minuto e tente de novo."**
  na tela: a conta do rate limit deste plano está errada para o seu ambiente
  (por exemplo, outro spec passou a fazer login). Relate quantos logins cada
  spec faz (`grep -c "loginWithCode(" e2e/*.spec.ts`). NÃO aumente o limite em
  `wrangler.jsonc` nem desligue o rate limit.
- Passo 7, o teste novo falha porque **a tela mostra outra mensagem** (por
  exemplo "Não deu certo. Tente de novo em instantes.") ou porque **o login
  entra e vai para `/app`**: isso NÃO é erro do teste, é um achado sobre o
  hook `ACCOUNT_CLOSED` de `src/lib/auth.ts` (o código do erro não chega ao
  navegador, ou a conta encerrada consegue entrar). NÃO afrouxe a asserção,
  NÃO mexa em `src/lib/auth.ts`: relate a mensagem vista, o status e o corpo da
  resposta de `POST /api/auth/sign-in/email-otp` (estão no trace do Playwright
  ou em `e2e/.dev.log`).
- Passo 7: `readLoginCode` estoura os 15 s esperando o segundo código: o
  servidor não enviou código para o e-mail encerrado (a premissa "pedir o código
  funciona para conta encerrada" é falsa). Relate o que apareceu em `e2e/.dev.log`.
- Passo 9: `npm run typecheck` modifica `worker-configuration.d.ts`.
- A verificação de um passo falha duas vezes depois de uma tentativa razoável de conserto.
- O conserto parece exigir mexer em arquivo fora do escopo.

## Notas de manutenção

Para quem cuidar deste código depois:

- **Consulta nova de clientes** (editar, buscar, paginar) entra em
  `src/lib/clientes-db.ts`, recebendo `db` e `userId`, com um teste "B não
  consegue" em `clientes-db.test.ts`. O handler em `clientes-fns.ts` só confere a
  sessão, valida e audita. Outra área com dados por usuário deve copiar esse
  trio (`<area>.ts`, `<area>-db.ts`, `<area>-fns.ts`); a skill `/tela` aponta para ele.
- **O teto de 500 continua "conta e depois insere"**: dois pedidos simultâneos
  podem passar do limite. Deixado de fora de propósito (é mudança de
  comportamento). Se virar regra de negócio (plano pago, cota), troque por uma
  instrução condicional única (`INSERT ... SELECT ... WHERE (SELECT count(*) ...) < 500`)
  e acrescente um teste de concorrência.
- **O hook `ACCOUNT_CLOSED` só tem teste no e2e**, que roda à mão e toda
  segunda-feira (`.github/workflows/e2e.yml`), não a cada push. Seguimento
  sugerido (não feito aqui para não mexer em `src/lib/auth.ts`): extrair o corpo
  do hook para uma função `(db, userId)` num arquivo sem Better Auth e testá-la
  com o mesmo banco de teste do `clientes-db.test.ts`.
- **A espera de até 1 minuto no e2e** depende de um detalhe do servidor LOCAL
  (janela fixa alinhada ao relógio no Miniflare). Se o `npm run e2e` passar a
  rodar contra outro ambiente, ou se outro spec ganhar um login, refaça a conta
  do item 3 de "Fatos conferidos". Mudar `session.freshAge` em `src/lib/auth.ts`
  exige mudar `CLOSE_SESSION_MAX_AGE_MS` em `src/lib/account.ts` junto (o teste
  da fronteira fixa o valor em 1 hora).
- **Harness único**: o caminho normal é a variante A (o `sqliteD1()` do plano
  001). A variante B (`src/test/d1.ts`, com `getPlatformProxy` do Wrangler,
  que lê o `wrangler.jsonc` e o `.dev.vars` se existir, sem imprimir nada dele)
  só existe para o caso de o 001 ser abandonado. Nunca fiquem os dois em
  `src/test/`: os testes de clientes só precisam de um `getDb(...)` sobre um
  banco migrado.
- **O que o revisor deve olhar**: (1) o diff de `clientes-fns.ts` tem de ser só
  "consulta saiu, chamada entrou", com as mesmas mensagens de erro e as mesmas
  auditorias; (2) `assertCanClose` mantém `>` estrito e a ordem e-mail antes de
  sessão; (3) nenhum arquivo fora do escopo no diff; (4) o resultado do
  `npm run e2e` colado no relato, já que esse passo não foi rodado por quem planejou.
