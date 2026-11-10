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
- `npm run e2e` — Playwright (4 specs, 21 testes); sobe o `vite dev` sozinho e grava o log em `e2e/.dev.log` (é de lá que o teste de login lê o código), e também o `npm run preview` na porta 4173 (`E2E_PREVIEW_PORT`), para checar os cabeçalhos do `public/_headers` nos estáticos. Porta ocupada: `E2E_PORT=3001 npm run e2e` (+ `BETTER_AUTH_URL` no `.dev.vars`)
- `npm run test:cold` — `scripts/cold-start-check.ts`: sobe um `vite dev` próprio na porta 3907 (`COLD_PORT`), abandona o primeiro pedido de quatro páginas e confere que todas continuam respondendo (uns 15 s). Roda no CI.
- `npm run db:generate` — migração a partir de `src/db/schema.ts` e `src/db/auth-schema.ts`
- `npm run db:migrate:local` / `db:migrate:remote`
- `npx wrangler deploy --dry-run` (depois de `npm run build`) — valida sem publicar; `npm run deploy -- --secrets-file .prod.vars` publica (o `predeploy` aplica as migrações remotas antes)
- Cron local: `curl "http://localhost:3000/cdn-cgi/local/scheduled?cron=0+3+*+*+*"`
- Local Explorer (D1, R2, DO, logs): http://localhost:3000/cdn-cgi/local/explorer
- Skills: `/setup`, `/deploy`, `/google-oauth`, `/tela` (em `.claude/skills/`). Pedido de tela nova ou de "deixar bonito"? Siga a `/tela`.
- CI (GitHub Actions, sem deploy): `.github/workflows/ci.yml` em push na `main` e PR (`npm ci`, `.dev.vars` com segredo aleatório, typecheck, check, test, `test:cold`, build, `wrangler deploy --dry-run`, e falha se `npm run db:generate` mudar `drizzle/`); `e2e.yml` à mão e toda segunda 09:00 UTC.

## Mapa
- `src/routes/` — rotas por arquivo: `/` (landing), `/login`, `_app.tsx` (layout protegido da área logada) com `_app/app/index.tsx` (`/app`, painel), `_app/app/clientes.tsx` (`/app/clientes`, a tela de lista de exemplo ligada ao D1) e `_app/app/configuracoes.tsx` (`/app/configuracoes`), `/conta` (só redireciona 301 para `/app/configuracoes`), `/blog`, `/docs`, `/termos`, `/privacidade`, `demo/*`, `api/auth/$`, `api/avatar` (POST, troca a foto) e `api/avatar/$userId` (GET, serve a foto), `/blocos` (catálogo dos blocos da landing), `/estilo` (bancada das peças de tela).
- `src/components/app-sidebar.tsx` (`mainNav`, a única lista do menu da área logada; barra lateral e gaveta), `page-header.tsx` (`PageHeader`, `StatStrip`, `StatCard`), `app/` (o kit de tela: `PageSection`, `Toolbar`, `TableFrame`, `EmptyState`, `Field`, `StatusDot` e a lista de referência `exemplo-lista.tsx`), `account/` (foto, baixar dados, encerrar conta).
- `src/content/landing.ts` — a landing como dados; `src/components/landing/` renderiza (`render.tsx`, `types.ts`, `blocks/`). `src/content/blocos-exemplo.ts` — um exemplo de cada formato, mostrado em `/blocos`.
- `src/config/` — `app.ts` (nome, URL base de SEO/sitemap, e-mail de suporte), `themes.ts` (os quatro temas), `public-paths.ts` (o que pode ser pré-renderizado, páginas fixas do sitemap, bloqueios do robots).
- `scripts/generate-sitemap.ts` — gera `public/sitemap.xml` e `public/robots.txt` (versionados; não edite à mão). `public/og.png` — cartão social 1200x630 do `og:image`.
- `src/lib/` — `audit.ts` (trilha de auditoria: `audit()`, `onAudit()`, `formatAuditEntry()`), `audit-d1.ts` (sink padrão, grava em `audit_log`), `auth-audit-hook.ts` (login e troca de nome via `hooks.after` do Better Auth), `avatar.ts` (limites e chave da foto de perfil; sem bindings, usado no servidor e no navegador), `account.ts` (hooks do ciclo de vida da conta e prazos; sem bindings), `account-handlers.ts` (o que cada módulo registra: apagar a foto no R2, tirar o e-mail da auditoria, fatias do "baixar meus dados"), `account-fns.ts` (`closeAccountFn`, `exportMyDataFn`), `app-fns.ts` (números do painel), `clientes.ts` (limites e validação, sem bindings) e `clientes-fns.ts` (listar, criar e apagar clientes da pessoa logada), `seo.ts` (`seo()`: título, description, og/twitter, `article`, `noindex`), `auth.ts` (factory do Better Auth), `auth-client.ts`, `auth-fns.ts`/`auth-queries.ts` (sessão e provedores), `email.ts` + `email-templates.ts`, `rate-limit.ts`, `security-headers.ts`, `same-origin.ts`, `jobs.ts` (cron), `content/` (MDX).
- `src/db/` — `index.ts` (`getDb(env.DB)`), `schema.ts` (suas tabelas: `todos`, `clientes` e `audit_log`), `auth-schema.ts` (tabelas do Better Auth).
- `content/{blog,docs,legal}/*.mdx` — compilados no build por `@mdx-js/rollup`.
- `src/rules.test.ts` — regras do CLAUDE.md marcadas com (teste), checadas por texto em todo `src/`.
- `src/styles.css` — tokens dos temas; `public/_headers` — cabeçalhos das páginas estáticas.
- `.github/workflows/` — `ci.yml` (conferência a cada push/PR) e `e2e.yml` (Playwright manual e semanal). Nenhum faz deploy.
- `wrangler.jsonc` — Worker e bindings; `worker-configuration.d.ts` — tipos gerados (não editar à mão).

