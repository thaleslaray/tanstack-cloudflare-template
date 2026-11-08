@AGENTS.md

# tanstack-cloudflare-template

Template de app full-stack rodando 100% em um Cloudflare Worker, com o
`@cloudflare/vite-plugin` v1 e o Wrangler (o caminho estável do guia oficial).
Público: quem está aprendendo. Explique o que
fizer em pt-BR, simples e direto.

## Stack
TanStack Start (React 19) + Router + Query, Tailwind v4 + shadcn/ui, Drizzle
sobre D1, Better Auth (código por e-mail, Google/GitHub opcionais, senha
opcional), R2, Durable Object `Counter`, cron, MDX (blog/docs/legal) com
prerender, rate limit, cabeçalhos de segurança, Biome, Vitest, Playwright.
Entry do Worker em `src/server.ts`; config em `wrangler.jsonc`.

## Comandos
- `npm run dev` — `vite dev --port 3000` em http://localhost:3000 (outra porta: `npx vite dev --port 3001`, e `BETTER_AUTH_URL=http://localhost:3001` no `.dev.vars`)
- `npm run build` — `vite build` (saída em `dist/client` e `dist/server`, com prerender); antes, o `prebuild` roda `npm run sitemap`
- `npm run sitemap` — `scripts/generate-sitemap.ts` (via `tsx`) reescreve `public/sitemap.xml` e `public/robots.txt` a partir de `src/config/app.ts`, `src/config/public-paths.ts` e `content/`
- `npm run preview` — build + `vite preview` (a saída de produção, local)
- `npm run cf-typegen` — `wrangler types --env-file .dev.vars.example` → `worker-configuration.d.ts`
- `npm run typecheck` — `cf-typegen` + `tsc --noEmit`
- `npm run check` / `check:fix` — Biome
- `npm run test` — Vitest (unidades, ambiente node, `cloudflare:workers` substituído por `src/test/cloudflare-workers.ts`)
- `npm run e2e` — Playwright (4 specs, 13 testes); sobe o `vite dev` sozinho e grava o log em `e2e/.dev.log` (é de lá que o teste de login lê o código), e também o `npm run preview` na porta 4173 (`E2E_PREVIEW_PORT`), para checar os cabeçalhos do `public/_headers` nos estáticos. Porta ocupada: `E2E_PORT=3001 npm run e2e` (+ `BETTER_AUTH_URL` no `.dev.vars`)
- `npm run db:generate` — migração a partir de `src/db/schema.ts` e `src/db/auth-schema.ts`
- `npm run db:migrate:local` / `db:migrate:remote`
- `npx wrangler deploy --dry-run` (depois de `npm run build`) — valida sem publicar; `npm run deploy -- --secrets-file .prod.vars` publica
- Cron local: `curl "http://localhost:3000/cdn-cgi/local/scheduled?cron=0+3+*+*+*"`
- Local Explorer (D1, R2, DO, logs): http://localhost:3000/cdn-cgi/local/explorer
- Skills: `/setup`, `/deploy`, `/google-oauth` (em `.claude/skills/`)
- CI (GitHub Actions, sem deploy): `.github/workflows/ci.yml` em push na `main` e PR (`npm ci`, `.dev.vars` com segredo aleatório, typecheck, check, test, build, `wrangler deploy --dry-run`, e falha se `npm run db:generate` mudar `drizzle/`); `e2e.yml` à mão e toda segunda 09:00 UTC.

