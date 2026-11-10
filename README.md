# tanstack-cloudflare-template

Um app completo rodando inteiro em um único Cloudflare Worker: landing, login
sem senha (código por e-mail), banco de dados, arquivos, e-mail, tarefas
agendadas, blog e docs. Feito para você clonar, trocar o texto e publicar.

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/thaleslaray/tanstack-cloudflare-template)

> **O que o botão faz.** Clona o repositório para a sua conta do GitHub/GitLab,
> cria o Worker, o banco D1 e o bucket R2 (o Durable Object vem junto) e publica.
> Ele liga o **Workers Builds**: **a partir daí, todo push na `main` publica o
> app** (inclusive PRs do Dependabot depois de mesclados; só mescle com o CI verde).
> Na tela de configuração:
>
> - **Build command:** `npm run build`
> - **Deploy command:** `npx wrangler deploy && npx wrangler d1 migrations apply DB --remote`
>   (a Cloudflare usa `npx wrangler deploy` por padrão e deixa trocar. Aqui o banco
>   só existe depois do primeiro deploy, então a migração vai **depois** dele.
>   Por isso não é `npm run deploy`, que migra antes).
> - **Segredos:** a tela pede os do `.dev.vars.example`. Preencha `BETTER_AUTH_SECRET`
>   (obrigatório) e, **para o login funcionar**, `RESEND_API_KEY` e `EMAIL_FROM`.
>   Sem provedor de e-mail em produção, o login **recusa enviar** o código.
> - Antes de clicar, troque `url` em `src/config/app.ts` pela URL pública
>   (sitemap, canonical e `og:url` saem do build).

## Pré-requisitos

- **Node.js 22 ou mais novo** (`node -v`), **npm** (vem com o Node) e **git**.
- Conta na Cloudflare só para publicar; rodar local não precisa.

## Começar em cinco comandos

```bash
git clone <url-do-seu-repositorio> meu-app && cd meu-app
npm install
cp .dev.vars.example .dev.vars        # depois cole um segredo em BETTER_AUTH_SECRET (abaixo)
npm run db:migrate:local
npm run dev                           # http://localhost:3000
```

Para gerar o segredo (mínimo de 32 caracteres): `openssl rand -base64 32`. No
Windows, sem `openssl`:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Avisos do `npm install` (como `peer dependency`) pode ignorar; só erro importa.

`npm run e2e` (opcional, Playwright) precisa da porta 3000 **livre**: não rode
junto com o `npm run dev` (ou use `E2E_PORT=3001 npm run e2e`, com
`BETTER_AUTH_URL=http://localhost:3001` no `.dev.vars`). Na primeira vez rode
`npx playwright install chromium`.

Abra http://localhost:3000/login e peça um código. Sem provedor de e-mail
configurado, ele aparece no terminal do `npm run dev`:

```
[auth] código de login para voce@exemplo.com: 123456
```

O login com senha é opcional e vem desligado (`PASSWORD_LOGIN_ENABLED=true` no `.dev.vars` liga). As demos em `/demo/*` só existem no `npm run dev`.

Com o Claude Code aberto na pasta, `/setup` faz tudo isso, `/google-oauth`
liga o login com Google, `/tela` cria uma tela nova no visual do app (peça
"cria uma tela de clientes") e `/deploy` publica.

## O que vem na caixa

| Camada | Escolha |
| --- | --- |
| Framework | TanStack Start (React 19) + TanStack Router e Query |
| Runtime | Cloudflare Workers, via `@cloudflare/vite-plugin` v1 e Wrangler (as versões estáveis) |
| Banco | Cloudflare D1 (SQLite) com Drizzle ORM e migrações geradas |
| Login | Better Auth: código de 6 dígitos por e-mail, Google e GitHub opcionais, senha opcional |
| Área logada | `/app` com barra lateral (gaveta no celular): painel com números e checklist de primeiro uso, e `/app/configuracoes` (nome, foto, baixar meus dados, encerrar conta) |
| Foto de perfil | Upload para o R2 (PNG/JPEG/WebP, até 2 MB), servida com cache longo e ETag |
| Conta | Encerramento em duas fases (sai na hora, apagada pelo cron em 7 dias, lembrete no dia 5) e "baixar meus dados" em JSON |
| Auditoria | `audit()` com sinks; o padrão grava login, troca de nome, foto e encerramento na tabela `audit_log` |
| E-mail | `src/lib/email.ts`: Resend, Cloudflare Email Service ou o terminal (sem chave) |
| Arquivos | R2 (foto de perfil e demo em `/demo/r2`) |
| Estado | Durable Object `Counter` (demo em `/demo/durable-object`) |
| Conteúdo | MDX para blog, docs, termos e privacidade, pré-renderizados no build |
| UI | Tailwind v4 + shadcn/ui, landing montada de `src/content/landing.ts` com 13 formatos de bloco (catálogo em `/blocos`), kit de peças de tela (bancada em `/estilo`), quatro temas em claro e escuro |
| Proteções | Rate limit por IP, cabeçalhos de segurança, cron diário limpando sessões vencidas e apagando contas encerradas |
| Qualidade | Biome, Vitest (com as regras do `AGENTS.md` como teste), Playwright (4 specs) |
| Agentes | `AGENTS.md` (as regras; o `CLAUDE.md` aponta para ele), `src/CLAUDE.md` (visual) e skills em `.claude/skills/` |

