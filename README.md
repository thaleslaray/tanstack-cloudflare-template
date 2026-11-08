# tanstack-cloudflare-template

Um app completo rodando inteiro em um único Cloudflare Worker: landing, login
sem senha (código por e-mail), banco de dados, arquivos, e-mail, tarefas
agendadas, blog e docs. Feito para você clonar, trocar o texto e publicar.

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/SEU_USUARIO/tanstack-cloudflare-template)

> O botão clona o repositório na sua conta Cloudflare e cria o Worker. Na tela
> de configuração use **build command** `npm run build` e **deploy command**
> `npx wrangler deploy`. Depois siga a seção [Publicar](#publicar) para
> criar o banco e subir os segredos (o botão não faz isso por você).

## Começar em cinco comandos

```bash
npm install
cp .dev.vars.example .dev.vars        # depois cole um `openssl rand -base64 32` em BETTER_AUTH_SECRET
npm run db:migrate:local
npm run dev                           # http://localhost:3000
npm run e2e                           # opcional: Playwright de ponta a ponta
```

Abra http://localhost:3000/login e peça um código. Sem provedor de e-mail
configurado, ele aparece no terminal do `npm run dev`:

```
[auth] código de login para voce@exemplo.com: 123456
```

Com o Claude Code aberto na pasta, `/setup` faz tudo isso, `/google-oauth`
liga o login com Google e `/deploy` publica.

## O que vem na caixa

| Camada | Escolha |
| --- | --- |
| Framework | TanStack Start (React 19) + TanStack Router e Query |
| Runtime | Cloudflare Workers, via `@cloudflare/vite-plugin` v1 e Wrangler (as versões estáveis) |
| Banco | Cloudflare D1 (SQLite) com Drizzle ORM e migrações geradas |
| Login | Better Auth: código de 6 dígitos por e-mail, Google e GitHub opcionais, senha opcional |
| E-mail | `src/lib/email.ts`: Resend, Cloudflare Email Service ou o terminal (sem chave) |
| Arquivos | R2 (demo em `/demo/r2`) |
| Estado | Durable Object `Counter` (demo em `/demo/durable-object`) |
| Conteúdo | MDX para blog, docs, termos e privacidade, pré-renderizados no build |
| UI | Tailwind v4 + shadcn/ui, landing montada de `src/content/landing.ts`, quatro temas em claro e escuro |
| Proteções | Rate limit por IP, cabeçalhos de segurança, cron diário limpando sessões vencidas |
| Qualidade | Biome, Vitest, Playwright (3 specs) |
| Agentes | `CLAUDE.md`, `AGENTS.md` e skills em `.claude/skills/` |

## Scripts

| Script | O que faz |
| --- | --- |
| `npm run dev` | `vite dev --port 3000`: o app em workerd local com D1, R2 e DO simulados |
| `npm run build` | `vite build`: build de produção com prerender das páginas públicas |
| `npm run sitemap` | gera `public/sitemap.xml` e `public/robots.txt` (roda sozinho antes do build) |
| `npm run preview` | build e depois serve a saída de produção localmente |
| `npm run deploy` | build e `wrangler deploy` (na primeira vez: `npm run deploy -- --secrets-file .prod.vars`) |
| `npm run cf-typegen` | gera `worker-configuration.d.ts` (os tipos do `env`) a partir do `wrangler.jsonc` |
| `npm run typecheck` | `cf-typegen` e depois o `tsc` |
| `npm run check` | Biome (lint + formatação); `check:fix` corrige |
| `npm run test` | Vitest (unidades) |
| `npm run e2e` | Playwright contra o servidor de dev (ele sobe o servidor sozinho) |
| `npm run db:generate` | gera a migração a partir de `src/db/*.ts` |
| `npm run db:migrate:local` / `:remote` | aplica as migrações no D1 local / remoto |

## Onde mudar o quê

- **Nome, descrição, URL pública (SEO e sitemap) e e-mail de suporte**: `src/config/app.ts`
- **Landing**: `src/content/landing.ts` (é uma lista de blocos; a rota só renderiza)
- **Tema padrão e cores**: `src/config/themes.ts` e os blocos de tokens em `src/styles.css`
- **Tabelas**: `src/db/schema.ts` → `npm run db:generate` → `npm run db:migrate:local`
- **Telas**: `src/routes/` (uma rota por arquivo; as demos mostram cada peça)
- **Blog, docs, termos, privacidade**: `content/`
- **Bindings, cron, variáveis**: `wrangler.jsonc` (a lista de segredos é o `.dev.vars.example`)

## Publicar

Resumo do que `/deploy` faz (detalhes em [content/docs/deploy.mdx](content/docs/deploy.mdx)):

1. `npx wrangler login`
2. `npx wrangler d1 create tanstack-cloudflare-template-db` e cole o
   `database_id` que ele mostrar no lugar de `REPLACE_ME`, no `wrangler.jsonc`.
3. `npx wrangler r2 bucket create tanstack-cloudflare-template-files`
4. `npm run db:migrate:remote`
5. Troque `BETTER_AUTH_URL` (em `"vars"`, no `wrangler.jsonc`) pela URL pública.
6. Crie `.prod.vars` com os segredos de produção (mesmos nomes do `.dev.vars.example`).
7. `npx wrangler deploy --dry-run` e depois `npm run deploy -- --secrets-file .prod.vars`
   (ou suba os segredos à parte com `npx wrangler secret bulk .prod.vars`).

## CI

Todo push na `main` e todo pull request rodam no GitHub Actions
(`.github/workflows/ci.yml`) tipos, Biome, testes, build, `wrangler deploy --dry-run`
e a checagem de que o schema e as migrações combinam; o Playwright (`e2e.yml`)
roda à mão e toda segunda, e nada é publicado automaticamente.

## Por que Wrangler, e não o `cf`

A Cloudflare está lançando um CLI novo, o **`cf`**, junto com a versão 2 do
plugin do Vite (config em `cloudflare.config.ts`). Os dois ainda estão em
**beta**. Como este template é para quem está começando, ele usa o caminho
estável e documentado no guia oficial do TanStack Start: **Wrangler +
`@cloudflare/vite-plugin` v1**, com a configuração em `wrangler.jsonc`.

As versões ficam **fixadas** no `package.json` (`wrangler@4.158.0` e
`@cloudflare/vite-plugin@1.67.0`). Atualize de propósito e rode
`npm run typecheck`, `npm run build` e `npm run e2e` antes de commitar.

Quando o `cf` sair do beta, `npx cf migrate` converte o projeto. A versão
com `cf` já existe, guardada na branch `cf-v2-beta`. Até lá, não instale o
`cf` nem crie `cloudflare.config.ts` aqui: misturar os dois quebra o deploy.

## Licença

MIT.
