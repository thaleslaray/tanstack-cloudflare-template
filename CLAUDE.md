@AGENTS.md

# tanstack-cloudflare-template

Template de app full-stack rodando 100% em um Cloudflare Worker, com o Vite
plugin v2 beta e o CLI `cf`. Público: quem está aprendendo. Explique o que
fizer em pt-BR, simples e direto.

## Stack
TanStack Start (React 19) + Router + Query, Tailwind v4 + shadcn/ui, Drizzle
sobre D1, Better Auth (código por e-mail, Google/GitHub opcionais, senha
opcional), R2, Durable Object `Counter`, cron, MDX (blog/docs/legal) com
prerender, rate limit, cabeçalhos de segurança, Biome, Vitest, Playwright.
Entry do Worker em `src/server.ts`; config em `cloudflare.config.ts`.

## Comandos
- `npm run dev` — `cf dev` em http://localhost:3000 (`PORT=3001 npm run dev` muda a porta; `cf dev` não aceita `--port`)
- `npm run build` — `cf build` (saída em `.cloudflare/output/`, com prerender)
- `npm run typecheck` — `cf workers types && tsc --noEmit`
- `npm run check` / `check:fix` — Biome
- `npm run test` — Vitest (unidades, ambiente node, `cloudflare:workers` substituído por `src/test/cloudflare-workers.ts`)
- `npm run e2e` — Playwright; sobe o `cf dev` sozinho e grava o log em `e2e/.dev.log` (é de lá que o teste de login lê o código)
- `npm run db:generate` — migração a partir de `src/db/schema.ts` e `src/db/auth-schema.ts`
- `npm run db:migrate:local` / `db:migrate:remote`
- `npx cf deploy --dry-run` — valida sem publicar; `npx cf deploy --secrets-file .prod.vars` publica
- Cron local: `curl "http://localhost:3000/cdn-cgi/local/scheduled?cron=0+3+*+*+*"`
- Local Explorer (D1, R2, DO, logs): http://localhost:3000/cdn-cgi/local/explorer
- Skills: `/setup`, `/deploy`, `/google-oauth` (em `.claude/skills/`)

## Mapa
- `src/routes/` — rotas por arquivo: `/` (landing), `/login`, `/conta` (protegida), `/blog`, `/docs`, `/termos`, `/privacidade`, `demo/*`, `api/auth/$`.
- `src/content/landing.ts` — a landing como dados; `src/components/landing/` renderiza.
- `src/config/` — `app.ts` (nome, URL, e-mail de suporte), `themes.ts` (os quatro temas), `public-paths.ts` (o que pode ser pré-renderizado).
- `src/lib/` — `auth.ts` (factory do Better Auth), `auth-client.ts`, `auth-fns.ts`/`auth-queries.ts` (sessão e provedores), `email.ts` + `email-templates.ts`, `rate-limit.ts`, `security-headers.ts`, `same-origin.ts`, `jobs.ts` (cron), `content/` (MDX).
- `src/db/` — `index.ts` (`getDb(env.DB)`), `schema.ts` (suas tabelas), `auth-schema.ts` (tabelas do Better Auth).
- `content/{blog,docs,legal}/*.mdx` — compilados no build por `@mdx-js/rollup`.
- `src/styles.css` — tokens dos temas; `public/_headers` — cabeçalhos das páginas estáticas.

## Regras
- NUNCA criar `wrangler.jsonc`/`wrangler.toml` nem instalar Wrangler. A config é `cloudflare.config.ts`; o Wrangler a ignora e quebra o deploy.
- `cf` e o Vite plugin estão em beta: versões FIXADAS sem `^` (`cf@1.0.0-beta.28`, `@cloudflare/vite-plugin@2.0.0-beta.v.12`). Atualizar só de propósito, lendo o changelog, e rodar `typecheck`, `build`, `test` e `e2e` antes de commitar.
- Tipos de `Env` são gerados em `.cloudflare/types` por `cf dev`/`cf build`/`cf workers types` e inferidos do config. Mudou `cloudflare.config.ts`? Regenere.
- No `vite.config.ts`: plugins MDX (`enforce: 'pre'`) e `mdxMeta()` primeiro, depois `cloudflare()` ANTES de `tanstackStart()`. Não reordenar.
- Bindings só via `import { env } from "cloudflare:workers"` em código de servidor (server functions, handlers, `src/lib/*` de servidor); ler `env` dentro de função, nunca em escopo de módulo, nunca em código que vá ao client.
- `getAuth(env)` e `getDb(env.DB)` são factories por request. Sem singletons. `tanstackStartCookies()` é sempre o último plugin do Better Auth.
- D1 é SQLite: sem transação aninhada; use `db.batch([...])` ou uma instrução condicional.
- Aguardar (`await`) toda promise; no `scheduled`, `ctx.waitUntil`.
- Sem `eval`/MDX em runtime e sem filesystem real no Worker.
- `compatibilityDate` sempre atual.

### Segredos e URL
- Locais em `.dev.vars` (não versionado); a lista de chaves é `.dev.vars.example`. Nova variável? Adicione nos dois e em `cloudflare.config.ts` como `bindings.secret()`.
- Segredos opcionais (`RESEND_API_KEY`, `EMAIL_FROM`, `GOOGLE_*`, `GITHUB_*`) são declarados com `bindings.secret()`. Ausentes, o `cf dev` só avisa ("Missing required secrets") e segue; por isso o `.dev.vars.example` traz todos, vazios. O código trata string vazia como ausente.
- `BETTER_AUTH_URL` é `bindings.text(...)` em `cloudflare.config.ts` e VENCE qualquer valor do `.dev.vars`. Para publicar, troque ali. Para rodar em outra porta no dev, troque ali também (senão o login recusa a origem).
- Produção: `cf deploy --secrets-file .prod.vars` (gitignorado).

