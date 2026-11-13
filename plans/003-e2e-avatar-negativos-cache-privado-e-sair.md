# Plano 003: E2E dos caminhos de recusa do avatar, do cache privado logado e do botão Sair

> **Instruções para quem executa**: siga o plano passo a passo. Rode cada
> comando de verificação e confirme o resultado esperado antes de ir para o
> próximo passo. Se acontecer qualquer item da seção "Condições de STOP", pare
> e relate: não improvise. Ao terminar, se existir `plans/README.md`, atualize
> a linha deste plano (se não existir, não crie).
>
> **Conferência de drift (rode primeiro)**: este plano foi escrito contra o
> commit `bb7333e` MAIS mudanças ainda não commitadas na árvore de trabalho.
> Por isso o `git diff` sozinho não basta. Rode os dois comandos:
>
> ```bash
> git diff --stat bb7333e..HEAD -- e2e playwright.config.ts AGENTS.md README.md src/routes/api src/lib/avatar.ts src/lib/rate-limit.ts src/lib/same-origin.ts src/lib/security-headers.ts src/db/d1-session.ts src/server.ts src/routes/_app.tsx src/integrations/better-auth/header-user.tsx
> shasum -a 1 e2e/login.spec.ts e2e/helpers.ts playwright.config.ts src/routes/api/avatar.ts 'src/routes/api/avatar.$userId.ts' src/lib/avatar.ts src/lib/rate-limit.ts src/lib/same-origin.ts src/lib/security-headers.ts src/db/d1-session.ts src/server.ts src/routes/_app.tsx src/integrations/better-auth/header-user.tsx | cut -c1-12,41-
> ```
>
> Saída esperada do `shasum` (os 12 primeiros caracteres de cada hash):
>
> ```
> b6dfe7fbf816  e2e/login.spec.ts
> 145dd21281fb  e2e/helpers.ts
> 982f3b3a1e35  playwright.config.ts
> f06cf54d821f  src/routes/api/avatar.ts
> d903ecb64243  src/routes/api/avatar.$userId.ts
> 65caec115bc2  src/lib/avatar.ts
> 9a44f286be82  src/lib/rate-limit.ts
> 59c5ecc46eba  src/lib/same-origin.ts
> d90970e60ffb  src/lib/security-headers.ts
> aab3751bf97b  src/db/d1-session.ts
> 91c8aa68c119  src/server.ts
> c8fdf5080852  src/routes/_app.tsx
> c5a915b6ef0c  src/integrations/better-auth/header-user.tsx
> ```
>
> Hash diferente em algum arquivo: compare os trechos da seção "Estado atual"
> com o arquivo de verdade. Se o trecho citado ainda bate (mesmo status, mesma
> mensagem, mesma ordem), siga. Se não bate, é condição de STOP.

## Status

- **Prioridade**: P2
- **Esforço**: M
- **Risco**: LOW (só testes e três linhas de documentação; nenhum código de `src/` muda)
- **Depende de**: nenhum
- **Categoria**: tests
- **Planejado em**: commit `bb7333e` + árvore de trabalho de 2026-11-13; confira o drift pelos trechos citados (e pelos hashes acima)

## Por que isso importa

O envio da foto de perfil (`POST /api/avatar`) tem sete recusas em fila, e a
ORDEM delas é uma decisão de segurança: outro site é barrado antes de olhar a
sessão, quem não está logado não gasta a cota de ninguém, e o corpo só é lido
depois de tudo isso. Hoje o Playwright só testa o envio que dá certo. Se alguém
trocar duas checagens de lugar, ou apagar uma, nenhum teste falha.

O mesmo vale para três outras promessas do `AGENTS.md` que só têm teste de
unidade (ou nenhum): as respostas de `/app` logado e das server functions saem
com `Cache-Control: no-store`; o cookie `d1-bookmark` volta depois de uma
escrita; e o botão "Sair" (são dois, em telas diferentes) encerra a sessão de
verdade. Este plano acrescenta testes Playwright para tudo isso, sem estourar o
rate limit do login nem o do avatar (os dois são 5 por minuto por IP).

## Estado atual

Todos os fatos abaixo foram lidos nos arquivos em disco em 2026-11-13.

### Arquivos e papel de cada um

- `src/routes/api/avatar.ts` — `POST /api/avatar` (troca a foto). As recusas, na ordem.
- `src/routes/api/avatar.$userId.ts` — `GET /api/avatar/<userId>` (serve a foto, público).
- `src/lib/avatar.ts` — limites e validação (`AVATAR_MAX_BYTES`, `checkAvatarFile`, `detectImageType`, `isValidUserId`).
- `src/lib/rate-limit.ts` — `isRateLimited(scope, { headers })` e `tooManyRequests()`.
- `src/lib/same-origin.ts` — `isCrossSiteRequest(request)`.
- `src/lib/security-headers.ts` — `withSecurityHeaders`: põe `Cache-Control: no-store` nas respostas privadas.
- `src/db/d1-session.ts` — `withD1Bookmark`: põe o cookie `d1-bookmark` na resposta.
- `src/server.ts` — entry do Worker; aplica os dois acima em toda resposta.
- `src/routes/_app.tsx` — casca da área logada; o "Sair" da barra lateral.
- `src/integrations/better-auth/header-user.tsx` — menu da conta no cabeçalho público; o outro "Sair".
- `e2e/login.spec.ts` — o spec serial logado (um login só). É onde entram os testes de avatar e de cache.
- `e2e/helpers.ts` — `devPort`, `readLoginCode`, `waitForHydration`, `loginWithCode`.
- `e2e/security-headers.spec.ts` — cabeçalhos de segurança, só em respostas anônimas (`/`, `/login`, `/app` sem sessão, `/api/auth/ok`) e nos estáticos.

### A fila de recusas do `POST /api/avatar` (`src/routes/api/avatar.ts:30-67`)

