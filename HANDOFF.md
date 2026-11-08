# Handoff — Template TanStack Start + Cloudflare

Data: 2026-11-05. Sessão de pesquisa, decisão e prova de conceito. Serve de contexto para qualquer sessão futura neste projeto.

## 1. Objetivo

Thales quer um jeito de criar apps full-stack na Cloudflare que a IA (Claude Code, Codex) acerte de primeira. Uso próprio agora; para os alunos da Operação Autonomia (fase F3, "Criação de Apps", público leigo) quando a base sair de beta.

## 2. O que foi pesquisado e concluído

Relatório completo com 190 fontes: `~/pesquisas/pesquisa-tanstack-start-cloudflare-2026-11-05.md`.

- **TanStack Start é framework de primeira classe na Cloudflare.** Suporte oficial no changelog em 2025-10-24, patrocínio em 2025-09-23, Start 1.0 estável em 2026-10-13 com Cloudflare como Official Hosting Partner. Roda no workerd sem adapter, via `@cloudflare/vite-plugin`.
- **Next.js na Cloudflare passa pelo OpenNext**, adapter de terceiros com bundles de dezenas de MB e issues estruturais. A Cloudflare publicou o **vinext** (2026-02-24): reimplementação do Next sobre Vite, experimental, 94% da API. É a ponte para projeto Next existente, não a base para projeto novo.
- **Lovable** migrou os apps gerados para TanStack Start em 2026-05-13 e o próprio lovable.dev em 2026-08. Hospeda cada app como Worker em Dynamic Workers. Confirma: segredos como binding, nada pesado em module scope, regras curadas injetadas na IA porque o modelo não conhece TanStack.
- **Frontend convergiu**: React + Vite + Tailwind + shadcn/ui + TanStack Query em Lovable, Cloudflare, v0 e nos próprios modelos. A disputa é só o meta-framework.
- **Hono vs TanStack Start**: Hono substitui Express (API, webhook, backend de agente). TanStack Start substitui Next.js (app com telas, SSR, server functions). Dá para usar os dois juntos.
- **cf CLI e Vite plugin v2 estão em beta** (verificado ao vivo em 2026-11-05: `cf@1.0.0-beta.28`, `@cloudflare/vite-plugin@2.0.0-beta.v.12`). Thales decidiu usar v2 + cf mesmo assim, para uso próprio, e publicar para aluno só após o GA.

## 3. Decisões tomadas (não reabrir)

| Decisão | Escolha |
|---|---|
| Framework | TanStack Start (React) |
| UI | Tailwind v4 + shadcn/ui |
| Dados | Drizzle sobre D1; R2 para arquivos; Durable Objects para estado |
| Auth | Better Auth, factory por request |
| Config/CLI | **cf + Vite plugin v2 beta, versões fixadas. Nunca Wrangler, nunca `wrangler.jsonc`** |
| Base do template | Scaffold oficial da Cloudflare + add-ons do CLI do TanStack + cola Workers própria. O repo `rice408s/tanstack-start-cloudflare-starter` (ShipKit Lite, MIT) é referência de solução por módulo, não base |
| Distribuição | Repositório próprio com botão "Deploy to Cloudflare" no README |
| E-mail | Camada com dois provedores: Resend e Cloudflare Email Service |
| Pacotes | npm, não Bun |
| Idioma | pt-BR |

## 4. O que foi construído

### 4.1 Skill cloudflare-atlas (`~/.claude/skills/cloudflare-atlas`)
Commit `35c3f73` na branch `main`. Criados `references/frameworks/tanstack-start.md` e `references/frameworks/vinext.md`, ligados no `SKILL.md`, `README.md`, `CHANGELOG.md` e guia de curadoria. Cada fato reverificado na doc viva. É a fonte de verdade de Cloudflare para a IA neste projeto. Nota: `scripts/check-pointers` só varre `products/`, não a pasta nova.

### 4.2 PoC (agora em `./poc-tanstack`, sendo movida para a raiz pela sessão de implementação)
Comandos que a criaram:
1. `npm create cloudflare@latest -- poc-tanstack --framework=tanstack-start`
2. `npx @tanstack/cli add shadcn drizzle better-auth tanstack-query --forced` (precisa de `addOnOptions.drizzle.database = "sqlite"` no `.cta.json` antes; `--forced` pula o prompt)
3. Cola Workers por agente Sonnet: Drizzle em `drizzle-orm/d1`, `getDb(env.DB)`, `getAuth(env)`, R2, DO `Counter`, cron em `src/server.ts`
4. Migração para v2 + cf por agente Sonnet: `cf migrate --bundler vite`, `cloudflare.config.ts`, scripts `cf dev/build/deploy`
5. `npx @tanstack/intent install --map` e `hooks install`: `AGENTS.md` com 35 skills do TanStack, importado pelo `CLAUDE.md`