## Regras
As regras marcadas com (teste) são verificadas por `src/rules.test.ts` (roda no `npm run test`).

- (teste) A config é `wrangler.jsonc` (com `$schema`; nomes de campo conferidos em `node_modules/wrangler/config-schema.json`). NÃO instalar o `cf` nem criar `cloudflare.config.ts` até o GA do `cf`/plugin v2: o `cf` ignora o `wrangler.jsonc` e pode gerar config sem bindings; o Wrangler não publica saída do v2. O caminho de ida, no GA, é `npx cf migrate` (o estado v2 está guardado na branch `cf-v2-beta`).
- Dependências com `^` (minor e patch sobem sozinhos) e `package-lock.json` versionado: quem clona recebe o que está no lock. Com o botão Deploy (Workers Builds), mesclar PR do Dependabot na `main` publica o app. O Dependabot (`.github/dependabot.yml`) abre PRs semanais agrupados e o CI valida cada um. Pin exato (sem `^`) só para pacote em beta, com o motivo escrito aqui; hoje não há nenhum.
- `compatibility_date` no `wrangler.jsonc` não é dependência: é o contrato com o runtime. Sobe à mão, lendo o changelog, e com `typecheck`, `build`, `test` e `e2e` verdes.
- Tipos de `Env` ficam em `worker-configuration.d.ts`, gerados por `npm run cf-typegen` a partir do `wrangler.jsonc` + chaves do `.dev.vars.example` (o `--env-file` faz funcionar em clone limpo, sem `.dev.vars`). Mudou `wrangler.jsonc` ou o `.dev.vars.example`? Regenere e versione o arquivo.
- No `vite.config.ts`: plugins MDX (`enforce: 'pre'`) e `mdxMeta()` primeiro, depois `cloudflare({ viteEnvironment: { name: 'ssr' } })` ANTES de `tanstackStart()`. Não reordenar.
- (teste) Bindings só via `import { env } from "cloudflare:workers"` em código de servidor (server functions, handlers, `src/lib/*` de servidor); ler `env` dentro de função, nunca em escopo de módulo, nunca em código que vá ao client. Sem `process.env` em `src/`.
- `getAuth(env, request)` e `getDb(env.DB)` são factories por request. Sem singletons. Passe a `request` sempre que tiver uma (handler, `getRequest()`): sem `BETTER_AUTH_URL`, a URL do app vem da origem dela; o Better Auth só deduz sozinho dentro do `handler`, não em `api.getSession`. `tanstackStartCookies()` é sempre o último plugin do Better Auth.
- (teste) **React.lazy só no cliente.** Componente criado com `lazy(() => import(...))` é renderizado dentro de `<ClientOnly>` (de `@tanstack/react-router`), como o `Toaster` e o `Devtools` em `src/routes/__root.tsx`. Motivo: no workerd o `import()` pertence ao pedido que o disparou; com o `lazy` no escopo do módulo, se o primeiro pedido termina antes de o módulo carregar (um `HEAD /`, uma aba fechada), a promessa fica presa ao pedido morto e nenhuma página responde mais até reiniciar o servidor (no log, 2 min depois: `SSR stream transform exceeded maximum lifetime`). O mesmo vale para qualquer promessa guardada em variável de módulo e esperada por outro pedido: não faça. `src/rules.test.ts` confere pelo texto e `npm run test:cold` confere no servidor de verdade.
- D1 é SQLite: sem transação aninhada; use `db.batch([...])` ou uma instrução condicional.
- Aguardar (`await`) toda promise; no `scheduled`, `ctx.waitUntil`.
- Sem `eval`/MDX em runtime e sem filesystem real no Worker.
- `compatibilityDate` sempre atual.

### Antes de mexer na plataforma (Cloudflare)
- Vai mexer em `wrangler.jsonc`, criar ou trocar um binding, ou usar D1, R2, Durable Object, fila, cron, Email Service, rate limit ou deploy de um jeito que este arquivo ainda não descreve? Consulte a fonte ANTES de escrever. A Cloudflare muda rápido e o que o modelo lembra costuma estar velho (nome de campo, limite, preço, forma da API).
- Ordem: a skill `cloudflare-atlas`, se estiver instalada; senão as do plugin oficial da Cloudflare (`cloudflare` para escolher e ligar produtos, `workers-best-practices` para código de Worker, `wrangler` para a config e os comandos, `durable-objects`, `cloudflare-email-service`); sem nenhuma, a página da doc em Markdown: `curl -sL -H "Accept: text/markdown" https://developers.cloudflare.com/<caminho>/`.
- O que as skills NÃO decidem são as regras deste projeto (as seções abaixo). Se a skill e este arquivo divergirem sobre como ESTE app faz algo, vale este arquivo; se divergirem sobre como a plataforma funciona, vale a fonte mais nova, e este arquivo deve ser corrigido.
- Não precisa consultar para o que não toca a plataforma: tela, texto, estilo, rota, teste. Para isso valem `src/CLAUDE.md` e a skill `/tela`.