```ts
      POST: async ({ request }) => {
        if (isCrossSiteRequest(request)) {
          return text('Requisição cross-site recusada.', 403)
        }
        // `disableCookieCache`: escrita em nome do usuário, lê a sessão no banco.
        const session = await getAuth(env, request).api.getSession({
          headers: request.headers,
          query: { disableCookieCache: true },
        })
        if (!session) return text('Entre na sua conta primeiro.', 401)
        // Depois da sessão: um anônimo não consegue gastar a cota de alguém.
        if (await isRateLimited('avatar', { headers: request.headers })) {
          return tooManyRequests()
        }
        const lengthHeader = request.headers.get('content-length')
        if (lengthHeader === null) {
          return text('Envie o tamanho do arquivo (Content-Length).', 411)
        }
        const length = Number(lengthHeader)
        if (!Number.isFinite(length) || length > AVATAR_MAX_BYTES + 64 * 1024) {
          return text('A imagem precisa ter no máximo 2 MB.', 413)
        }

        const form = await request.formData().catch(() => null)
        const file = form?.get('file')
        if (!(file instanceof File)) {
          return text('Envie a imagem no campo "file".', 400)
        }
        const problem = checkAvatarFile(file)
        if (problem) return text(problem.message, problem.status)
        const bytes = new Uint8Array(await file.arrayBuffer())
        // O tipo vem dos bytes, não do que o navegador declarou.
        const type = detectImageType(bytes)
        if (!type) return text('Use uma imagem PNG, JPEG ou WebP.', 415)
```

Resumo da ordem, com status e texto exato da resposta:

| # | Checagem | Status | Corpo (texto puro) | Gasta a cota do rate limit? |
|---|----------|--------|--------------------|------------------------------|
| 1 | veio de outro site (`Sec-Fetch-Site` ou `Origin`) | 403 | `Requisição cross-site recusada.` | não |
| 2 | sem sessão | 401 | `Entre na sua conta primeiro.` | não |
| 3 | rate limit, escopo `avatar`, por IP | 429 | `Muitas requisições. Tente de novo em um minuto.` + cabeçalho `retry-after: 60` | (é ele) |
| 4 | sem `Content-Length` | 411 | `Envie o tamanho do arquivo (Content-Length).` | sim |
| 5 | `Content-Length` acima de 2 MB + 64 KB | 413 | `A imagem precisa ter no máximo 2 MB.` | sim |
| 6 | multipart sem o campo `file` | 400 | `Envie a imagem no campo "file".` | sim |
| 7 | `checkAvatarFile`: tipo declarado fora da lista (415), arquivo vazio (400, `O arquivo está vazio.`), arquivo acima de 2 MB (413) | 415/400/413 | ver `src/lib/avatar.ts:30-42` | sim |
| 8 | os primeiros bytes não são PNG/JPEG/WebP | 415 | `Use uma imagem PNG, JPEG ou WebP.` | sim |

Todo pedido que passa da linha 2 gasta 1 da cota de **5 por minuto** da chave
`avatar:<ip>` (`wrangler.jsonc`: `"simple": { "limit": 5, "period": 60 }`).

### O `GET /api/avatar/<userId>` (`src/routes/api/avatar.$userId.ts:14-35`)

```ts
      GET: async ({ request, params }) => {
        if (!isValidUserId(params.userId)) {
          return new Response('Não encontrado.', { status: 404 })
        }
        const object = await env.BUCKET.get(avatarKey(params.userId), {
          onlyIf: request.headers,
        })
        if (!object) return new Response('Não encontrado.', { status: 404 })
        const headers = new Headers({
          'Cache-Control': new URL(request.url).searchParams.has('v')
            ? 'public, max-age=31536000, immutable'
            : 'public, max-age=300',
          'Content-Security-Policy': 'sandbox',
          'X-Content-Type-Options': 'nosniff',
          ETag: object.httpEtag,
          'Content-Type':
            object.httpMetadata?.contentType ?? 'application/octet-stream',
        })
        // Com `onlyIf`, o R2 devolve o objeto sem corpo quando o ETag bate.
        if (!('body' in object))
          return new Response(null, { status: 304, headers })
        return new Response(object.body, { headers })
      },
```

Id válido é `^[A-Za-z0-9_-]{1,64}$` (`src/lib/avatar.ts:14`). Então `aaaa…` com
65 letras e `abc~def` são inválidos (404 sem ir ao R2).

### O IP do rate limit e o truque do IP de teste

`src/lib/rate-limit.ts:48-53`:

```ts
export function clientIp(headers?: Headers): string {
  const ip =
    headers?.get('cf-connecting-ip') ??
    headers?.get('x-forwarded-for')?.split(',')[0]?.trim()
  return ip ? normalizeIp(ip) : 'unknown'
}
```

Em produção a borda da Cloudflare sobrescreve o `cf-connecting-ip`. Em
`localhost` não há borda: o servidor de dev só preenche o cabeçalho quando ele
NÃO veio no pedido (conferido em
`node_modules/miniflare/dist/src/workers/core/entry.worker.js`:
`clientIp && !request.headers.get("CF-Connecting-IP")`). Ou seja, em localhost
um teste pode mandar o próprio `cf-connecting-ip` e ganhar um balde de rate
limit só dele. O repositório já usa esse truque no teste de carga
(`load/config.js`):

```js
export function ipDeTeste(a, b) {
  return isLocal() ? { 'cf-connecting-ip': `10.${a % 250}.${b % 250}.7` } : {}
}
```

O limitador local conta por janela do relógio (minuto cheio: `epoch =
Math.floor(Date.now() / 60000)`), não por 60 s corridos. Seis pedidos seguidos
podem cair em dois minutos diferentes; o teste do 429 precisa aguentar isso.

O login também é limitado: todo POST em `/api/auth/*` (menos `/sign-out` e
`/get-session`) gasta 1 da chave `auth:<ip>` (`src/lib/auth-rate-limit.ts:74`).
Um login são 2 POSTs. Hoje a suíte faz 2 logins (4 POSTs). Um terceiro login no
mesmo IP e no mesmo minuto estouraria: por isso os testes novos de "Sair" fazem
o login com um IP de teste próprio.

### Cache privado e bookmark

`src/lib/security-headers.ts:21-31` e `42-44`:

```ts
const PRIVATE_PATH = /^\/(?:app(?:\/|$)|_serverFn\/)/

function isPrivateResponse(res: Response, req: Request): boolean {
  if (!PRIVATE_PATH.test(new URL(req.url).pathname)) return false
  // Server functions devolvem JSON/stream; as páginas, HTML. Os dois valem.
  const type = res.headers.get('content-type') ?? ''
  return (
    new URL(req.url).pathname.startsWith('/_serverFn/') ||
    type.includes('text/html')
  )
}
...
  if (!headers.has('Cache-Control') && isPrivateResponse(res, req)) {
    headers.set('Cache-Control', 'no-store')
  }
```

`src/db/d1-session.ts:41-44` (o formato exato do cookie; `Secure` só em https):