Testado no navegador integrado, nas duas versões (v1 e v2): DO incrementa e persiste, R2 grava e lista, login Better Auth cria sessão com cookie a partir do D1 local, cron responde em `/cdn-cgi/local/scheduled`, Local Explorer abre em `/cdn-cgi/local/explorer`.

Os 4 commits da PoC ficaram na pasta temporária da sessão antiga (o app não copia `.git`). O histórico recomeça aqui.

### 4.3 Gotchas descobertos na prática (já no CLAUDE.md da PoC)
- Add-ons do CLI do TanStack geram código Node: `better-sqlite3`, `auth` singleton, `process.env`. Tem que reconectar aos bindings.
- O add-on sobrescreve `wrangler.jsonc` e volta `compatibility_date` para 2025-09-02.
- `.validator`, não `.inputValidator`, na versão instalada do Start.
- `cloudflare()` antes de `tanstackStart()` no vite.config, senão "server-entry not found".
- `tanstackStartCookies()` é sempre o último plugin do Better Auth; `ipAddressHeaders: ["cf-connecting-ip"]`.
- `handler.fetch` do server-entry não aceita `env` como 2º parâmetro; usar `fetch(request) { return handler.fetch(request) }`.
- **v2/cf**: `cf migrate` não converte DO; exige `exports: { Counter: exports.durableObject({ storage: "sqlite" }) }` à mão. Gera `id: "REPLACE_ME"` no D1, que não é UUID válido.
- **v2/cf**: o D1 local de dev é chaveado pelo `id`; `cf d1 migrations apply` só aceita UUID v4; só cai no banco do `cf dev` com `--local --persist-to .cloudflare/state`. Por isso existe um UUID placeholder `11111111-1111-4111-8111-111111111111` em 3 lugares (config e dois scripts). Trocar os 3 ao criar o banco real.
- **v2/cf**: `Env` não tipa métodos do DO quando o binding aponta para o próprio Worker; precisou de cast com `import type` da classe.
- `node:fs` existe em Workers como FS virtual (`/bundle` leitura, `/tmp` escrita). `waitUntil` nem sempre está à mão em server function; aguardar tudo com `await`.
- Nunca rodar `cf dev/build/deploy/init` em projeto com `wrangler.jsonc`: a auto-config ignora e pode escrever `cloudflare.config.ts` sem bindings.

## 5. Estado agora

- Sessão de implementação aberta nesta pasta: "Template TanStack Start + Cloudflare: peças do ShipKit Lite" (`template-build`). Ficha: mover PoC para a raiz, git init, npm install, `.dev.vars`, hooks do Intent; depois shadcn base, camada de e-mail (Resend + Email Service), Better Auth OTP + Google/GitHub opcionais, landing a partir de dados com 4 temas, MDX (blog/docs/legal) pt-BR com prerender, i18n se couber, rate limit + headers + cron útil, Biome + Vitest + Playwright, skills `/setup` `/deploy` `/google-oauth`, README com botão Deploy. Um commit por módulo. Design é da sessão principal; implementação delegada a Sonnet.
- Referência clonada (ou a clonar) em `~/Projetos/templates/_ref/tanstack-start-cloudflare-starter`, só leitura.
- Nada publicado no GitHub. Nenhum deploy real. Nenhum `cf auth login`.

## 6. Para deploy real (quando chegar a hora)
`cf auth login` → `cf d1 create poc-tanstack-db` → trocar o UUID nos 3 lugares → `npm run db:migrate:remote` → `cf deploy --secrets-file` com `BETTER_AUTH_SECRET` → `BETTER_AUTH_URL` para a URL pública.

## 7. Manutenção contínua (planejado, não feito)
- Renovate agrupando `@tanstack/*`, `@cloudflare/*`, `cf`; merge automático de patch/minor com CI verde.
- CI mensal que cria app do template e faz `cf deploy --dry-run` ou preview.
- Rotina mensal: `npm view cf dist-tags` (avisar quando sair `1.0.0` sem beta), `npx @tanstack/intent stale`, `scripts/changelog-check cf` e `workers` da atlas, bump de `compatibilityDate`.
- Ao GA do cf/v2: atualizar a referência na atlas (hoje diz "v1 é o estável"), testar fluxo de leigo numa máquina limpa, só então publicar para aluno.

## 8. Fontes principais
- Guia oficial: https://developers.cloudflare.com/workers/framework-guides/web-apps/tanstack-start/
- Vite plugin v2 beta: https://developers.cloudflare.com/workers/vite-plugin/v2-beta/
- cf migrate: https://developers.cloudflare.com/cf/wrangler/migrate/
- Deploy button: https://developers.cloudflare.com/workers/platform/deploy-buttons/
- Lovable, apps gerados: https://lovable.dev/blog/building-apps-using-tanstack-start
- Lovable, migração: https://lovable.dev/blog/how-we-migrated-lovable-dev-away-from-nextjs
- vinext: https://blog.cloudflare.com/vinext/
- TanStack Intent: https://tanstack.com/intent
- Referência ShipKit Lite: https://github.com/rice408s/tanstack-start-cloudflare-starter

