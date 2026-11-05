# poc-tanstack

PoC de uma aplicacao TanStack Start (React, Tailwind, shadcn/ui) rodando inteira em um unico Cloudflare Worker, com D1 + Drizzle, Better Auth, R2, Durable Objects e Cron. Usa o Vite plugin v2 beta e o CLI `cf` (sem Wrangler).

> `cf` e o Vite plugin v2 estao em beta. As versoes estao fixadas em `package.json`; atualize de proposito.

## Quickstart

```bash
npm install
cp .dev.vars.example .dev.vars   # preencha BETTER_AUTH_SECRET (openssl rand -base64 32)
npm run db:generate
npm run dev                      # cf dev, em http://localhost:3000
npm run db:migrate:local         # com o dev server rodando ou nao; grava em .cloudflare/state
```

Abra http://localhost:3000. Demos em `/demo/drizzle`, `/demo/r2`, `/demo/durable-object` e `/demo/better-auth`.

## Configuracao

Tudo do Worker vive em `cloudflare.config.ts` (bindings D1 `DB`, R2 `BUCKET`, Durable Object `COUNTER`, segredo `BETTER_AUTH_SECRET`, variavel `BETTER_AUTH_URL`, cron). Os tipos de `Env` sao gerados em `.cloudflare/types` pelo `cf dev` e pelo `cf build` (ou com `npm run typecheck`).

## Desenvolvimento local

- Dados locais (D1, R2, DO) ficam em `.cloudflare/state/` (ignorado pelo git).
- Local Explorer: http://localhost:3000/cdn-cgi/local/explorer
- Disparar o cron: `curl "http://localhost:3000/cdn-cgi/local/scheduled?cron=0+3+*+*+*"`
- Ambientes: use `--mode <nome>` (ex.: `cf build --mode staging`); `CLOUDFLARE_ENV` nao e mais usado.

## Deploy

1. `cf auth login`
2. Crie o banco (`cf d1 create poc-tanstack-db`) e troque o `id` em `cloudflare.config.ts` e nos scripts `db:migrate:*`; crie o bucket `poc-tanstack-files`.
3. Ajuste `BETTER_AUTH_URL` no `cloudflare.config.ts` para a URL publica.
4. `npm run db:migrate:remote`
5. `npx cf deploy --dry-run` para validar; depois `npm run deploy` (segredos: `cf deploy --secrets-file <arquivo>`).