### Segredos e URL
- Locais em `.dev.vars` (não versionado); a lista de chaves é `.dev.vars.example`, que também alimenta os tipos. Novo segredo? Adicione nos dois e rode `npm run cf-typegen`. Segredo nunca vai em `"vars"`.
- Não usamos `"secrets": { "required": [...] }` no `wrangler.jsonc` de propósito: com ele o `wrangler deploy` exige TODOS os listados, e os opcionais (`RESEND_API_KEY`, `EMAIL_FROM`, `GOOGLE_*`, `GITHUB_*`) bloqueariam o deploy. O código trata string vazia como ausente.
- `BETTER_AUTH_URL` é OPCIONAL: a URL é deduzida da requisição. Para fixar uma URL, crie `BETTER_AUTH_URL` no `.dev.vars` (dev, útil para outra porta) ou como segredo (produção). Não há bloco `"vars"` no `wrangler.jsonc`.
- `appConfig.url` (`src/config/app.ts`) alimenta sitemap, canonical e `og:url`: troque ANTES do build. Com `localhost`, `npm run sitemap` avisa.
- O botão Deploy lê os segredos do `.dev.vars.example` e as descrições do campo `cloudflare.bindings` do `package.json`: segredo novo entra nos dois.
- Produção: `npm run deploy -- --secrets-file .prod.vars` (gitignorado) ou `npx wrangler secret bulk .prod.vars`.

### E-mail
- (teste) Tudo passa por `sendEmail()` em `src/lib/email.ts`. Ordem: Resend (se `RESEND_API_KEY`), binding `EMAIL` do Cloudflare Email Service (`send_email` descomentado no `wrangler.jsonc` e `EMAIL_FROM` definido), senão o e-mail inteiro vai para o console do `npm run dev`. Templates em `src/lib/email-templates.ts`, HTML com estilos inline.
- Não instalar SDK de e-mail; Resend é REST via `fetch`.

### Auth
- Rate limit em todo POST de `/api/auth/*`, exceto sign-out e get-session, por IP (/64 no IPv6) e por e-mail.
- Login com senha vem DESLIGADO (`PASSWORD_LOGIN_ENABLED`); quando ligado, exige verificação de e-mail.
- `getAuth` lança erro se `BETTER_AUTH_SECRET` faltar ou tiver menos de 32 caracteres.
- `sendEmail` lança erro fora do localhost quando não há provedor de e-mail (o login recusa enviar, em vez de só logar o código).
- Demos (`/demo/*`) só existem no `npm run dev`.
- Encerrar conta exige e-mail verificado e sessão com menos de 1 h.
- Job `auditoria.retencao` apaga a auditoria com mais de 180 dias.
- Respostas de `/app*` levam `Cache-Control: no-store`.
- Login principal é o plugin `emailOTP` (6 dígitos, `storeOTP: 'hashed'`, 3 tentativas, 10 min). Sem provedor de e-mail, no localhost o código sai no log (fora dele, o envio falha): `[auth] código de login para <email>: <código>` (o e2e depende dessa linha; não mude o formato).
- Google e GitHub entram só quando o PAR de variáveis existe (`googleEnabled`/`githubEnabled`). O client lê `getAuthProvidersFn` para decidir quais botões mostrar.
- Rotas protegidas: `beforeLoad` com `ensureQueryData(sessionQuery)` e `redirect({ to: '/login', search: { redirect } })`; destino de volta passa por `safeRedirect` (padrão: `/app`). Página logada nova vai em `src/routes/_app/` e herda o guard do `_app.tsx`.
- Mudou plugin ou campo do Better Auth? Ajuste `src/db/auth-schema.ts` e rode `db:generate`. O emailOTP usa a tabela `verification` existente.

### D1 e UUID
- `d1_databases` e `r2_buckets` ficam SEM `database_id`/`bucket_name` de propósito: o Wrangler (e o botão Deploy) criam os recursos no primeiro deploy (provisionamento automático, docs da Cloudflare). Já tem banco? Acrescente `database_id`. Os scripts `db:migrate:*` usam o nome do binding (`DB`). No primeiro deploy manual, rode `npm run build && npx wrangler deploy` uma vez (cria o banco); depois `npm run deploy` (o `predeploy` migra antes de publicar). No botão Deploy (Workers Builds) o comando de deploy é `npx wrangler deploy && npx wrangler d1 migrations apply DB --remote` (migra depois porque o banco só existe depois do primeiro deploy).
- O estado local (D1, R2, DO) fica em `.wrangler/state/` (gitignorado e fora do watch do Vite).