```ts
export function bookmarkCookie(bookmark: string, request: Request): string {
  const secure = new URL(request.url).protocol === 'https:'
  return `${D1_BOOKMARK_COOKIE}=${bookmark}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${BOOKMARK_MAX_AGE}${secure ? '; Secure' : ''}`
}
```

`D1_BOOKMARK_COOKIE` é `'d1-bookmark'` e `BOOKMARK_MAX_AGE` é `3600`. O
bookmark é hexadecimal com hífens. `src/server.ts:52` aplica os dois em toda
resposta: `return withSecurityHeaders(withD1Bookmark(res, session, request), request)`.

Criar um cliente em `/app/clientes` chama `createClienteFn`
(`src/lib/clientes-fns.ts:43`, `createServerFn({ method: 'POST' })`), ou seja,
um `POST /_serverFn/...` que escreve no D1. O formulário valida no navegador
antes (`src/routes/_app/app/clientes.tsx:215`), então o clique com o formulário
vazio NÃO dispara pedido.

### Os dois botões "Sair"

`src/routes/_app.tsx:90-95` e `109-118` (barra lateral da área logada):

```tsx
  const [leaving, setLeaving] = useState(false)
  async function leave() {
    setLeaving(true)
    await authClient.signOut()
    window.location.assign('/')
  }
...
      <Button
        variant="ghost"
        size="icon"
        aria-label="Sair"
        title="Sair"
        disabled={leaving}
        onClick={() => void leave()}
      >
```

`src/integrations/better-auth/header-user.tsx:17-21`, `40-42` e `62-68`
(cabeçalho público; o cliente do Better Auth só é carregado no clique):

```tsx
async function signOut() {
  const { authClient } = await import('#/lib/auth-client')
  await authClient.signOut()
  window.location.assign('/')
}
...
        <DropdownMenuTrigger
          aria-label="Abrir menu da conta"
...
          <DropdownMenuItem
            onSelect={() => {
              void signOut()
            }}
          >
            Sair
          </DropdownMenuItem>
```

Sem sessão, o mesmo componente mostra o link `Entrar` (`header-user.tsx:74-78`).
O cabeçalho público NÃO aparece dentro de `/app` (`src/routes/__root.tsx`
esconde quando a rota `/_app` está ativa): para ver o menu da conta é preciso
ir para `/` logado.

### Correções ao achado que originou este plano

- O achado dizia que "encerrar conta" não tinha teste de saída. **Tem**:
  `e2e/login.spec.ts:147-158` já confere que a pessoa cai em `/` e que `/app`
  volta a pedir login. Este plano só acrescenta uma linha ali (o cabeçalho
  mostra `Entrar`). Os caminhos realmente sem teste são dois: barra lateral e
  cabeçalho público.
- O 413 tem DUAS origens (o `Content-Length`, linha 5 da tabela, e o tamanho do
  arquivo em `checkAvatarFile`, linha 7), com a mesma mensagem. O 415 e o 400
  também têm duas origens cada. Este plano testa o 413 pelo tamanho do arquivo
  (o corpo é lido inteiro, então o teste é estável); o 413 do `Content-Length`
  fica sem E2E (veja "Notas de manutenção").
- O cookie `d1-bookmark` não sai só "depois de uma escrita": sai em toda
  resposta cujo pedido foi ao D1 (`withD1Bookmark` só olha `getBookmark()`).
  O teste confere na resposta de uma escrita, que é o caso que importa.
- `e2e/security-headers.spec.ts` olha quatro caminhos anônimos (`/`, `/login`,
  `/app`, `/api/auth/ok`), não só `/app`. O ponto do achado continua certo:
  nada ali está logado.
- O `no-store` de `/app` só vale para resposta HTML: o redirect do `/app`
  anônimo não leva o cabeçalho, e isso é o comportamento esperado.
- Contagem atual: `npx playwright test --list` mostra `Total: 19 tests in 4 files`.

### Convenções do repositório que valem aqui

- Testes e comentários em pt-BR, simples e diretos. Localizadores por papel,
  rótulo ou placeholder (`e2e/README.md`, seção "Convenções").
- Biome: 2 espaços, aspas simples, sem ponto e vírgula, vírgula no fim.
- O spec logado é serial e usa UMA página guardada numa variável do módulo.
  Trecho exemplar, `e2e/login.spec.ts:9-26` e `93-114`. Siga este molde:

```ts
test.describe.configure({ mode: 'serial' })

// PNG 1x1 válido (os primeiros bytes são conferidos pelo servidor).
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==',
  'base64',
)

let page: Page
const email = `e2e-${Date.now()}@exemplo.test`

test.beforeAll(async ({ browser }) => {
  page = await browser.newPage()
})
...
test('troca a foto de perfil (R2)', async () => {
  const input = page.getByLabel('Foto de perfil')
  await waitForHydration(page.getByLabel('Nome'))
  await input.setInputFiles({
    name: 'foto.png',
    mimeType: 'image/png',
    buffer: PNG,
  })
  await page.getByRole('button', { name: 'Salvar foto' }).click()
  await expect(page.getByText('Foto atualizada')).toBeVisible()

  // A URL nova aponta para /api/avatar/<id>?v=..., e a imagem carrega.
  const src = await page
    .locator('img[src*="/api/avatar/"]')
    .first()
    .getAttribute('src')
  expect(src).toMatch(/^\/api\/avatar\/[\w-]+\?v=\d+$/)
  const res = await page.request.get(src ?? '')
  expect(res.status()).toBe(200)
  expect(res.headers()['content-type']).toBe('image/png')
  expect(res.headers().etag).toBeTruthy()
})
```

- `page.request` usa os cookies da página (está logado). O fixture `request`
  do Playwright é um visitante novo, sem cookie (anônimo).
- Em modo serial, se um teste falha os seguintes não rodam ("did not run").
- `waitForHydration(locator)` (`e2e/helpers.ts:50`) espera o React assumir o
  elemento. Use antes do primeiro clique numa página recém-carregada.

## Comandos que você vai usar

| Para quê | Comando | Esperado |
|----------|---------|----------|
| Typecheck | `npm run typecheck` | exit 0, sem erros |
| Lint/format (só confere) | `npm run check` | exit 0 (`No fixes applied`) |
| Formatar SÓ os arquivos do plano | `npx biome check --write e2e/helpers.ts e2e/login.spec.ts e2e/sair.spec.ts` | exit 0 |
| Unidades | `npm run test` | todos passam |
| Listar os testes E2E (não sobe servidor) | `npx playwright test --list \| tail -1` | `Total: N tests in M files` |
| E2E de um arquivo | `npx playwright test e2e/login.spec.ts` | `N passed` |
| E2E inteiro | `npm run e2e` | todos passam |

