# tanstack-cloudflare-template

Um app completo rodando inteiro em um único Cloudflare Worker: landing, login
sem senha (código por e-mail), banco de dados, arquivos, e-mail, tarefas
agendadas, blog e docs. Feito para você clonar, trocar o texto e publicar.

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/SEU_USUARIO/tanstack-cloudflare-template)

> O botão clona o repositório na sua conta Cloudflare e cria o Worker. Na tela
> de configuração use **build command** `npm run build` e **deploy command**
> `npx cf deploy --prebuilt`. Depois siga a seção [Publicar](#publicar) para
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
| Runtime | Cloudflare Workers, via Vite plugin v2 beta e CLI `cf` (sem Wrangler) |
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
| `npm run dev` | `cf dev`: o app em workerd local com D1, R2 e DO simulados (porta 3000; `PORT=3001` muda) |
| `npm run build` | `cf build`: build de produção com prerender das páginas públicas |
| `npm run deploy` | `cf deploy` (use `--secrets-file .prod.vars` na primeira vez) |
| `npm run typecheck` | gera os tipos dos bindings e roda o `tsc` |
| `npm run check` | Biome (lint + formatação); `check:fix` corrige |
| `npm run test` | Vitest (unidades) |
| `npm run e2e` | Playwright contra o `cf dev` (ele sobe o servidor sozinho) |
| `npm run db:generate` | gera a migração a partir de `src/db/*.ts` |
| `npm run db:migrate:local` / `:remote` | aplica as migrações no D1 local / remoto |

## Onde mudar o quê

- **Nome, descrição e e-mail de suporte**: `src/config/app.ts`
- **Landing**: `src/content/landing.ts` (é uma lista de blocos; a rota só renderiza)
- **Tema padrão e cores**: `src/config/themes.ts` e os blocos de tokens em `src/styles.css`
- **Tabelas**: `src/db/schema.ts` → `npm run db:generate` → `npm run db:migrate:local`
- **Telas**: `src/routes/` (uma rota por arquivo; as demos mostram cada peça)
- **Blog, docs, termos, privacidade**: `content/`
- **Bindings, cron, segredos declarados**: `cloudflare.config.ts`

## Publicar

Resumo do que `/deploy` faz (detalhes em [content/docs/deploy.mdx](content/docs/deploy.mdx)):

1. `npx cf auth login`
2. `npx cf d1 create --name tanstack-cloudflare-template-db` e troque o UUID
   placeholder `11111111-1111-4111-8111-111111111111` nos três lugares
   (`cloudflare.config.ts` e os dois scripts `db:migrate:*` do `package.json`).
3. `npx cf r2 buckets create --name tanstack-cloudflare-template-files`
4. `npm run db:migrate:remote`
5. Troque `BETTER_AUTH_URL` em `cloudflare.config.ts` pela URL pública.
6. Crie `.prod.vars` com os segredos de produção (mesmos nomes do `.dev.vars.example`).
7. `npx cf deploy --dry-run` e depois `npx cf deploy --secrets-file .prod.vars`

## O que é "beta" aqui

Este template usa duas peças novas da Cloudflare:

- **`cf`**, o novo CLI unificado, que substitui o Wrangler para dev, build e
  deploy, e lê a configuração de `cloudflare.config.ts` (TypeScript tipado).
- **`@cloudflare/vite-plugin` v2**, que roda o app dentro do workerd no
  `vite dev` e gera a saída em `.cloudflare/output/`.

As duas estão em beta, então as versões ficam **fixadas** no `package.json`
(`cf@1.0.0-beta.28` e `@cloudflare/vite-plugin@2.0.0-beta.v.12`). Atualize
de propósito, lendo o changelog, e rode `npm run typecheck`, `npm run build`
e `npm run e2e` antes de commitar. O Wrangler ignora o `cloudflare.config.ts`:
não misture os dois (nada de `wrangler.jsonc` neste projeto).

## Licença

MIT.