### Conteúdo e prerender
- Páginas públicas (`/`, `/blog*`, `/docs*`, `/termos`, `/privacidade`) são pré-renderizadas no `npm run build` (`prerender` no `vite.config.ts`, allow-list em `src/config/public-paths.ts`). Nada com sessão ou binding em tempo de requisição pode entrar nessa lista: uma cópia estática serviria sem o guard. Rota nova de conteúdo? Adicione lá (e, se for página fixa, em `SITEMAP_STATIC_PATHS`).
- SEO: o `__root.tsx` põe os padrões (canonical, `og:url`, `og:site_name`, `og:image` = `/og.png`, `twitter:card`); cada rota com `head` usa `seo()` de `src/lib/seo.ts` só com o que é dela. Login e a área logada (`/app*`) levam `noindex`. A base das URLs é `appConfig.url`: troque antes de publicar e rode `npm run sitemap`.
- O prerender roda no build com os bindings LOCAIS; não leia D1/R2 em loader de página pré-renderizada.
- Cada coleção MDX tem dois `import.meta.glob` literais (`?meta` eager para listas; lazy para o corpo). Não leia `frontmatter` do módulo compilado: isso põe todos os corpos no bundle principal.

### Área logada (app shell)
- `src/routes/_app.tsx` é rota de LAYOUT (o `_` não entra na URL): guard de sessão, barra lateral no desktop (`lg:`) e `Sheet` no celular, ambos lendo `mainNav`. O `__root.tsx` esconde o cabeçalho e o rodapé públicos quando a rota `/_app` está ativa.
- Página nova: arquivo em `src/routes/_app/app/` + uma linha em `mainNav`. Título com `PageHeader`; números com `StatStrip`/`StatCard` (um por área, cada um é link para a área); o resto com o kit de `src/components/app/` (`PageSection` por assunto, `Toolbar` + `TableFrame` + `EmptyState` para listas, `Field` para campos, `StatusDot` para estado). O molde de cada peça é `/estilo` (`src/routes/estilo.tsx`), o da tela de lista é `src/components/app/exemplo-lista.tsx` e o da mesma lista ligada ao banco é `/app/clientes`; o passo a passo é a skill `/tela`.
- Escrita de usuário logado não usa `isRateLimited` (o limite público travaria o uso normal): protege a sessão, o `userId` no `where` e um teto por pessoa (`CLIENTES_MAX`). Erro de campo aparece no `Field` do campo; os outros viram `toast.error`.
- Peça nova do shadcn (`npx shadcn@latest add`): troque `import { cn } from "cn"` por `#/lib/utils` e desinstale o pacote `cn`, tire `transition-all` e o `rounded-md` fixo de botão, use `bg-brand` no estado ligado, e mostre a peça em `/estilo`.
- Para mostrar nome/foto atualizados, leia `useQuery(sessionQuery)` (o contexto do guard é só o valor inicial) e, depois de mudar, `invalidateQueries(['session'])` + `authClient.$store.notify('$sessionSignal')` (avatar do cabeçalho).
- O checklist de primeiro uso do painel some quando completo ou dispensado (`localStorage`, chave `app-checklist-dispensado`); passo novo precisa ser verificável com dados que a página já tem.
- `/app` está no `ROBOTS_DISALLOW` e fora do `PUBLIC_PATTERNS` (nunca pré-renderizar). `/conta` ficou só como redirect 301.

### Temas e landing
- **Direção visual, as sete regras e as decisões datadas: `src/CLAUDE.md`.** Leia antes de qualquer mudança de aparência. (teste) A cor da marca nunca é cor de texto (`text-brand` sozinho falha; use `bg-brand` + `text-brand-foreground`); peso até 600 (`font-bold`/`extrabold`/`black` falham); nada sobe ou cresce no hover e nunca `transition-all`.
- O hero da landing real tem `visual: 'app'`: texto à esquerda e o painel da área logada desenhado em código (`src/components/landing/app-preview.tsx`) à direita. Mudou o painel em `src/routes/_app/app/`? Espelhe no preview.
- Um tema é SÓ tokens em `src/styles.css`. `data-theme` (autonomia, neutro, editorial, brutal) é o visual, escrito por `theme-provider.tsx`; a classe `dark` (next-themes) é o modo. Nenhum componente lê `data-theme`. Forma que varia por tema vira token (`--radius-btn`, `--radius-card`, `--display-font`, `--shadow-btn`).
- (teste) Botão da ação principal é `<Button variant="brand">`, um por tela; `hover:bg-brand-hover` escrito à mão num componente falha (exceções nomeadas no teste: a variante e os dois estilos de link da landing e das páginas de erro).
- (teste) Cores só pelos tokens (`bg-background`, `text-muted-foreground`, `bg-brand`, `bg-surface`...). Sem hex/`rgb(` em componente (única exceção nomeada no teste: o logo do Google em `social-buttons.tsx`).
- A landing é a lista em `src/content/landing.ts`; a rota `/` não tem texto. São 13 formatos (`hero`, `stats`, `stack`, `logos`, `features`, `bento`, `compare`, `steps`, `terminal`, `gallery`, `testimonials`, `faq`, `cta`); o catálogo com um exemplo de cada é `/blocos` (dados em `src/content/blocos-exemplo.ts`, `noindex`, fora do prerender e no `ROBOTS_DISALLOW`). `/estilo` é a bancada equivalente para as peças de tela, com as mesmas três proteções.
- Formato novo de bloco = tipo em `src/components/landing/types.ts` (props comentadas em pt-BR) + componente em `src/components/landing/blocks/` (os 7 originais em `core.tsx`, um arquivo por formato extra; moldura, cabeçalho e botões em `section.tsx`) + `case` no `render.tsx` + exemplo em `blocos-exemplo.ts`. O typecheck cobra o `case` e o exemplo; `render.test.tsx` confere os três pelo texto e renderiza cada exemplo. Cada bloco sai num invólucro `data-block="<tipo>"`.
- Ícone de bloco só do `lucide-react`, pedido por nome (`icon: 'mail'`) a partir de `src/components/landing/icons.ts`. Imagem de bloco mora em `public/` (`gallery`: `loading="lazy"`, `width`/`height` reais). SVG em string (`logos`) usa `currentColor`. Animação respeita `prefers-reduced-motion` e não esconde conteúdo sem JS (veja `blocks/terminal.tsx`).