Notas sobre o E2E:

- O Playwright sobe dois servidores sozinho (`vite dev` na 3000 e
  `npm run preview` na 4173, que faz o build: leva 1 a 3 minutos) e NÃO
  reaproveita servidor aberto. Porta ocupada? Use
  `E2E_PORT=3014 E2E_PREVIEW_PORT=4184` na frente de qualquer comando do
  Playwright, por exemplo
  `E2E_PORT=3014 E2E_PREVIEW_PORT=4184 npx playwright test e2e/login.spec.ts`.
- Precisa existir `.dev.vars` na raiz (não versionado; contém um segredo de
  sessão). NÃO abra, NÃO copie e NÃO cite o conteúdo dele. Se não existir, é
  condição de STOP.
- Primeira vez na máquina: `npx playwright install chromium`.
- NÃO rode `npm run check:fix` (formataria arquivos fora do escopo).

## Escopo

**Dentro do escopo** (os únicos arquivos que você pode modificar):

- `e2e/helpers.ts` (acrescentar `testIp`)
- `e2e/login.spec.ts` (acrescentar testes e três trechos pequenos em testes existentes)
- `e2e/sair.spec.ts` (criar)
- `e2e/README.md` (lista de arquivos e uma convenção)
- `AGENTS.md` (só a contagem `4 specs, 19 testes`, na linha do `npm run e2e`)
- `README.md` (só `Playwright (4 specs)`, na tabela)
- `plans/README.md` (só a linha deste plano, e só se o arquivo existir)

**Fora do escopo** (NÃO mexa, mesmo parecendo relacionado):

- Qualquer arquivo em `src/`. Este plano só acrescenta testes. Se um teste novo
  falhar porque o app se comporta diferente do descrito aqui, isso é um achado
  para relatar, não para "consertar" no app nem no teste.
- `playwright.config.ts`, `e2e/guards.spec.ts`, `e2e/security-headers.spec.ts`,
  `e2e/marketing.spec.ts`, `e2e/global-setup.ts`.
- `wrangler.jsonc` (não aumente o limite do rate limit para o teste passar).
- `.dev.vars` e `.dev.vars.example`.
- Os outros arquivos já modificados na árvore de trabalho (há dezenas de
  mudanças não commitadas de outra tarefa): não reverta, não formate, não
  faça stash.

## Git

- A árvore de trabalho já tem mudanças não commitadas de outra tarefa, inclusive
  em `AGENTS.md`, `README.md` e `e2e/README.md`. **NÃO faça commit, não crie
  branch, não faça stash e não faça push**, a menos que o operador peça.
- Se o operador pedir commit: `git add` só dos arquivos do escopo, uma mensagem
  em pt-BR no estilo do repositório (exemplos do `git log`:
  `Deploy: passo final de medir a performance`,
  `Web perf: checklist no HTML do servidor e JS principal 21% menor`).
  Sugestão: `E2E: recusas do avatar, cache privado logado e botão Sair`.

## Passos

### Passo 0: linha de base

Rode, sem mudar nada:

```bash
npx playwright test --list | tail -1
npm run e2e
```

**Verificação**: a primeira linha imprime `Total: 19 tests in 4 files`; o
`npm run e2e` termina com `19 passed`. Se a linha de base falhar, STOP (o
problema não é deste plano).

### Passo 1: `testIp()` em `e2e/helpers.ts`

Acrescente no fim de `e2e/helpers.ts`:

```ts
// IP de teste para o cabeçalho `cf-connecting-ip`. Só funciona em localhost:
// sem a borda da Cloudflare na frente, o app confia no cabeçalho (o mesmo
// truque do teste de carga, load/config.js). Cada chamada devolve um IP novo,
// ou seja, um balde novo do rate limit (5 por minuto por IP e por escopo).
export function testIp(): string {
  const octet = () => 1 + Math.floor(Math.random() * 250)
  return `10.${octet()}.${octet()}.${octet()}`
}
```

**Verificação**: `npm run typecheck` → exit 0. `npx biome check e2e/helpers.ts` → exit 0.

### Passo 2: guardar a URL e o ETag da foto, e testar o `GET` público

Tudo em `e2e/login.spec.ts`.

2a. Troque a linha de import dos helpers e a do Playwright (linhas 2-3) por:

```ts
import { type APIResponse, expect, type Page, test } from '@playwright/test'
import { loginWithCode, testIp, waitForHydration } from './helpers'
```

(`APIResponse` e `testIp` só serão usados nos passos 4 e 5. Até lá o
`npm run check` acusa import sem uso: tudo bem, rode o `check` só no passo 5.)

2b. Logo abaixo de `const email = ...` (linha 18), acrescente:

```ts
// Preenchidos em "troca a foto de perfil" e usados pelos testes de avatar.
let avatarSrc = ''
let avatarEtag = ''

// Igual a AVATAR_MAX_BYTES em src/lib/avatar.ts.
const AVATAR_MAX_BYTES = 2 * 1024 * 1024
const fotoValida = { name: 'foto.png', mimeType: 'image/png', buffer: PNG }
```

2c. No fim do teste `troca a foto de perfil (R2)`, depois de
`expect(res.headers().etag).toBeTruthy()`, acrescente:

```ts
  avatarSrc = src ?? ''
  avatarEtag = res.headers().etag ?? ''
```

2d. Logo DEPOIS do teste `troca a foto de perfil (R2)` e ANTES de
`baixa os dados da conta em JSON`, acrescente o teste abaixo. (Todos os testes
novos dos passos 2 a 6 entram nesse mesmo ponto, um depois do outro, nessa
ordem. Eles só usam `page.request`, não navegam: a página continua em
`/app/configuracoes`, que é onde o teste `baixa os dados` espera estar.)