## Mapa
- `src/routes/` — rotas por arquivo: `/` (landing), `/login`, `/conta` (protegida), `/blog`, `/docs`, `/termos`, `/privacidade`, `demo/*`, `api/auth/$`.
- `src/content/landing.ts` — a landing como dados; `src/components/landing/` renderiza.
- `src/config/` — `app.ts` (nome, URL base de SEO/sitemap, e-mail de suporte), `themes.ts` (os quatro temas), `public-paths.ts` (o que pode ser pré-renderizado, páginas fixas do sitemap, bloqueios do robots).
- `scripts/generate-sitemap.ts` — gera `public/sitemap.xml` e `public/robots.txt` (versionados; não edite à mão). `public/og.png` — cartão social 1200x630 do `og:image`.
- `src/lib/` — `audit.ts` (trilha de auditoria: `audit()`, `onAudit()`, `formatAuditEntry()`), `audit-d1.ts` (sink padrão, grava em `audit_log`), `auth-audit-hook.ts` (login e troca de nome via `hooks.after` do Better Auth), `seo.ts` (`seo()`: título, description, og/twitter, `article`, `noindex`), `auth.ts` (factory do Better Auth), `auth-client.ts`, `auth-fns.ts`/`auth-queries.ts` (sessão e provedores), `email.ts` + `email-templates.ts`, `rate-limit.ts`, `security-headers.ts`, `same-origin.ts`, `jobs.ts` (cron), `content/` (MDX).
- `src/db/` — `index.ts` (`getDb(env.DB)`), `schema.ts` (suas tabelas e `audit_log`), `auth-schema.ts` (tabelas do Better Auth).
- `content/{blog,docs,legal}/*.mdx` — compilados no build por `@mdx-js/rollup`.
- `src/rules.test.ts` — regras do CLAUDE.md marcadas com (teste), checadas por texto em todo `src/`.
- `src/styles.css` — tokens dos temas; `public/_headers` — cabeçalhos das páginas estáticas.
- `.github/workflows/` — `ci.yml` (conferência a cada push/PR) e `e2e.yml` (Playwright manual e semanal). Nenhum faz deploy.
- `wrangler.jsonc` — Worker e bindings; `worker-configuration.d.ts` — tipos gerados (não editar à mão).

## Regras
As regras marcadas com (teste) são verificadas por `src/rules.test.ts` (roda no `npm run test`).

- (teste) A config é `wrangler.jsonc` (com `$schema`; nomes de campo conferidos em `node_modules/wrangler/config-schema.json`). NÃO instalar o `cf` nem criar `cloudflare.config.ts` até o GA do `cf`/plugin v2: o `cf` ignora o `wrangler.jsonc` e pode gerar config sem bindings; o Wrangler não publica saída do v2. O caminho de ida, no GA, é `npx cf migrate` (o estado v2 está guardado na branch `cf-v2-beta`).
- Versões FIXADAS sem `^`: `wrangler@4.158.0`, `@cloudflare/vite-plugin@1.67.0`. Atualizar só de propósito, lendo o changelog, e rodar `typecheck`, `build`, `test` e `e2e` antes de commitar.
- Tipos de `Env` ficam em `worker-configuration.d.ts`, gerados por `npm run cf-typegen` a partir do `wrangler.jsonc` + chaves do `.dev.vars.example` (o `--env-file` faz funcionar em clone limpo, sem `.dev.vars`). Mudou `wrangler.jsonc` ou o `.dev.vars.example`? Regenere e versione o arquivo.
- No `vite.config.ts`: plugins MDX (`enforce: 'pre'`) e `mdxMeta()` primeiro, depois `cloudflare({ viteEnvironment: { name: 'ssr' } })` ANTES de `tanstackStart()`. Não reordenar.
- (teste) Bindings só via `import { env } from "cloudflare:workers"` em código de servidor (server functions, handlers, `src/lib/*` de servidor); ler `env` dentro de função, nunca em escopo de módulo, nunca em código que vá ao client. Sem `process.env` em `src/`.
- `getAuth(env)` e `getDb(env.DB)` são factories por request. Sem singletons. `tanstackStartCookies()` é sempre o último plugin do Better Auth.
- D1 é SQLite: sem transação aninhada; use `db.batch([...])` ou uma instrução condicional.
- Aguardar (`await`) toda promise; no `scheduled`, `ctx.waitUntil`.
- Sem `eval`/MDX em runtime e sem filesystem real no Worker.
- `compatibilityDate` sempre atual.