### Proteções
- `PUBLIC_RATE_LIMIT` (5/min por IP) cobre os endpoints de login e as escritas públicas; `isRateLimited()` falha ABERTA sem o binding. Endpoint público de escrita novo? Aplique.
- Cabeçalhos de segurança em `src/lib/security-headers.ts` (Worker) e `public/_headers` (assets/páginas estáticas): mantenha os dois iguais. Sem CSP de propósito (scripts inline do TanStack).
- Server functions recusam chamadas cross-site (`same-origin.ts`); use `method: 'POST'` em server function que muda estado. Rota de API que muda estado com o cookie do usuário chama `isCrossSiteRequest(request)` no começo (403), como `api/avatar.ts`.

### Encerramento de conta (duas fases)
- **Encerrar conta é em duas fases.** Fase 1 (`closeAccountFn`, botão "Encerrar conta"): roda os guards, marca `user.deletedAt`, apaga as sessões (num `db.batch`), audita `account.close_requested` e manda o e-mail `accountClosedEmail`. Nada é apagado. Fase 2 (cron `conta.apagar-encerradas`, depois de `ACCOUNT_RETENTION_DAYS` = 7 dias): guards de novo, `onBeforeAccountDelete`, apaga a linha de `user` (cascata em `session`/`account`) e audita `account.deleted` sem e-mail. No dia 5, `conta.lembrar-exclusao` manda `accountPurgeReminderEmail` uma vez (reivindicado por update condicional em `purgeRemindedAt`).
- O `deleteUser` nativo do Better Auth fica DESLIGADO (`user.deleteUser.enabled: false`): ele apaga na hora e pularia o prazo. `deletedAt`/`purgeRemindedAt` são `additionalFields` com `input: false` (o cliente não escreve).
- Conta encerrada não entra: `databaseHooks.session.create.before` recusa com `ACCOUNT_CLOSED` (o formulário de código mostra a mensagem). Restaurar = `deleted_at = NULL` no D1 (é ação do suporte).
- Módulo novo com dado do usuário fora do D1 ou que deva sair no "baixar meus dados"? Registre em `src/lib/account-handlers.ts`: `onAccountDeletionGuard` (só confere; lance `AccountDeletionBlocked('mensagem em pt-BR')`), `onBeforeAccountDelete` (limpeza), `onAccountExport('chave', fn)` (nunca exporte token ou hash de senha). Os registros carregam pelo import em `src/server.ts`.

### Foto de perfil (R2)
- **Avatar tem limite**: PNG, JPEG ou WebP, até 2 MB (`AVATAR_MAX_BYTES`/`AVATAR_TYPES` em `src/lib/avatar.ts`). O tipo gravado vem dos primeiros bytes (`detectImageType`), não do que o navegador declarou.
- `POST /api/avatar`: same-origin → sessão (401) → `isRateLimited('avatar')` (429) → multipart com um campo `file` → grava em `env.BUCKET` na chave `avatars/<userId>` → `user.image = /api/avatar/<userId>?v=<timestamp>` → auditoria `account.avatar_set`. Não há "remover", só substituir.
- `GET /api/avatar/<userId>`: público, `Cache-Control: public, max-age=31536000, immutable` (a URL muda a cada troca) e `ETag` (responde 304 com `If-None-Match`). Id inválido ou sem foto: 404.
- Cron diário (03:00 UTC) roda `runJobs` em `src/lib/jobs.ts`; jobs precisam ser idempotentes. Hoje: `auth.limpar-expirados`, `conta.lembrar-exclusao`, `conta.apagar-encerradas` (no máximo 25 contas por noite).

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
- **Devtools do TanStack** só em dev (`src/components/devtools.tsx`, carregado atrás de `import.meta.env.DEV`) e só no navegador (`<ClientOnly>`).
- **O `npm run dev` travava com o primeiro pedido abandonado (2026-11-10).** Causa: o `lazy()` do Devtools era renderizado no servidor (veja "React.lazy só no cliente" nas Regras). Aparecia com qualquer ferramenta que confere o servidor com `HEAD /` usando User-Agent de navegador (o painel de preview do Claude faz isso a cada 2 s) ou com uma aba fechada no meio da primeira carga. Com User-Agent de robô (`curl`) não aparecia, porque aí o TanStack espera a página inteira antes de responder. Produção nunca foi afetada: lá o `Devtools` é `() => null`.
- `env.COUNTER` já vem tipado como `DurableObjectNamespace<Counter>` pelo `wrangler types`: sem cast.