## Scripts

| Script | O que faz |
| --- | --- |
| `npm run dev` | `vite dev --port 3000`: o app em workerd local com D1, R2 e DO simulados |
| `npm run build` | `vite build`: build de produção com prerender das páginas públicas |
| `npm run sitemap` | gera `public/sitemap.xml` e `public/robots.txt` (roda sozinho antes do build) |
| `npm run preview` | build e depois serve a saída de produção localmente |
| `npm run deploy` | migra o banco remoto (`predeploy`), faz o build e `wrangler deploy` |
| `npm run cf-typegen` | gera `worker-configuration.d.ts` (os tipos do `env`) a partir do `wrangler.jsonc` |
| `npm run typecheck` | `cf-typegen` e depois o `tsc` |
| `npm run check` | Biome (lint + formatação); `check:fix` corrige |
| `npm run test` | Vitest (unidades) |
| `npm run e2e` | Playwright contra o servidor de dev (ele sobe o servidor sozinho) |
| `npm run db:generate` | gera a migração a partir de `src/db/*.ts` |
| `npm run db:migrate:local` / `:remote` | aplica as migrações no D1 local / remoto |

## Onde mudar o quê

- **Nome, descrição, URL pública (SEO e sitemap) e e-mail de suporte**: `src/config/app.ts`
- **Landing**: `src/content/landing.ts` (é uma lista de blocos; a rota só renderiza). Para ver os 13 formatos e copiar um, abra `/blocos` (dados em `src/content/blocos-exemplo.ts`)
- **Tema padrão e cores**: `src/config/themes.ts` e os blocos de tokens em `src/styles.css`
- **Tabelas**: `src/db/schema.ts` → `npm run db:generate` → `npm run db:migrate:local`
- **Telas**: `src/routes/` (uma rota por arquivo; as demos mostram cada peça)
- **Área logada**: páginas em `src/routes/_app/` e o menu em `mainNav` (`src/components/app-sidebar.tsx`)
- **Blog, docs, termos, privacidade**: `content/`
- **Bindings e cron**: `wrangler.jsonc` (a lista de segredos é o `.dev.vars.example`)

## Publicar

Resumo do que `/deploy` faz (detalhes em [content/docs/deploy.mdx](content/docs/deploy.mdx)).
O `wrangler.jsonc` não tem `database_id` nem `bucket_name`: o Wrangler cria o
banco D1 e o bucket R2 no primeiro deploy (provisionamento automático).

1. Troque `url` em `src/config/app.ts` pela URL pública.
2. `npx wrangler login`
3. Crie `.prod.vars` com os segredos de produção (nomes do `.dev.vars.example`;
   inclua `RESEND_API_KEY` e `EMAIL_FROM`, senão o login recusa enviar).
4. Primeiro deploy: `npm run build && npx wrangler deploy --secrets-file .prod.vars`
   (cria banco e bucket), depois `npm run db:migrate:remote`.
5. Deploys seguintes: `npm run deploy` (o `predeploy` aplica as migrações antes de publicar).

`BETTER_AUTH_URL` é opcional: a URL vem da requisição.

## CI e publicação automática

O GitHub Actions (`.github/workflows/ci.yml`) roda em todo push na `main` e em todo
pull request: tipos, Biome, testes, build, `wrangler deploy --dry-run` e a checagem
de que o schema e as migrações combinam. O CI **nunca publica**; o Playwright
(`e2e.yml`) roda à mão e toda segunda. Já o botão **Deploy to Cloudflare** (Workers
Builds) **publica a cada push na `main`**: são coisas separadas.

## Por que Wrangler, e não o `cf`

A Cloudflare está lançando um CLI novo, o **`cf`**, junto com a versão 2 do
plugin do Vite (config em `cloudflare.config.ts`). Os dois ainda estão em
**beta**. Como este template é para quem está começando, ele usa o caminho
estável e documentado no guia oficial do TanStack Start: **Wrangler +
`@cloudflare/vite-plugin` v1**, com a configuração em `wrangler.jsonc`.

As dependências usam `^` e o `package-lock.json` é versionado: quem clona
recebe o que está no lock. O Dependabot abre PRs semanais; antes de mesclar,
confira que o CI está verde (e `npm run e2e` para mudanças maiores).

Quando o `cf` sair do beta, `npx cf migrate` converte o projeto. A versão
com `cf` já existe, guardada na branch `cf-v2-beta`. Até lá, não instale o
`cf` nem crie `cloudflare.config.ts` aqui: misturar os dois quebra o deploy.

## Licença

MIT.