```ts
test('avatar: GET público responde 404, 304 e os cabeçalhos de cache', async () => {
  // Com `?v=`: cache longo e imutável; CSP sandbox e nosniff sempre.
  const comVersao = await page.request.get(avatarSrc)
  expect(comVersao.status()).toBe(200)
  expect(comVersao.headers()['cache-control']).toBe(
    'public, max-age=31536000, immutable',
  )
  expect(comVersao.headers()['content-security-policy']).toBe('sandbox')
  expect(comVersao.headers()['x-content-type-options']).toBe('nosniff')

  // Sem `?v=` a URL não muda quando a foto muda: cache curto.
  const semVersao = await page.request.get(avatarSrc.split('?')[0] ?? '')
  expect(semVersao.status()).toBe(200)
  expect(semVersao.headers()['cache-control']).toBe('public, max-age=300')

  // Quem já tem a foto manda o ETag e recebe 304, sem corpo.
  const naoMudou = await page.request.get(avatarSrc, {
    headers: { 'if-none-match': avatarEtag },
  })
  expect(naoMudou.status()).toBe(304)
  expect((await naoMudou.body()).length).toBe(0)
  expect(naoMudou.headers().etag).toBe(avatarEtag)

  // Id fora do formato (65 letras, caractere proibido) e id sem foto: 404.
  for (const id of ['a'.repeat(65), 'abc~def', 'ninguem-com-este-id']) {
    const res = await page.request.get(`/api/avatar/${id}`)
    expect(res.status(), id).toBe(404)
  }
})
```

**Verificação**: `npx playwright test e2e/login.spec.ts` → `8 passed`.

### Passo 3: 403 (outro site) e 401 (sem sessão), antes de ler o corpo

Acrescente depois do teste do passo 2:

```ts
test('avatar: POST recusa outro site (403) e visitante sem sessão (401) antes de ler o corpo', async ({
  request,
}) => {
  // `page.request` leva os cookies da sessão; `request` é um visitante anônimo.
  // O 403 vem antes de tudo: mesmo logado e com um arquivo válido.
  const outroSite = await page.request.post('/api/avatar', {
    headers: { origin: 'https://outro-site.example' },
    multipart: { file: fotoValida },
  })
  expect(outroSite.status()).toBe(403)
  expect(await outroSite.text()).toBe('Requisição cross-site recusada.')

  const secFetch = await page.request.post('/api/avatar', {
    headers: { 'sec-fetch-site': 'cross-site' },
    multipart: { file: fotoValida },
  })
  expect(secFetch.status()).toBe(403)

  // 403 antes do 401: anônimo vindo de outro site.
  const anonimoOutroSite = await request.post('/api/avatar', {
    headers: { origin: 'https://outro-site.example' },
    multipart: { outro: 'x' },
  })
  expect(anonimoOutroSite.status()).toBe(403)

  // 401 antes do 400: anônimo, e o corpo nem tem o campo `file`.
  const anonimo = await request.post('/api/avatar', {
    multipart: { outro: 'x' },
  })
  expect(anonimo.status()).toBe(401)
  expect(await anonimo.text()).toBe('Entre na sua conta primeiro.')
})
```

Nenhum desses quatro pedidos gasta a cota do rate limit (são recusados antes).

**Verificação**: `npx playwright test e2e/login.spec.ts` → `9 passed`.

### Passo 4: 400, 415 e 413 logado, com IP de teste

Acrescente depois do teste do passo 3:

```ts
test('avatar: POST logado recusa corpo sem `file` (400), bytes que não são imagem (415) e arquivo grande (413)', async () => {
  // Estes pedidos passam da sessão e gastam a cota de 5 por minuto do escopo
  // `avatar`. Com um IP de teste, o balde é só deste teste.
  const headers = { 'cf-connecting-ip': testIp() }

  const semArquivo = await page.request.post('/api/avatar', {
    headers,
    multipart: { outro: 'x' },
  })
  expect(semArquivo.status()).toBe(400)
  expect(await semArquivo.text()).toBe('Envie a imagem no campo "file".')

  // Diz que é PNG, mas os bytes são texto: o tipo vem dos bytes.
  const naoEImagem = await page.request.post('/api/avatar', {
    headers,
    multipart: {
      file: {
        name: 'foto.png',
        mimeType: 'image/png',
        buffer: Buffer.from('isto não é uma imagem'),
      },
    },
  })
  expect(naoEImagem.status()).toBe(415)
  expect(await naoEImagem.text()).toBe('Use uma imagem PNG, JPEG ou WebP.')

  // 1 byte acima do limite (e começa como um PNG de verdade).
  const pesado = await page.request.post('/api/avatar', {
    headers,
    multipart: {
      file: {
        name: 'grande.png',
        mimeType: 'image/png',
        buffer: Buffer.concat([
          PNG,
          Buffer.alloc(AVATAR_MAX_BYTES + 1 - PNG.length),
        ]),
      },
    },
  })
  expect(pesado.status()).toBe(413)
  expect(await pesado.text()).toBe('A imagem precisa ter no máximo 2 MB.')

  // Nenhuma recusa trocou a foto: o ETag continua o mesmo.
  const atual = await page.request.get(avatarSrc)
  expect(atual.headers().etag).toBe(avatarEtag)
})
```

**Verificação**: `npx playwright test e2e/login.spec.ts` → `10 passed`.

### Passo 5: 429 no 6º pedido do mesmo IP

Acrescente depois do teste do passo 4:

```ts
test('avatar: o 6º POST do mesmo IP em um minuto recebe 429, antes de ler o corpo', async () => {
  const headers = { 'cf-connecting-ip': testIp() }
  const statuses: number[] = []
  let recusa: APIResponse | undefined
  // A janela do limitador vira no minuto do relógio: se a virada cair no meio,
  // o 429 chega um pouco depois do 6º pedido. Com 11 pedidos, sempre chega.
  for (let i = 0; i < 11 && !recusa; i++) {
    const res = await page.request.post('/api/avatar', {
      headers,
      multipart: { outro: 'x' },
    })
    statuses.push(res.status())
    if (res.status() === 429) recusa = res
  }
  const recebidos = `status recebidos: ${statuses.join(', ')}`
  expect(recusa, recebidos).toBeDefined()
  // IP novo = balde vazio: os 5 primeiros passam do limite e caem no 400
  // (corpo sem `file`). O mesmo corpo, estourada a cota, recebe 429.
  expect(statuses.slice(0, 5), recebidos).toEqual([400, 400, 400, 400, 400])
  expect(
    statuses.slice(0, -1).every((status) => status === 400),
    recebidos,
  ).toBe(true)
  expect(recusa?.headers()['retry-after']).toBe('60')
  expect(await recusa?.text()).toBe(
    'Muitas requisições. Tente de novo em um minuto.',
  )
})
```