### E-mail
- Tudo passa por `sendEmail()` em `src/lib/email.ts`. Ordem: Resend (se `RESEND_API_KEY`), binding `EMAIL` do Cloudflare Email Service (se descomentado no config e `EMAIL_FROM` definido), senão o e-mail inteiro vai para o console do `cf dev`. Templates em `src/lib/email-templates.ts`, HTML com estilos inline.
- Não instalar SDK de e-mail; Resend é REST via `fetch`.

### Auth
- Login principal é o plugin `emailOTP` (6 dígitos, `storeOTP: 'hashed'`, 3 tentativas, 10 min). Sem provedor de e-mail, o código sai no log: `[auth] código de login para <email>: <código>` (o e2e depende dessa linha; não mude o formato).
- Google e GitHub entram só quando o PAR de variáveis existe (`googleEnabled`/`githubEnabled`). O client lê `getAuthProvidersFn` para decidir quais botões mostrar.
- Rotas protegidas: `beforeLoad` com `ensureQueryData(sessionQuery)` e `redirect({ to: '/login', search: { redirect } })`; destino de volta passa por `safeRedirect`.
- Mudou plugin ou campo do Better Auth? Ajuste `src/db/auth-schema.ts` e rode `db:generate`. O emailOTP usa a tabela `verification` existente.

### D1 e UUID
- O `id` em `bindings.d1` precisa ser um UUID válido. O valor atual é um placeholder local (`11111111-1111-4111-8111-111111111111`). Ao criar o banco real (`cf d1 create`), troque nos TRÊS lugares: `cloudflare.config.ts` e os scripts `db:migrate:local` e `db:migrate:remote`. O D1 local é chaveado por esse ID: depois da troca, rode `db:migrate:local` de novo.
- O estado do `cf dev` fica em `.cloudflare/state/`. `--local` sem `--persist-to .cloudflare/state` grava em outro lugar e não afeta o dev.

### Conteúdo e prerender
- Páginas públicas (`/`, `/blog*`, `/docs*`, `/termos`, `/privacidade`) são pré-renderizadas no `cf build` (`prerender` no `vite.config.ts`, allow-list em `src/config/public-paths.ts`). Nada com sessão ou binding em tempo de requisição pode entrar nessa lista: uma cópia estática serviria sem o guard. Rota nova de conteúdo? Adicione lá.
- O prerender roda no build com os bindings LOCAIS; não leia D1/R2 em loader de página pré-renderizada.
- Cada coleção MDX tem dois `import.meta.glob` literais (`?meta` eager para listas; lazy para o corpo). Não leia `frontmatter` do módulo compilado: isso põe todos os corpos no bundle principal.

### Temas e landing
- Um tema é SÓ tokens em `src/styles.css`. `data-theme` (autonomia, neutro, editorial, brutal) é o visual, escrito por `theme-provider.tsx`; a classe `dark` (next-themes) é o modo. Nenhum componente lê `data-theme`. Forma que varia por tema vira token (`--radius-btn`, `--radius-card`, `--display-font`, `--shadow-btn`).
- Cores só pelos tokens (`bg-background`, `text-muted-foreground`, `bg-brand`, `bg-surface`...). Sem hex em componente.
- A landing é a lista em `src/content/landing.ts`; a rota `/` não tem texto. Formato novo de bloco = tipo em `types.ts` + componente + `case` no `render.tsx`.

### Proteções
- `PUBLIC_RATE_LIMIT` (5/min por IP) cobre os endpoints de login e as escritas públicas; `isRateLimited()` falha ABERTA sem o binding. Endpoint público de escrita novo? Aplique.
- Cabeçalhos de segurança em `src/lib/security-headers.ts` (Worker) e `public/_headers` (assets/páginas estáticas): mantenha os dois iguais. Sem CSP de propósito (scripts inline do TanStack).
- Server functions recusam chamadas cross-site (`same-origin.ts`); use `method: 'POST'` em server function que muda estado.
- Cron diário (03:00 UTC) roda `runJobs` em `src/lib/jobs.ts`; jobs precisam ser idempotentes.

### Decisões registradas
- **i18n: só pt-BR.** Paraglide foi avaliado (referência ShipKit Lite) e deixado de fora: exige middleware no entry, reescrita de URL, thunks em toda string e dois globs por idioma, o que complica demais o template para quem está aprendendo. Textos ficam direto nos componentes e em `content/`. Se precisar de outro idioma, comece por `src/content/landing.ts` e `content/`.
- **Vitest puro, sem `@cloudflare/vitest-pool-workers`:** o pool depende do Wrangler e de `wrangler.jsonc`, que este projeto não usa. Código que toca bindings é testado com stubs em `env` (`src/test/cloudflare-workers.ts`); o comportamento real fica para o Playwright contra o `cf dev`.
- **Devtools do TanStack** só em dev (`src/components/devtools.tsx`, carregado atrás de `import.meta.env.DEV`).
- A classe `Counter` não é inferida em `env.COUNTER` (binding auto-referente); `src/routes/demo/durable-object.tsx` faz o cast.