<!-- intent-skills:start -->
# TanStack Intent - before editing files, run the matching guidance command.
tanstackIntent:
  - id: "@tanstack/devtools#devtools-app-setup"
    run: "npm exec --no -- intent load @tanstack/devtools#devtools-app-setup"
    for: "Install TanStack Devtools, pick framework adapter (React/Vue/Solid/Preact), register plugins via plugins prop, configure shell (position, hotkeys, theme, hideUntilHover, requireUrlFlag, eventBusConfig). TanStackDevtools component, defaultOpen, localStorage persistence."
  - id: "@tanstack/devtools#devtools-marketplace"
    run: "npm exec --no -- intent load @tanstack/devtools#devtools-marketplace"
    for: "Publish plugin to npm and submit to TanStack Devtools Marketplace. PluginMetadata registry format, plugin-registry.ts, pluginImport (importName, type), requires (packageName, minVersion), framework tagging, multi-framework submissions, featured plugins."
  - id: "@tanstack/devtools#devtools-plugin-panel"
    run: "npm exec --no -- intent load @tanstack/devtools#devtools-plugin-panel"
    for: "Build devtools panel components that display emitted event data. Listen via EventClient.on(), handle theme (light/dark), use @tanstack/devtools-ui components. Plugin registration (name, render, id, defaultOpen), lifecycle (mount, activate, destroy), max 3 active plugins. Two paths: Solid.js core with devtools-ui for multi-framework support, or framework-specific panels."
  - id: "@tanstack/devtools#devtools-production"
    run: "npm exec --no -- intent load @tanstack/devtools#devtools-production"
    for: "Handle devtools in production vs development. removeDevtoolsOnBuild, devDependency vs regular dependency, conditional imports, NoOp plugin variants for tree-shaking, non-Vite production exclusion patterns."
  - id: "@tanstack/devtools-event-client#devtools-bidirectional"
    run: "npm exec --no -- intent load @tanstack/devtools-event-client#devtools-bidirectional"
    for: "Two-way event patterns between devtools panel and application. App-to-devtools observation, devtools-to-app commands, time-travel debugging with snapshots and revert. structuredClone for snapshot safety, distinct event suffixes for observation vs commands, serializable payloads only."
  - id: "@tanstack/devtools-event-client#devtools-event-client"
    run: "npm exec --no -- intent load @tanstack/devtools-event-client#devtools-event-client"
    for: "Create typed EventClient for a library. Define event maps with typed payloads, pluginId auto-prepend namespacing, emit()/on()/onAll()/onAllPluginEvents() API. Connection lifecycle (5 retries, 300ms), event queuing, enabled/disabled state, SSR fallbacks, singleton pattern. Unique pluginId requirement to avoid event collisions."
  - id: "@tanstack/devtools-event-client#devtools-instrumentation"
    run: "npm exec --no -- intent load @tanstack/devtools-event-client#devtools-instrumentation"
    for: "Analyze library codebase for critical architecture and debugging points, add strategic event emissions. Identify middleware boundaries, state transitions, lifecycle hooks. Consolidate events (1 not 15), debounce high-frequency updates, DRY shared payload fields, guard emit() for production. Transparent server/client event bridging."
  - id: "@tanstack/devtools-vite#devtools-vite-plugin"
    run: "npm exec --no -- intent load @tanstack/devtools-vite#devtools-vite-plugin"
    for: "Configure @tanstack/devtools-vite for source inspection (data-tsd-source, inspectHotkey, ignore patterns), console piping (client-to-server, server-to-client, levels), enhanced logging, server event bus (port, host, HTTPS), production stripping (removeDevtoolsOnBuild), editor integration (launch-editor, custom editor.open). Must be FIRST plugin in Vite config. Vite ^6 || ^7 only."
  - id: "@tanstack/match-sorter-utils#fuzzy-ranking"
    run: "npm exec --no -- intent load @tanstack/match-sorter-utils#fuzzy-ranking"
    for: "Rank fuzzy matches with rankItem, filter with RankingInfo.passed, compare saved ranking metadata with compareItems, and configure rankings, thresholds, accessors, min/max bounds, or diacritics. Load for @tanstack/match-sorter-utils itself or fuzzy Table filterMeta wiring."
  - id: "@tanstack/react-router#compositions/router-query"
    run: "npm exec --no -- intent load @tanstack/react-router#compositions/router-query"
    for: "Integrating TanStack Router with TanStack Query: queryClient in router context, static queries and fire-and-forget queries in loaders, useSuspenseQuery in components, defaultPreloadStaleTime: 0, setupRouterSsrQueryIntegration for SSR dehydration/hydration and streaming, per-request QueryClient isolation."
  - id: "@tanstack/react-router#lifecycle/migrate-from-react-router"
    run: "npm exec --no -- intent load @tanstack/react-router#lifecycle/migrate-from-react-router"
    for: "Step-by-step migration from React Router v7 to TanStack Router: route definition conversion, Link/useNavigate API differences, useSearchParams to validateSearch + useSearch, useParams with from, Outlet replacement, loader conversion, code splitting differences."
  - id: "@tanstack/react-router#react-router"
    run: "npm exec --no -- intent load @tanstack/react-router#react-router"
    for: "React bindings for TanStack Router: RouterProvider, useRouter, useRouterState, useMatch, useMatches, useLocation, useSearch, useParams, useNavigate, useLoaderData, useLoaderDeps, useRouteContext, useBlocker, useCanGoBack, Link, Navigate, Outlet, CatchBoundary, ErrorComponent. React-specific patterns for hooks, providers, SSR hydration, and createLink with forwardRef."
  - id: "@tanstack/react-start#lifecycle/migrate-from-nextjs"
    run: "npm exec --no -- intent load @tanstack/react-start#lifecycle/migrate-from-nextjs"
    for: "Step-by-step migration from Next.js App Router to TanStack Start: route definition conversion, API mapping, server function conversion from Server Actions, middleware conversion, data fetching pattern changes."
  - id: "@tanstack/react-start#react-start"
    run: "npm exec --no -- intent load @tanstack/react-start#react-start"
    for: "React bindings for TanStack Start: createStart, StartClient, StartServer, React-specific imports, re-exports from @tanstack/react-router, full project setup with React, useServerFn hook."
  - id: "@tanstack/react-start#react-start/server-components"
    run: "npm exec --no -- intent load @tanstack/react-start#react-start/server-components"
    for: "Implement, review, debug, and refactor TanStack Start React Server Components in React 19 apps. Use when tasks mention @tanstack/react-start/rsc, renderServerComponent, createCompositeComponent, CompositeComponent, renderToReadableStream, createFromReadableStream, createFromFetch, Composite Components, React Flight streams, loader or query owned RSC caching, router.invalidate, structuralSharing: false, selective SSR, stale names like renderRsc or .validator, or migration from Next App Router RSC patterns. Do not use for generic SSR or non-TanStack RSC frameworks except brief comparison."
  - id: "@tanstack/router-core#router-core"
    run: "npm exec --no -- intent load @tanstack/router-core#router-core"
    for: "Framework-agnostic core concepts for TanStack Router: route trees, createRouter, createRoute, createRootRoute, createRootRouteWithContext, addChildren, Register type declaration, route matching, route sorting, file naming conventions. Entry point for all router skills."
  - id: "@tanstack/router-core#router-core/auth-and-guards"
    run: "npm exec --no -- intent load @tanstack/router-core#router-core/auth-and-guards"
    for: "Route protection with beforeLoad, redirect()/throw redirect(), isRedirect helper, authenticated layout routes (_authenticated), non-redirect auth (inline login), RBAC with roles and permissions, auth provider integration (Auth0, Clerk, Supabase), router context for auth state."
  - id: "@tanstack/router-core#router-core/code-splitting"
    run: "npm exec --no -- intent load @tanstack/router-core#router-core/code-splitting"
    for: "Automatic code splitting (autoCodeSplitting), .lazy.tsx convention, createLazyFileRoute, createLazyRoute, lazyRouteComponent, getRouteApi for typed hooks in split files, codeSplitGroupings per-route override, splitBehavior programmatic config, critical vs non-critical properties."
  - id: "@tanstack/router-core#router-core/data-loading"
    run: "npm exec --no -- intent load @tanstack/router-core#router-core/data-loading"
    for: "Route loader option, loaderDeps for cache keys, staleTime/gcTime/ defaultPreloadStaleTime SWR caching, pendingComponent/pendingMs/ pendingMinMs, errorComponent/onError/onCatch, beforeLoad, router context and createRootRouteWithContext DI pattern, router.invalidate, Await component, deferred data loading with unawaited promises."
  - id: "@tanstack/router-core#router-core/navigation"
    run: "npm exec --no -- intent load @tanstack/router-core#router-core/navigation"
    for: "Link component, useNavigate, Navigate component, router.navigate, ToOptions/NavigateOptions/LinkOptions, from/to relative navigation, activeOptions/activeProps, preloading (intent/viewport/render), preloadDelay, navigation blocking (useBlocker, Block), createLink, linkOptions helper, scroll restoration, MatchRoute."
  - id: "@tanstack/router-core#router-core/not-found-and-errors"
    run: "npm exec --no -- intent load @tanstack/router-core#router-core/not-found-and-errors"
    for: "notFound() function, notFoundComponent, defaultNotFoundComponent, notFoundMode (fuzzy/root), errorComponent, CatchBoundary, CatchNotFound, isNotFound, NotFoundRoute (deprecated), route masking (mask option, createRouteMask, unmaskOnReload)."
  - id: "@tanstack/router-core#router-core/path-params"
    run: "npm exec --no -- intent load @tanstack/router-core#router-core/path-params"
    for: "Dynamic path segments ($paramName), splat routes ($ / _splat), optional params ({-$paramName}), prefix/suffix patterns ({$param}.ext), useParams, params.parse/stringify, pathParamsAllowedCharacters, i18n locale patterns."
  - id: "@tanstack/router-core#router-core/search-params"
    run: "npm exec --no -- intent load @tanstack/router-core#router-core/search-params"
    for: "validateSearch, search param validation with Zod/Valibot/ArkType adapters, fallback(), search middlewares (retainSearchParams, stripSearchParams), custom serialization (parseSearch, stringifySearch), search param inheritance, loaderDeps for cache keys, reading and writing search params."
  - id: "@tanstack/router-core#router-core/ssr"
    run: "npm exec --no -- intent load @tanstack/router-core#router-core/ssr"
    for: "Non-streaming and streaming SSR, RouterClient/RouterServer, renderRouterToString/renderRouterToStream, createRequestHandler, defaultRenderHandler/defaultStreamHandler, HeadContent/Scripts components, head route option (meta/links/styles/scripts), ScriptOnce, automatic loader dehydration/hydration, memory history on server, data serialization, document head management."
  - id: "@tanstack/router-core#router-core/type-safety"
    run: "npm exec --no -- intent load @tanstack/router-core#router-core/type-safety"
    for: "Full type inference philosophy (never cast, never annotate inferred values), Register module declaration, from narrowing on hooks and Link, strict:false for shared components, getRouteApi for code-split typed access, addChildren with object syntax for TS perf, LinkProps and ValidateLinkOptions type utilities, as const satisfies pattern."
  - id: "@tanstack/router-plugin#router-plugin"
    run: "npm exec --no -- intent load @tanstack/router-plugin#router-plugin"
    for: "TanStack Router bundler plugin for route generation and automatic code splitting. Supports Vite, Webpack, Rspack, and esbuild. Configures autoCodeSplitting, routesDirectory, target framework, and code split groupings."
  - id: "@tanstack/start-client-core#start-core"
    run: "npm exec --no -- intent load @tanstack/start-client-core#start-core"
    for: "Core overview for TanStack Start: tanstackStart() Vite plugin, getRouter() factory, root route document shell (HeadContent, Scripts, Outlet), client/server entry points, routeTree.gen.ts, tsconfig configuration. Entry point for all Start skills."
  - id: "@tanstack/start-client-core#start-core/auth-server-primitives"
    run: "npm exec --no -- intent load @tanstack/start-client-core#start-core/auth-server-primitives"
    for: "Server-side authentication primitives for TanStack Start: session cookies (HttpOnly, Secure, SameSite, __Host- prefix), session read/issue/destroy via createServerFn and middleware, OAuth authorization-code flow with state and PKCE, password-reset enumeration defense, CSRF for non-GET RPCs, rate limiting auth endpoints, session rotation on privilege change. Pairs with router-core/auth-and-guards for the routing side."
  - id: "@tanstack/start-client-core#start-core/deployment"
    run: "npm exec --no -- intent load @tanstack/start-client-core#start-core/deployment"
    for: "Deploy to Cloudflare Workers, Netlify, Vercel, Node.js/Docker, Bun, Railway. Selective SSR (ssr option per route), SPA mode, static prerendering, ISR with Cache-Control headers, SEO and head management."
  - id: "@tanstack/start-client-core#start-core/execution-model"
    run: "npm exec --no -- intent load @tanstack/start-client-core#start-core/execution-model"
    for: "Isomorphic-by-default principle, environment boundary functions (createServerFn, createServerOnlyFn, createClientOnlyFn, createIsomorphicFn), ClientOnly component, useHydrated hook, import protection, dead code elimination, environment variable safety (VITE_ prefix, process.env)."
  - id: "@tanstack/start-client-core#start-core/middleware"
    run: "npm exec --no -- intent load @tanstack/start-client-core#start-core/middleware"
    for: "createMiddleware, request middleware (.server only), server function middleware (.client + .server), context passing via next({ context }), sendContext for client-server transfer, global middleware via createStart in src/start.ts, middleware factories, method order enforcement, fetch override precedence."
  - id: "@tanstack/start-client-core#start-core/server-functions"
    run: "npm exec --no -- intent load @tanstack/start-client-core#start-core/server-functions"
    for: "createServerFn (GET/POST), validator (Zod or function), useServerFn hook, server context utilities (getRequest, getRequestHeader, setResponseHeader, setResponseStatus), error handling (throw errors, redirect, notFound), streaming, FormData handling, file organization (.functions.ts, .server.ts)."
  - id: "@tanstack/start-client-core#start-core/server-routes"
    run: "npm exec --no -- intent load @tanstack/start-client-core#start-core/server-routes"
    for: "Server-side API endpoints using the server property on createFileRoute, HTTP method handlers (GET, POST, PUT, DELETE), createHandlers for per-handler middleware, handler context (request, params, context), request body parsing, response helpers, file naming for API routes."
  - id: "@tanstack/start-server-core#start-server-core"
    run: "npm exec --no -- intent load @tanstack/start-server-core#start-server-core"
    for: "Server-side runtime for TanStack Start: createStartHandler, request/response utilities (getRequest, setResponseHeader, setCookie, getCookie, appendResponseHeader), three-phase request handling, AsyncLocalStorage context."
  - id: "@tanstack/virtual-file-routes#virtual-file-routes"
    run: "npm exec --no -- intent load @tanstack/virtual-file-routes#virtual-file-routes"
    for: "Programmatic route tree building as an alternative to filesystem conventions: rootRoute, index, route, layout, physical, defineVirtualSubtreeConfig. Use with TanStack Router plugin's virtualRouteConfig option."
<!-- intent-skills:end -->