Este teste também prova que o IP de teste está valendo: se o cabeçalho
`cf-connecting-ip` não chegasse ao app, o balde seria o mesmo dos passos
anteriores e o 429 viria ANTES do 6º pedido (a asserção dos 5 primeiros
falharia). Se isso acontecer, é condição de STOP.

**Verificação**:

```bash
npx biome check --write e2e/helpers.ts e2e/login.spec.ts
npm run check
npx playwright test e2e/login.spec.ts
```

→ `npm run check` exit 0; Playwright `11 passed`.

### Passo 6: `no-store` em `/app` logado e na server function; `d1-bookmark` depois da escrita

6a. Acrescente depois do teste do passo 5 (ainda antes de `baixa os dados`):

```ts
test('área logada: o HTML de /app sai com Cache-Control: no-store', async () => {
  for (const path of ['/app', '/app/clientes', '/app/configuracoes']) {
    const res = await page.request.get(path, { maxRedirects: 0 })
    expect(res.status(), path).toBe(200)
    expect(res.headers()['content-type'], path).toContain('text/html')
    expect(res.headers()['cache-control'], path).toBe('no-store')
  }
})
```

6b. No teste EXISTENTE `clientes: lista vazia, cria um cliente e ele aparece na tabela`,
troque este trecho:

```ts
  await dialog.getByLabel('Nome').fill('Cliente E2E')
  await dialog.getByLabel('E-mail').fill('cliente-e2e@exemplo.test')
  await dialog.getByRole('button', { name: 'Adicionar' }).click()
```

por:

```ts
  await dialog.getByLabel('Nome').fill('Cliente E2E')
  await dialog.getByLabel('E-mail').fill('cliente-e2e@exemplo.test')
  // Criar é uma server function que escreve no D1 (POST /_serverFn/...): a
  // resposta é privada (no-store) e traz o bookmark do D1 no cookie, para a
  // próxima página ler a própria escrita (src/db/d1-session.ts).
  const escrita = page.waitForResponse(
    (res) =>
      res.url().includes('/_serverFn/') && res.request().method() === 'POST',
  )
  await dialog.getByRole('button', { name: 'Adicionar' }).click()
  const resposta = await escrita
  expect(resposta.status()).toBe(200)
  expect(await resposta.headerValue('cache-control')).toBe('no-store')
  const cookies = await resposta.headerValues('set-cookie')
  expect(cookies.find((cookie) => cookie.startsWith('d1-bookmark='))).toMatch(
    /^d1-bookmark=[0-9a-f-]+; Path=\/; HttpOnly; SameSite=Lax; Max-Age=3600$/i,
  )
```

Atenção: há DOIS cliques em `Adicionar` nesse teste. O primeiro (formulário
vazio, mostra `Escreva o nome do cliente.`) fica como está: ele não dispara
pedido. O trecho acima substitui só o SEGUNDO clique. As duas linhas `expect`
que vêm depois (`Cliente adicionado` e a linha da tabela) ficam como estão.

6c. No teste EXISTENTE `encerra a conta: sai na hora e /app volta a pedir login`,
logo depois de `await expect(page).toHaveURL(/\/$/)`, acrescente:

```ts
  // De volta ao site público, o cabeçalho oferece entrar de novo.
  await expect(
    page.getByRole('banner').getByRole('link', { name: 'Entrar', exact: true }),
  ).toBeVisible()
```

**Verificação**:

```bash
npx biome check --write e2e/login.spec.ts
npx playwright test e2e/login.spec.ts
```

→ `12 passed`.

### Passo 7: `e2e/sair.spec.ts` (os dois botões "Sair")

Crie `e2e/sair.spec.ts` com exatamente este conteúdo:

```ts
import { expect, type Page, test } from '@playwright/test'
import { loginWithCode, testIp, waitForHydration } from './helpers'

// Os dois botões "Sair": o da barra lateral da área logada
// (src/routes/_app.tsx) e o do menu da conta no cabeçalho público
// (src/integrations/better-auth/header-user.tsx, que só carrega o cliente do
// Better Auth no clique). O terceiro jeito de sair, encerrar a conta, está no
// login.spec.ts.
//
// Cada teste faz o próprio login. Para não gastar a cota de login dos outros
// specs (5 POSTs por minuto por IP em /api/auth/*), os pedidos de login daqui
// levam um IP de teste (`cf-connecting-ip`, que em localhost o app aceita).

async function entrar(page: Page, prefixo: string) {
  const ip = testIp()
  await page.route('**/api/auth/**', (route) =>
    route.continue({
      headers: { ...route.request().headers(), 'cf-connecting-ip': ip },
    }),
  )
  await page.goto('/login')
  await loginWithCode(page, `${prefixo}-${Date.now()}@exemplo.test`)
  await expect(page).toHaveURL(/\/app$/)
}

// O pedido de saída ao Better Auth (prova que o clique chegou ao servidor).
function pedidoDeSaida(page: Page) {
  return page.waitForResponse((res) =>
    res.url().endsWith('/api/auth/sign-out'),
  )
}

async function expectSemSessao(page: Page) {
  await expect(page).toHaveURL(/\/$/)
  await expect(
    page.getByRole('banner').getByRole('link', { name: 'Entrar', exact: true }),
  ).toBeVisible()
  await page.goto('/app')
  await expect(page).toHaveURL(/\/login\?redirect=%2Fapp$/)
}

test('Sair pela barra lateral encerra a sessão', async ({ page }) => {
  await entrar(page, 'e2e-sair-lateral')

  const sair = page.getByRole('button', { name: 'Sair', exact: true })
  await waitForHydration(sair)
  const saida = pedidoDeSaida(page)
  await sair.click()
  expect((await saida).status()).toBe(200)

  await expectSemSessao(page)
})

test('Sair pelo menu da conta no cabeçalho público encerra a sessão', async ({
  page,
}) => {
  await entrar(page, 'e2e-sair-cabecalho')

  // O cabeçalho público não aparece dentro de /app: vai para a home, logado.
  await page.goto('/')
  const menu = page.getByRole('button', { name: 'Abrir menu da conta' })
  await waitForHydration(menu)
  await menu.click()
  const saida = pedidoDeSaida(page)
  await page.getByRole('menuitem', { name: 'Sair', exact: true }).click()
  expect((await saida).status()).toBe(200)

  await expectSemSessao(page)
})
```

**Verificação**:

```bash
npx biome check --write e2e/sair.spec.ts
npx playwright test e2e/sair.spec.ts
```

→ `2 passed`.

### Passo 8 (uma tentativa só, com saída definida): 411 sem `Content-Length`