## 9. Template entregue (2026-11-05, fim do dia)

A sessão de implementação terminou com 11 commits em `main`, um por módulo. Verificação feita pela sessão-mãe, por conta própria:
`npm run check` (Biome, 80 arquivos), `npm run typecheck`, `npm run test` (43 testes), `npx cf build` (11 páginas prerender), `npx cf deploy --dry-run` (5 bindings: COUNTER, DB, BUCKET, PUBLIC_RATE_LIMIT, BETTER_AUTH_URL). No navegador: landing nova em pt-BR, troca de tema e modo escuro, login por código lido no log do `cf dev`, página `/conta`, `/blog`.

Decisões registradas pela sessão de implementação no CLAUDE.md: i18n só pt-BR (sem Paraglide); Vitest puro (o pool de Workers depende do Wrangler); `BETTER_AUTH_URL` no `cloudflare.config.ts` vence o `.dev.vars`; segredos opcionais com `bindings.secret()` só avisam quando ausentes.

Pendências:
- `.claude/settings.json` com os hooks do TanStack Intent não foi criado nesta pasta (o classificador de permissão bloqueou a sessão de implementação). Comando: `npx @tanstack/intent@latest hooks install`.
- Botão Deploy to Cloudflare e `cf deploy --prebuilt` não testados em deploy real.
- Login Google/GitHub e envio real por Resend/Email Service só com stubs; sem credenciais.
- Referência clonada em `~/Projetos/templates/_ref/` pode ser apagada quando não for mais útil.

## 10. Volta para v1 + Wrangler (2026-11-07)

**Motivo.** `cf` e o Vite plugin v2 seguem em beta (verificado em 2026-11-07: `cf@1.0.0-beta.28`, plugin `2.0.0-beta.v.12`) e o template vai para alunos leigos. O guia oficial do TanStack Start na Cloudflare (atualizado em 2026-11-05) usa plugin v1 + Wrangler. Isto inverte a linha "Config/CLI" da §3.

**O que mudou** (3 commits em `main`):
- `cloudflare.config.ts` → `wrangler.jsonc` com `$schema` e comentários em pt-BR. Mesmos bindings: `DB` (D1, `database_id: "REPLACE_ME"`, `migrations_dir: "drizzle"`), `BUCKET` (R2), `COUNTER` (DO + `migrations` `v1` `new_sqlite_classes`), `PUBLIC_RATE_LIMIT` (`ratelimits`, namespace `1001`, 5/60 s), cron `0 3 * * *`, `vars.BETTER_AUTH_URL`. `assets.html_handling: "drop-trailing-slash"` (o plugin preenche `directory` sozinho: `dist/server/wrangler.json` sai com `"../client"`), `upload_source_maps`, `observability`.
- Versões fixadas: `wrangler@4.158.0`, `@cloudflare/vite-plugin@1.67.0`; `cf` removido.
- `vite.config.ts`: `cloudflare({ viteEnvironment: { name: 'ssr' } })`, ordem mantida; `server.port` saiu (porta no script) e `.wrangler/**` saiu do watch.
- Scripts: `vite dev --port 3000`, `vite build`, `npm run build && vite preview`, `npm run build && wrangler deploy`, migrações por binding (`wrangler d1 migrations apply DB --local|--remote`). O UUID placeholder `11111111-...` sumiu dos 3 lugares.
- Tipos: `worker-configuration.d.ts` (versionado), gerado por `wrangler types --env-file .dev.vars.example`. O `--env-file` existe porque sem ele um clone limpo (sem `.dev.vars`) gera `Env` sem os segredos e o `tsc` quebra. `secrets.required` foi descartado: faria o `wrangler deploy` exigir os segredos opcionais.
- `env.COUNTER` tipado como `DurableObjectNamespace<Counter>` sem cast. Os stubs de `env` nos testes viraram `as unknown as Record<string, unknown>`.
- Playwright: `E2E_PORT` (padrão 3000) e `vite dev --strictPort`. No dev, `BETTER_AUTH_URL` no `.dev.vars` vence o `vars` (conferido no código do `getVarsForDev`).
- Local Explorer continua em `/cdn-cgi/local/explorer` (plugin v1 ≥ 1.50.0) e o cron em `/cdn-cgi/local/scheduled`.
- Textos: README, CLAUDE.md (regras invertidas), skills `/setup` `/deploy` `/google-oauth`, docs, landing. Post `por-que-cf-e-nao-wrangler` virou `por-que-wrangler-hoje-e-cf-depois`.