### Segredos e URL
- Locais em `.dev.vars` (não versionado); a lista de chaves é `.dev.vars.example`, que também alimenta os tipos. Novo segredo? Adicione nos dois e rode `npm run cf-typegen`. Segredo nunca vai em `"vars"`.
- Não usamos `"secrets": { "required": [...] }` no `wrangler.jsonc` de propósito: com ele o `wrangler deploy` exige TODOS os listados, e os opcionais (`RESEND_API_KEY`, `EMAIL_FROM`, `GOOGLE_*`, `GITHUB_*`) bloqueariam o deploy. O código trata string vazia como ausente.
- `BETTER_AUTH_URL` fica em `"vars"` no `wrangler.jsonc` (`http://localhost:3000`). No dev, uma linha `BETTER_AUTH_URL=...` no `.dev.vars` VENCE o `"vars"` (útil para outra porta). Para publicar, troque o valor no `wrangler.jsonc`.
- Produção: `npm run deploy -- --secrets-file .prod.vars` (gitignorado) ou `npx wrangler secret bulk .prod.vars`.

### E-mail
- (teste) Tudo passa por `sendEmail()` em `src/lib/email.ts`. Ordem: Resend (se `RESEND_API_KEY`), binding `EMAIL` do Cloudflare Email Service (`send_email` descomentado no `wrangler.jsonc` e `EMAIL_FROM` definido), senão o e-mail inteiro vai para o console do `npm run dev`. Templates em `src/lib/email-templates.ts`, HTML com estilos inline.
- Não instalar SDK de e-mail; Resend é REST via `fetch`.

### Auth
- Login principal é o plugin `emailOTP` (6 dígitos, `storeOTP: 'hashed'`, 3 tentativas, 10 min). Sem provedor de e-mail, o código sai no log: `[auth] código de login para <email>: <código>` (o e2e depende dessa linha; não mude o formato).
- Google e GitHub entram só quando o PAR de variáveis existe (`googleEnabled`/`githubEnabled`). O client lê `getAuthProvidersFn` para decidir quais botões mostrar.
- Rotas protegidas: `beforeLoad` com `ensureQueryData(sessionQuery)` e `redirect({ to: '/login', search: { redirect } })`; destino de volta passa por `safeRedirect`.
- Mudou plugin ou campo do Better Auth? Ajuste `src/db/auth-schema.ts` e rode `db:generate`. O emailOTP usa a tabela `verification` existente.

### D1 e UUID
- `database_id` em `d1_databases` é `REPLACE_ME` até criar o banco real (`npx wrangler d1 create tanstack-cloudflare-template-db`); cole o ID devolvido ali. Os scripts `db:migrate:*` usam o nome do binding (`DB`), então não mudam. O D1 local é chaveado pelo ID: depois da troca, rode `db:migrate:local` de novo.
- O estado local (D1, R2, DO) fica em `.wrangler/state/` (gitignorado e fora do watch do Vite).

### Conteúdo e prerender
- Páginas públicas (`/`, `/blog*`, `/docs*`, `/termos`, `/privacidade`) são pré-renderizadas no `npm run build` (`prerender` no `vite.config.ts`, allow-list em `src/config/public-paths.ts`). Nada com sessão ou binding em tempo de requisição pode entrar nessa lista: uma cópia estática serviria sem o guard. Rota nova de conteúdo? Adicione lá (e, se for página fixa, em `SITEMAP_STATIC_PATHS`).
- SEO: o `__root.tsx` põe os padrões (canonical, `og:url`, `og:site_name`, `og:image` = `/og.png`, `twitter:card`); cada rota com `head` usa `seo()` de `src/lib/seo.ts` só com o que é dela. Login e conta levam `noindex`. A base das URLs é `appConfig.url`: troque antes de publicar e rode `npm run sitemap`.
- O prerender roda no build com os bindings LOCAIS; não leia D1/R2 em loader de página pré-renderizada.
- Cada coleção MDX tem dois `import.meta.glob` literais (`?meta` eager para listas; lazy para o corpo). Não leia `frontmatter` do módulo compilado: isso põe todos os corpos no bundle principal.