O Playwright sempre manda `Content-Length`, então este teste usa o `node:http`
direto, com corpo em pedaços (`Transfer-Encoding: chunked`). Não foi possível
confirmar de antemão que o servidor de dev repassa o pedido sem
`Content-Length` até o Worker. Por isso este passo tem regra própria:

8a. Em `e2e/login.spec.ts`, acrescente no topo `import http from 'node:http'`
(junto do `import fs from 'node:fs'`) e troque o import dos helpers por:

```ts
import { devPort, loginWithCode, testIp, waitForHydration } from './helpers'
```

8b. Acrescente depois do teste do 429 (passo 5) e antes do teste `área logada`:

```ts
test('avatar: POST sem Content-Length recebe 411', async () => {
  // O Playwright sempre manda Content-Length; aqui o corpo vai em pedaços
  // (chunked) pelo node:http, com os cookies da sessão copiados da página.
  const cookies = await page.context().cookies()
  const status = await new Promise<number>((resolve, reject) => {
    const req = http.request(
      `http://localhost:${devPort}/api/avatar`,
      {
        method: 'POST',
        headers: {
          cookie: cookies.map((c) => `${c.name}=${c.value}`).join('; '),
          'cf-connecting-ip': testIp(),
          'content-type': 'multipart/form-data; boundary=x',
          'transfer-encoding': 'chunked',
        },
      },
      (res) => {
        res.resume()
        resolve(res.statusCode ?? 0)
      },
    )
    req.on('error', reject)
    req.setTimeout(15_000, () => req.destroy(new Error('sem resposta em 15 s')))
    req.write('--x--\r\n')
    req.end()
  })
  expect(status).toBe(411)
})
```

**Verificação**:

```bash
npx biome check --write e2e/login.spec.ts
npx playwright test e2e/login.spec.ts
```

- Deu `13 passed`: ótimo, o teste fica.
- O teste do 411 falhou (status diferente de 411, erro de conexão ou tempo
  esgotado): **NÃO insista e NÃO mexa em `src/`**. Apague só o que este passo
  acrescentou (o teste, o `import http` e o `devPort` do import), rode de novo
  e confirme `12 passed`. Anote no relatório final o status que veio. Daqui em
  diante, onde o plano diz "27 testes", leia "26 testes".

### Passo 9: documentação

Descubra os números de verdade:

```bash
npx playwright test --list | tail -1
```

→ `Total: 27 tests in 5 files` (ou `26` se o passo 8 foi desfeito).

9a. `AGENTS.md`, na linha que começa com `` - `npm run e2e` — Playwright (4 specs, 19 testes) ``:
troque `4 specs, 19 testes` por `5 specs, 27 testes` (ou `26`). Nada mais nessa linha.

9b. `README.md`, na tabela (linha `| Qualidade | ...`): troque `Playwright (4 specs)` por `Playwright (5 specs)`.

9c. `e2e/README.md`, seção `## Arquivos`:

- troque a linha do `helpers.ts` por:

  ```md
  - `helpers.ts`: portas, leitura do código no log, `loginWithCode()` (usado pelos specs de login) e `testIp()` (IP de teste para o rate limit, só em localhost).
  ```

- troque a linha do `login.spec.ts` por (tire o trecho do 411 se o passo 8 foi desfeito):

  ```md
  - `login.spec.ts`: o produto logado de ponta a ponta com UM login (o rate limit é 5/min por IP): entra por código e chega em `/app`, navega pela barra lateral, cria um cliente (e confere `no-store` e o cookie `d1-bookmark` na resposta da escrita), troca a foto (R2), confere o `GET` da foto (404, 304, cache, CSP) e as recusas do `POST /api/avatar` na ordem (403, 401, 400, 415, 413, 429, 411), confere `no-store` em `/app`, baixa os dados em JSON e encerra a conta.
  ```

- acrescente, depois da linha do `guards.spec.ts`:

  ```md
  - `sair.spec.ts`: os dois botões "Sair" (barra lateral da área logada e menu da conta no cabeçalho público). Cada teste faz o próprio login com um IP de teste.
  ```

9d. `e2e/README.md`, seção `## Convenções`, acrescente no fim:

```md
- Teste que gasta rate limit (POST logado em `/api/avatar`, login extra) manda o cabeçalho `cf-connecting-ip` com `testIp()`: em localhost o app confia nele, então cada teste ganha um balde próprio de 5 por minuto. Na borda da Cloudflare o cabeçalho é sobrescrito: isso só vale no E2E local.
```

**Verificação**:

```bash
grep -c "5 specs" AGENTS.md README.md
grep -c "sair.spec.ts" e2e/README.md
```

→ `AGENTS.md:1`, `README.md:1` e `1`.

### Passo 10: tudo junto

```bash
npm run typecheck
npm run check
npm run test
npm run e2e
```

**Verificação**: os três primeiros com exit 0; o `npm run e2e` termina com
`27 passed` (ou `26`). Rode o `npm run e2e` uma segunda vez: tem de passar de
novo (prova que os testes não dependem de sobra do rate limit da rodada
anterior).

## Plano de testes

Testes novos (nenhum código de `src/` muda):

| Arquivo | Teste | O que prova |
|---------|-------|-------------|
| `e2e/login.spec.ts` | `avatar: GET público responde 404, 304 e os cabeçalhos de cache` | imutável só com `?v=`, `max-age=300` sem, CSP `sandbox`, `nosniff`, 304 com `If-None-Match`, 404 para id inválido e id sem foto |
| `e2e/login.spec.ts` | `avatar: POST recusa outro site (403) e visitante sem sessão (401) antes de ler o corpo` | 403 vem antes de 401; 401 vem antes de 400 |
| `e2e/login.spec.ts` | `avatar: POST logado recusa corpo sem file (400), bytes que não são imagem (415) e arquivo grande (413)` | as três recusas do corpo, e que nenhuma troca a foto |
| `e2e/login.spec.ts` | `avatar: o 6º POST do mesmo IP em um minuto recebe 429, antes de ler o corpo` | o limite de 5/min, o `retry-after`, 429 antes de 400 |
| `e2e/login.spec.ts` | `avatar: POST sem Content-Length recebe 411` (passo 8, pode não ficar) | a recusa 411 |
| `e2e/login.spec.ts` | `área logada: o HTML de /app sai com Cache-Control: no-store` | `no-store` em três páginas logadas |
| `e2e/login.spec.ts` | (dentro do teste existente de criar cliente) | `no-store` e `Set-Cookie: d1-bookmark` na resposta de uma server function que escreve |
| `e2e/login.spec.ts` | (dentro do teste existente de encerrar conta) | o cabeçalho público volta a mostrar `Entrar` |
| `e2e/sair.spec.ts` | `Sair pela barra lateral encerra a sessão` | POST `/api/auth/sign-out` 200, cai em `/`, `/app` pede login |
| `e2e/sair.spec.ts` | `Sair pelo menu da conta no cabeçalho público encerra a sessão` | o mesmo, pelo caminho do `import()` dinâmico |