**Validado:** `typecheck`, `check`, `test` (43), `db:migrate:local`, `build` (11 páginas prerender), `wrangler deploy --dry-run` (COUNTER, DB, BUCKET, PUBLIC_RATE_LIMIT, BETTER_AUTH_URL), `e2e` (7/7), e curl no dev (`/`, `/login`, `/blog`, post novo, `/demo/durable-object`, `/api/auth/ok`, cron: 200).

**Guardado:** a branch `cf-v2-beta` tem o estado v2 + `cf` intacto (último commit antes da volta: `2be0149`).

**Como voltar ao v2 no GA:**
1. Confirmar GA: `npm view cf dist-tags` e `npm view @cloudflare/vite-plugin dist-tags` sem `beta`; ler os changelogs.
2. Numa branch nova: `npx cf migrate --bundler vite` (lê o `wrangler.jsonc`). Conferir à mão o que o `cf migrate` não converteu na PoC: o DO (`exports: { Counter: exports.durableObject({ storage: 'sqlite' }) }`), o `id` do D1 (precisa ser UUID v4) e os `--dir drizzle` nos scripts de migração. Comparar com `git diff main cf-v2-beta`.
3. Inverter de novo as regras do CLAUDE.md, skills, docs e o post do blog.
4. Rodar a mesma bateria acima, mais um teste do fluxo de leigo numa máquina limpa, antes de publicar para aluno.

**Próximo passo sugerido:** `@cloudflare/vitest-pool-workers@0.23.0` agora é possível (precisa de Wrangler) para testar bindings de verdade dentro do workerd.

## 11. Peças do ShipKit Lite transplantadas (2026-11-07)

Três grupos, três agentes Opus, 10 commits em `main` depois da volta para v1. Validação final pela sessão-mãe: typecheck, Biome (116 arquivos), 113 testes unitários, build com 11 páginas prerender, `wrangler deploy --dry-run` com 5 bindings, 19 testes Playwright (rodados pelos agentes), e no navegador: `/blocos` com os 13 blocos sem scroll horizontal, `/app` com painel e checklist.

- **Grupo A (guardrails e CI):** `src/rules.test.ts` com 6 regras do CLAUDE.md como teste; `.github/workflows/ci.yml` (typecheck, lint, teste, build, dry-run, guard de migração) e `e2e.yml` (manual e semanal); `src/lib/seo.ts`, `og.png`, `sitemap.xml` gerado no `prebuild`, `robots.txt`; specs e2e de guards e cabeçalhos. Atenção: o Playwright agora sobe também o `vite preview` na 4173 porque o `vite dev` não aplica `public/_headers`.
- **Grupo B (produto logado):** auditoria com sinks (`audit_log` no D1, migração 0001); foto de perfil no R2 (`/api/avatar`, 2 MB, tipo pelos bytes); encerramento de conta em duas fases (7 dias, lembrete no dia 5, purge pelo cron, migração 0002) e "baixar meus dados"; app shell em `/app` e `/app/configuracoes` (`/conta` virou 301). `deleteUser` do Better Auth desligado de propósito. Bug corrigido no caminho: troca de nome era auditada como login.
- **Grupo C (landing):** 6 blocos novos (bento, compare, stats, logos, terminal, gallery), total 13; `/blocos` como catálogo com `noindex`; `stats` e `compare` entraram na landing real. Rodapé corrigido para 375 px. Achado não corrigido: no tema brutal claro, o `.kicker` amarelo tem pouco contraste.

Fora do escopo, ainda: deploy real, botão Deploy, Google/GitHub/Resend com credenciais, `@cloudflare/vitest-pool-workers`, restaurar conta encerrada (só pelo D1), remover foto (só trocar).

## 12. Versões com `^` e Dependabot (2026-11-07)

Os 10 pins exatos (8 do CLI do TanStack, 2 da regra do beta) viraram `^`. `.github/dependabot.yml` semanal com grupos (tanstack, cloudflare, react, ferramentas, resto) e majors de typescript/vite/vitest/@types/node ignorados. Regra no CLAUDE.md: pin exato só para beta; `compatibility_date` sobe à mão. Teste do pior caso: cópia descartável com `npm update` (85 pacotes, incluindo TanStack Start 1.169.5, Router, Query 5.107, Tailwind 4.3.5, Playwright 1.65, Biome 2.6.6) passou typecheck, lint, 113 testes, migração, build, dry-run e 19 e2e. Único aviso: o Biome 2.6.6 pede `biome migrate` para atualizar o `$schema` do `biome.json` (nível info, não falha). O ShipKit Lite, por comparação, fixa tudo e não tem bot: está em wrangler 4.99 por isso.