### Temas e landing
- Um tema é SÓ tokens em `src/styles.css`. `data-theme` (autonomia, neutro, editorial, brutal) é o visual, escrito por `theme-provider.tsx`; a classe `dark` (next-themes) é o modo. Nenhum componente lê `data-theme`. Forma que varia por tema vira token (`--radius-btn`, `--radius-card`, `--display-font`, `--shadow-btn`).
- (teste) Cores só pelos tokens (`bg-background`, `text-muted-foreground`, `bg-brand`, `bg-surface`...). Sem hex/`rgb(` em componente (única exceção nomeada no teste: o logo do Google em `social-buttons.tsx`).
- A landing é a lista em `src/content/landing.ts`; a rota `/` não tem texto. Formato novo de bloco = tipo em `types.ts` + componente + `case` no `render.tsx`.

### Proteções
- `PUBLIC_RATE_LIMIT` (5/min por IP) cobre os endpoints de login e as escritas públicas; `isRateLimited()` falha ABERTA sem o binding. Endpoint público de escrita novo? Aplique.
- Cabeçalhos de segurança em `src/lib/security-headers.ts` (Worker) e `public/_headers` (assets/páginas estáticas): mantenha os dois iguais. Sem CSP de propósito (scripts inline do TanStack).
- Server functions recusam chamadas cross-site (`same-origin.ts`); use `method: 'POST'` em server function que muda estado.
- Cron diário (03:00 UTC) roda `runJobs` em `src/lib/jobs.ts`; jobs precisam ser idempotentes.

### Auditoria
- `audit({ action, actorId, actorEmail, targetType, targetId, meta, ...requestMeta(headers) })` em `src/lib/audit.ts`. **Sem sink registrado é no-op**: quem chama não precisa saber se a auditoria existe. O sink padrão (`src/lib/audit-d1.ts`, tabela `audit_log`) é registrado pelo import em `src/server.ts`; apagar aquela linha desliga a gravação.
- `action` é `<area>.<verbo>` em minúsculas (`auth.sign_in`, `account.name_changed`, `account.avatar_set`, `account.close_requested`, `account.deleted`); formato inválido é descartado com log.
- Nunca grave segredo (token, senha, código, cookie, chave) nem corpo de request. `formatAuditEntry` descarta chaves com cara de segredo em `meta` e só aceita valores primitivos, mas a regra é de quem chama.
- Com `waitUntil` à mão, passe-o (`audit(entry, { waitUntil })`, de `cloudflare:workers` ou do `ctx`) e a resposta não espera a gravação; sem ele, `await`. Falha de sink nunca derruba a ação.
- Evento novo do Better Auth? Acrescente no `auditAfterHook` (`src/lib/auth-audit-hook.ts`); ele só vê chamadas HTTP a `/api/auth/*`.

### Endpoints locais (dev)
- Cron: `curl "http://localhost:3000/cdn-cgi/local/scheduled?cron=0+3+*+*+*"`.
- Local Explorer (D1, R2, DO, logs e traces): http://localhost:3000/cdn-cgi/local/explorer (plugin v1 ≥ 1.50.0).

### Decisões registradas
- **i18n: só pt-BR.** Paraglide foi avaliado (referência ShipKit Lite) e deixado de fora: exige middleware no entry, reescrita de URL, thunks em toda string e dois globs por idioma, o que complica demais o template para quem está aprendendo. Textos ficam direto nos componentes e em `content/`. Se precisar de outro idioma, comece por `src/content/landing.ts` e `content/`.
- **Vitest puro, com stub de `cloudflare:workers`** (`src/test/cloudflare-workers.ts`); o comportamento real fica para o Playwright contra o `vite dev`. Com Wrangler de volta, `@cloudflare/vitest-pool-workers@0.23.0` passou a ser possível (testes dentro do workerd, com D1/R2/DO de verdade): é o próximo passo, fora do escopo da volta para v1.
- **Wrangler + plugin v1 em vez de `cf` + v2 (2026-11-07):** os dois seguem em beta e o template vai para leigos. Detalhes em `HANDOFF.md` §10.
- **Devtools do TanStack** só em dev (`src/components/devtools.tsx`, carregado atrás de `import.meta.env.DEV`).
- `env.COUNTER` já vem tipado como `DurableObjectNamespace<Counter>` pelo `wrangler types`: sem cast.