Molde estrutural: os testes existentes de `e2e/login.spec.ts` (trecho na seção
"Estado atual").

Orçamento de rate limit (por que nada estoura):

- Escopo `avatar`, IP padrão do navegador: 1 pedido (o envio que dá certo, já existente).
- Escopo `avatar`, IPs de teste: 3 pedidos (passo 4), até 11 (passo 5), 1 (passo 8), cada teste no seu IP.
- 403 e 401 não gastam cota.
- Escopo `auth`, IP padrão: os mesmos 4 POSTs de hoje (2 logins). Os 2 logins do `sair.spec.ts` usam IPs de teste.

Verificação: `npm run e2e` → `27 passed` (ou `26`), duas vezes seguidas.

## Critérios de pronto

Verificáveis por comando. TODOS precisam valer:

- [ ] `npm run typecheck` sai com 0
- [ ] `npm run check` sai com 0
- [ ] `npm run test` sai com 0
- [ ] `npx playwright test --list | tail -1` imprime `Total: 27 tests in 5 files` (ou `Total: 26 tests in 5 files`, se o passo 8 foi desfeito e isso está no relatório)
- [ ] `npm run e2e` termina com todos passando, em duas rodadas seguidas
- [ ] `grep -c "cf-connecting-ip" e2e/helpers.ts e2e/sair.spec.ts e2e/login.spec.ts` mostra pelo menos 1 em cada arquivo
- [ ] `git status --short -- src wrangler.jsonc playwright.config.ts e2e/guards.spec.ts e2e/security-headers.spec.ts e2e/marketing.spec.ts` mostra exatamente as mesmas linhas de antes de começar (guarde a saída desse comando no passo 0 e compare no fim: este plano não muda nenhum desses arquivos)
- [ ] `git status --short -- e2e` mostra `e2e/sair.spec.ts` como novo (`??`) e `e2e/helpers.ts`, `e2e/login.spec.ts`, `e2e/README.md` como modificados
- [ ] `grep -c "5 specs" AGENTS.md README.md` mostra 1 em cada
- [ ] `plans/README.md` atualizado, se existir

## Condições de STOP

Pare e relate (não improvise) se:

- Os trechos da seção "Estado atual" não batem com os arquivos (status,
  mensagem ou ordem das checagens diferente): o código mudou depois deste plano.
- A linha de base (passo 0) não dá `19 passed`, ou `.dev.vars` não existe.
- No passo 5, o 429 chega ANTES do 6º pedido (a asserção
  `statuses.slice(0, 5)` falha): o cabeçalho `cf-connecting-ip` não está
  chegando ao app, e a premissa central do plano ("em localhost o app aceita o
  IP de teste") é falsa. Não troque por `sleep`/espera de 60 s nem aumente o
  limite no `wrangler.jsonc`.
- Um teste novo dos passos 2 a 7 falha porque o APP responde diferente do
  descrito (outro status, outra mensagem, cabeçalho ausente). Isso pode ser um
  bug de verdade no app: relate o teste, o esperado e o recebido. Não ajuste a
  asserção para "passar" e não mexa em `src/`.
- No passo 6b, o cookie `d1-bookmark` não aparece na resposta da escrita
  (`cookies.find(...)` devolve `undefined`). Relate a lista de `set-cookie`
  recebida (só os NOMES dos cookies, nunca os valores).
- No passo 7, o login com IP de teste falha (o código não aparece no log ou o
  login recebe 429).
- A verificação de um passo falha duas vezes depois de uma tentativa razoável
  de correção (exceção: o passo 8, que tem regra própria e uma tentativa só).
- A correção parece exigir mexer em arquivo fora do escopo.

No relatório, nunca cole valores de cookie, de token ou do `.dev.vars`.

## Notas de manutenção

Para quem cuidar disso depois:

- **Mudou a ordem ou o texto de uma recusa em `src/routes/api/avatar.ts`?** Os
  testes de avatar em `e2e/login.spec.ts` comparam o status E o texto exato.
  Atualize os dois lados de propósito, e confira se a ordem nova ainda faz
  sentido (outro site antes da sessão; sessão antes da cota; cota antes do corpo).
- **Mudou o limite do `PUBLIC_RATE_LIMIT` (`wrangler.jsonc`)?** O teste do 429
  assume 5 por minuto (`statuses.slice(0, 5)` e o laço de 11 pedidos, que é
  2 × 5 + 1). Ajuste os dois números.
- **O truque do `cf-connecting-ip` só vale em localhost.** Se um dia o E2E
  rodar contra um ambiente atrás da Cloudflare, `testIp()` deixa de isolar os
  baldes: os testes de avatar passam a dividir uma cota só e o `sair.spec.ts`
  passa a gastar a cota de login do IP real.
- **Fica sem E2E, de propósito**: o 413 pelo `Content-Length`
  (`avatar.ts:52-55`; a resposta sai antes de o corpo ser lido, e um teste que
  manda 3 MB pode ver a conexão cair no meio), o 400 de arquivo vazio e o 415
  pelo tipo declarado (`checkAvatarFile`, sem teste de unidade hoje: bom
  candidato a um `src/lib/avatar.test.ts`). Se o passo 8 foi desfeito, o 411
  também.
- **Página logada nova em `src/routes/_app/app/`?** Acrescente o caminho na
  lista do teste `área logada: o HTML de /app sai com Cache-Control: no-store`.
- **Ponto de atenção na revisão**: o trecho do passo 6b mexe num teste que já
  existia; confira que o primeiro clique em `Adicionar` (formulário vazio)
  continua lá e que o `waitForResponse` foi criado ANTES do segundo clique.
- O `sair.spec.ts` deixa dois usuários de teste (`e2e-sair-...@exemplo.test`)
  no D1 local a cada rodada, como o `guards.spec.ts` já deixa um. É estado
  local (`.wrangler/state/`), sem efeito fora da máquina.
