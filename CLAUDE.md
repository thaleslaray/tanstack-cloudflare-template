@AGENTS.md

# poc-tanstack

PoC de TanStack Start rodando 100% em Cloudflare Workers, com Vite plugin v2 beta e o CLI `cf`.

## Stack
TanStack Start + Router + Query, Tailwind v4 + shadcn/ui, Drizzle ORM sobre D1, Better Auth, R2, Durable Objects (`Counter`), Cron. Entry customizado em `src/server.ts`. Config do Worker em `cloudflare.config.ts`.

## Comandos
- `npm run dev` — `cf dev` (workerd local, porta 3000 via `server.port` no `vite.config.ts`; `cf dev` nao aceita `--port`)
- `npm run build` — `cf build` (saida em `.cloudflare/output`) / `npm run preview` — `vite preview`
- `npm run typecheck` — `cf workers types && tsc --noEmit`
- `npm run db:generate` — gera migration em `drizzle/`
- `npm run db:migrate:local` — aplica as migrations no D1 do `cf dev` (`.cloudflare/state`)
- `npm run db:migrate:remote` — aplica no D1 remoto (precisa do ID real e de `cf auth login`)
- `npm run deploy` — `cf deploy` (validar antes com `npx cf deploy --dry-run`)
- Cron local: `curl "http://localhost:3000/cdn-cgi/local/scheduled?cron=0+3+*+*+*"`
- Local Explorer (D1, R2, DO, logs): `http://localhost:3000/cdn-cgi/local/explorer`
- Ambientes: `--mode <nome>` (ex.: `cf build --mode staging`) no lugar de `CLOUDFLARE_ENV`/`--env`

## Regras
- NUNCA criar `wrangler.jsonc` (nem `wrangler.toml`) neste projeto. A config e `cloudflare.config.ts`; Wrangler nao esta instalado.
- `cf` e o Vite plugin estao em beta: versoes FIXADAS sem `^` (`cf@1.0.0-beta.28`, `@cloudflare/vite-plugin@2.0.0-beta.v.12`). Atualizar so de proposito, lendo o changelog, e rodar `typecheck`, `cf build` e os testes de dev antes de commitar.
- Tipos de bindings (`Env`) sao gerados em `.cloudflare/types` (pelo `cf dev`/`cf build` ou `cf workers types`). Nao existe `worker-configuration.d.ts`. Mudou `cloudflare.config.ts`? Regenere os tipos.
- No `vite.config.ts`, `cloudflare()` vem ANTES de `tanstackStart()`. Nao reordenar. O ambiente Vite do Worker e `ssr` (padrao do v2, sem `viteEnvironment`).
- Bindings so via `import { env } from "cloudflare:workers"`, dentro de server function ou handler. Nunca em module scope, nunca em codigo que va ao client.
- `getAuth(env)` e `getDb(env.DB)` sao factories por request. Sem singletons.
- `tanstackStartCookies()` e sempre o ultimo plugin do Better Auth.
- D1 e SQLite: sem transacao aninhada.
- Aguardar (`await`) toda promise; promise solta some ao fim da requisicao.
- Sem APIs Node de filesystem em runtime (`node:fs` e virtual, sem disco real).
- `compatibilityDate` sempre atual.
- Segredos locais em `.dev.vars` (nao versionar); modelo em `.dev.vars.example`. `BETTER_AUTH_SECRET` e declarado como `bindings.secret()`; `BETTER_AUTH_URL` e `bindings.text(...)` no `cloudflare.config.ts` (troque pela URL publica no deploy). Em producao os segredos sobem com `cf deploy --secrets-file <arquivo>`.
- Durable Objects: o ciclo de vida fica em `exports: { Counter: exports.durableObject({ storage: "sqlite" }) }`. Nao existe `migrations` do Wrangler.
- D1: o `id` em `bindings.d1` precisa ser UUID valido. O valor atual e um placeholder local. `cf d1 migrations apply` so aceita ID (nao nome), e o banco do `cf dev` e chaveado por esse ID. Ao criar o banco real (`cf d1 create poc-tanstack-db`), troque o `id` no config E nos dois scripts `db:migrate:*`.
- O estado do `cf dev` fica em `.cloudflare/state/v3`. `--local` sem `--persist-to .cloudflare/state` grava em outro lugar (`~/Library/Preferences/cloudflare/state/v3`) e nao afeta o dev server.
- `src/db/auth-schema.ts` espelha o schema do Better Auth; ao mudar plugins, regenerar/ajustar e rodar `db:generate`.
- A classe `Counter` nao e inferida no tipo de `env.COUNTER` (binding com nome de Worker, auto-referencia); `src/routes/demo/durable-object.tsx` faz o cast para `DurableObjectNamespace<Counter>`.
