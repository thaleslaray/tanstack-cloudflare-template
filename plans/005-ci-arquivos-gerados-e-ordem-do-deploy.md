# Plano 005: CI que acusa arquivo gerado desatualizado, e migração antes do código no Workers Builds

> **Instruções para o executor**: siga este plano passo a passo. Rode cada
> comando de verificação e confirme o resultado esperado antes de ir para o
> próximo passo. Se acontecer qualquer coisa da seção "Condições de STOP",
> pare e relate: não improvise. Ao terminar, atualize a linha deste plano em
> `plans/README.md` (se o arquivo existir), a menos que um revisor tenha
> despachado você e dito que ele mesmo mantém o índice.
>
> **Checagem de drift (rode primeiro)**: este plano foi escrito contra o commit
> `bb7333e` MAIS mudanças ainda não commitadas na árvore de trabalho em
> 2026-11-13. Por isso `git diff --stat bb7333e..HEAD -- <caminhos>` VAI mostrar
> diferenças legítimas (as mudanças daquele dia, depois de commitadas). O que
> vale é o texto: compare cada trecho citado em "Estado atual" com o arquivo em
> disco. Trecho diferente do citado = condição de STOP.
>
> ```bash
> git diff --stat bb7333e..HEAD -- .github/workflows/ci.yml package.json \
>   README.md AGENTS.md content/docs/deploy.mdx .claude/skills/deploy/SKILL.md \
>   worker-configuration.d.ts src/routeTree.gen.ts public/sitemap.xml public/robots.txt scripts/
> ```

## Status

- **Prioridade**: P2
- **Esforço**: M
- **Risco**: Parte A (CI) LOW; Parte B (comando de deploy) MED, porque só um deploy real confirma o comportamento
- **Depende de**: nenhum plano. Os planos 001 a 004 podem mexer em `README.md` e `AGENTS.md`; se já foram executados, os números de linha citados aqui mudam (use os trechos, não os números)
- **Categoria**: dx
- **Planejado em**: commit `bb7333e` + árvore de trabalho de 2026-11-13; confira o drift pelos trechos citados

## Por que isso importa

Quatro arquivos gerados são versionados (`worker-configuration.d.ts`,
`src/routeTree.gen.ts`, `public/sitemap.xml`, `public/robots.txt`) e nada no
CI confere se estão em dia; o sitemap já ficou desatualizado uma vez. O CI só
tem essa conferência para a pasta `drizzle/`. Quem clona o template é leigo:
um sitemap velho ou tipos de `env` velhos viram erro silencioso em produção.

Segundo problema: o comando de deploy documentado para o botão Deploy to
Cloudflare (Workers Builds) é
`npx wrangler deploy && npx wrangler d1 migrations apply DB --remote`. Em
TODO push o código novo entra no ar ANTES da migração. Entre os dois passos (e
para sempre, se a migração falhar) o código novo roda contra o banco velho:
uma página que lê a coluna nova quebra. A migração só vem depois por causa do
primeiro deploy, quando o banco ainda não existe. Este plano troca o comando
por um script que migra antes quando o banco já existe e mantém o primeiro
deploy funcionando.

## Estado atual

Tudo abaixo foi lido nos arquivos em disco em 2026-11-13.

### Fatos do achado original que foram corrigidos

1. **"O cabeçalho do `worker-configuration.d.ts` traz a versão do workerd, então todo bump do Dependabot mudaria o arquivo."** Impreciso em dois pontos. Só muda quando a versão do `workerd` muda (ele vem junto com `wrangler` / `@cloudflare/vite-plugin`, grupo `cloudflare` do Dependabot). E não é só a linha do cabeçalho: tudo da linha `// Begin runtime types` (linha 57) até o fim (o arquivo tem 16.293 linhas) são os tipos do runtime, que também mudam com o workerd. Ignorar "as linhas de cabeçalho" não basta; a comparação precisa ignorar a seção de runtime inteira.
2. **Hoje os quatro arquivos estão em dia.** Conferido numa cópia do repositório fora da árvore: `npm run cf-typegen`, `npm run sitemap` e `npm run build` produzem os quatro arquivos byte a byte iguais aos da árvore de trabalho. O `npm run build` não altera nenhum outro arquivo versionado. Então a checagem nova entra verde (desde que as mudanças de 2026-11-13 estejam commitadas).
3. **`src/routeTree.gen.ts` não é gerado só no build**: o plugin do TanStack Start regera no `npm run dev` e no `npm run build` (e o `npm run test:cold` do CI sobe um `vite dev`). O resultado é o mesmo arquivo.
4. **A doc da Cloudflare do botão Deploy recomenda migrar ANTES** (página `workers/platform/deploy-buttons/`, seção "Best practices", lida em 2026-11-13): o exemplo oficial é `"deploy": "npm run db:migrations:apply && wrangler deploy"`, com a migração pelo nome do binding. A mesma página diz que o botão provisiona os recursos e atualiza a config com os ids "where applicable", e que ele pré-preenche os campos de build e deploy com os scripts `build` e `deploy` do `package.json`. Isso põe em dúvida a frase do repositório "o banco só existe depois do primeiro deploy" no fluxo do botão. Não dá para confirmar sem um deploy real (ver Passo 12). O script deste plano funciona nos dois casos.
5. **A proposta com `|| true` foi trocada.** `npx wrangler d1 migrations apply DB --remote || true; npx wrangler deploy && ...` esconde QUALQUER erro da migração antes do deploy (SQL quebrado inclusive) e publica o código mesmo assim. O plano usa uma sonda (`wrangler d1 migrations list DB --remote`): se o banco responde, a migração roda e, se falhar, o deploy é abortado; se o banco não responde, cai no comportamento de hoje (publica e migra depois).

### Arquivos envolvidos

- `.github/workflows/ci.yml` — o CI. Um job só (`check`). Não publica nada.
- `worker-configuration.d.ts` — tipos do `env`, gerado por `npm run cf-typegen` (que o `npm run typecheck` chama).
- `src/routeTree.gen.ts` — árvore de rotas, gerada pelo plugin do TanStack Start (dev e build).
- `public/sitemap.xml`, `public/robots.txt` — gerados por `scripts/generate-sitemap.ts` (`npm run sitemap`, que o `prebuild` chama). Saída determinística: as datas vêm do frontmatter dos `.mdx`, não do relógio.
- `package.json` — scripts.
- `README.md`, `content/docs/deploy.mdx`, `.claude/skills/deploy/SKILL.md`, `AGENTS.md` — os quatro lugares que documentam o comando de deploy do Workers Builds.

### Trechos (confirme que batem)

`.github/workflows/ci.yml`, do build até o fim do arquivo (o último passo é o modelo de estilo a copiar: comentário em pt-BR explicando o porquê, depois o passo):

```yaml
      - run: npm run test:cold
      - run: npm run build

      # Valida o pacote e os bindings sem publicar nada (não precisa de conta).
      - name: wrangler deploy --dry-run
        run: npx wrangler deploy --dry-run

      # drizzle/ guarda o snapshot do schema: gerar de novo sem mudança no
      # schema não escreve nada. Se escreveu, alguém mudou src/db/*.ts e
      # esqueceu de gerar e versionar a migração.
      - name: Schema e migrações combinam
        run: |
          npm run db:generate
          if [ -n "$(git status --porcelain drizzle)" ]; then
            git status --porcelain drizzle
            echo "::error::O schema mudou sem migração. Rode npm run db:generate e versione a pasta drizzle/."
            exit 1
          fi
```

Antes do build, o mesmo job já roda `npm run typecheck` (que roda o `cf-typegen` e reescreve `worker-configuration.d.ts` no runner). Depois do `npm run build`, os quatro arquivos gerados já foram escritos de novo no runner.

`worker-configuration.d.ts`, linhas 1 a 3 e linha 57:

```
/* eslint-disable */
// Generated by Wrangler by running `wrangler types --env-file=.dev.vars.example` (hash: <32 caracteres hex>)
// Runtime types generated with workerd@1.20261104.1 2026-11-07 nodejs_compat
...
// Begin runtime types
```

Das linhas 4 a 56 fica a parte do `Env` (bindings `BUCKET`, `DB`, `PUBLIC_RATE_LIMIT`, `COUNTER` e as chaves de segredo). É essa parte que precisa estar em dia.

`package.json`, scripts de deploy:

```json
    "predeploy": "wrangler d1 migrations apply DB --remote",
    "deploy": "npm run build && wrangler deploy",
    "cf-typegen": "wrangler types --env-file .dev.vars.example",
    "typecheck": "npm run cf-typegen && tsc --noEmit",
```

`wrangler.jsonc`, o banco (sem `database_id` de propósito):

```jsonc
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "tanstack-cloudflare-template-db",
      "migrations_dir": "drizzle"
    }
  ],
```

`README.md` (perto da linha 15):

```
> - **Build command:** `npm run build`
> - **Deploy command:** `npx wrangler deploy && npx wrangler d1 migrations apply DB --remote`
>   (a Cloudflare usa `npx wrangler deploy` por padrão e deixa trocar. Aqui o banco
>   só existe depois do primeiro deploy, então a migração vai **depois** dele.
>   Por isso não é `npm run deploy`, que migra antes).
```

`README.md`, tabela "Scripts" (perto da linha 97):

```
| `npm run deploy` | migra o banco remoto (`predeploy`), faz o build e `wrangler deploy` |
```

`README.md`, seção "CI e publicação automática" (perto da linha 142):

```
O GitHub Actions (`.github/workflows/ci.yml`) roda em todo push na `main` e em todo
pull request: tipos, Biome, testes, build, `wrangler deploy --dry-run` e a checagem
de que o schema e as migrações combinam. O CI **nunca publica**; o Playwright
```

`content/docs/deploy.mdx` (linha 74, uma linha só):

```
- **Deploy command:** `npx wrangler deploy && npx wrangler d1 migrations apply DB --remote`. A Cloudflare usa `npx wrangler deploy` por padrão e permite trocar. A migração vai depois porque o banco só existe depois do primeiro deploy; por isso não use `npm run deploy` aqui (ele migra antes).
```

`.claude/skills/deploy/SKILL.md` (linhas 143 a 146):

```
Botão Deploy to Cloudflare (Workers Builds): publica a cada push na `main`.
Build command `npm run build`; deploy command
`npx wrangler deploy && npx wrangler d1 migrations apply DB --remote` (a migração
vai depois porque o banco só existe depois do primeiro deploy).
```

`AGENTS.md`, seção "Comandos" (linha 29 e linha 33):

```
- `npx wrangler deploy --dry-run` (depois de `npm run build`) — valida sem publicar; `npm run deploy -- --secrets-file .prod.vars` publica (o `predeploy` aplica as migrações remotas antes)
```

```
- CI (GitHub Actions, sem deploy): `.github/workflows/ci.yml` em push na `main` e PR (`npm ci`, `.dev.vars` com segredo aleatório, typecheck, check, test, `test:cold`, build, `wrangler deploy --dry-run`, e falha se `npm run db:generate` mudar `drizzle/`); `e2e.yml` à mão e toda segunda 09:00 UTC.
```

`AGENTS.md`, seção "Regras" (linha 62), final da frase:

```
Mudou `wrangler.jsonc` ou o `.dev.vars.example`? Regenere e versione o arquivo.
```

`AGENTS.md`, seção "D1 e UUID" (linha 109), final do item:

```
No botão Deploy (Workers Builds) o comando de deploy é `npx wrangler deploy && npx wrangler d1 migrations apply DB --remote` (migra depois porque o banco só existe depois do primeiro deploy).
```

### O que foi confirmado sobre o Wrangler e o Workers Builds

- **Doc do Workers Builds** (`workers/ci-cd/builds/configuration/`, lida em 2026-11-13): o "Deploy command" é livre, e a doc cita `npm run deploy` como exemplo de script do `package.json` usado como comando de deploy. As configurações ficam em **Settings > Build** do Worker e valem a partir do build seguinte. A lista de permissões do token criado automaticamente cita Workers Scripts, KV e R2 e não cita D1 (o comando atual já depende de migrar o D1 de dentro do build; ver Passo 12).
- **Código do Wrangler instalado (4.158.0, `node_modules/wrangler/wrangler-dist/cli.js`, função `getDatabaseByNameOrBinding`)**: sem `database_id` na config, o Wrangler procura o banco na API pelo `database_name`. Se a API responde 404, ele lança `Couldn't find a D1 DB named '<nome>' (bound as 'DB') in the API` e sai com código diferente de zero, antes de qualquer pergunta. `d1 migrations list` e `d1 migrations apply` passam pelo mesmo caminho.
- **O que NÃO foi confirmado** (precisa de deploy real): se no fluxo do botão o banco já existe antes do primeiro comando de deploy, e se o script roda inteiro dentro do Workers Builds. O script foi desenhado para dar certo nos dois casos, mas o Passo 12 é obrigatório antes de mesclar a Parte B.

### Convenções do repositório que valem aqui

- Tudo em pt-BR, simples e direto: comentários, mensagens de erro e nomes de teste. O público é quem está aprendendo.
- Scripts ficam em `scripts/` e têm um comentário de cabeçalho dizendo o que fazem e como rodar. Modelo: as primeiras linhas de `scripts/generate-sitemap.ts`:

  ```ts
  // Gera public/sitemap.xml e public/robots.txt. Roda sozinho antes de todo
  // `npm run build` (script `prebuild`); à mão: `npm run sitemap`.
  ```

- Biome (`npm run check`) cobre `src/**`, `e2e/**`, `scripts/**`: aspas simples, sem ponto e vírgula, vírgula no fim, 2 espaços, 80 colunas. Arquivo `.sh` dentro de `scripts/` é ignorado pelo Biome sem erro (conferido).
- Vitest roda qualquer `*.test.ts` fora de `e2e/` e `.wrangler/` (ver `vitest.config.ts`), em ambiente node. Teste em `scripts/` é encontrado sozinho. Linha de base hoje: 26 arquivos, 212 testes, todos passando.
- `tsconfig.json` inclui `scripts`: o teste novo passa pelo `tsc`.
- `AGENTS.md` é a fonte das regras do projeto; comando ou script novo entra na seção "Comandos" de lá e na tabela "Scripts" do `README.md`.
- Mensagens de commit: frase curta em pt-BR, às vezes com a área na frente. Exemplos do `git log`: `Deploy: passo final de medir a performance`, `Tira as notas internas (HANDOFF e REVISAO) do repositório`.

## Decisão: `worker-configuration.d.ts` e o Dependabot

Opções avaliadas:

| Opção | O que acontece | Veredito |
| --- | --- | --- |
| Comparar o arquivo inteiro (ou `wrangler types --check`) | Todo PR do Dependabot que sobe o workerd fica vermelho até alguém baixar o branch do robô, regenerar e dar push. O grupo `cloudflare` sobe quase toda semana. | Rejeitada: o aluno leigo fica preso num PR vermelho que ele não sabe consertar, e aprende a ignorar o CI. |
| Ignorar só a linha 3 do cabeçalho | Não resolve: o corpo dos tipos do runtime (linha 57 em diante) também muda com o workerd. | Rejeitada. |
| **Comparar só a parte do `Env`** (do começo até `// Begin runtime types`, sem a linha `// Runtime types generated with workerd@...`) | Acusa o esquecimento que importa (mudou binding no `wrangler.jsonc` ou chave no `.dev.vars.example` e não regenerou). Bump de workerd passa verde. | **Escolhida.** |

Por que a parte de runtime velha no repositório não faz mal: o `npm run typecheck` (local e no CI) sempre regenera o arquivo antes do `tsc`, então a checagem de tipos nunca usa a cópia velha. A cópia versionada se atualiza no próximo commit de quem rodar o typecheck.

Limite conhecido: se uma versão nova do Wrangler mudar o FORMATO da parte do `Env` (ou o hash da linha 2), o PR do Dependabot fica vermelho uma vez. Conserto: `npm run typecheck` no branch e commit do arquivo. Isso é raro e é o comportamento desejado (a parte do `Env` mudou de verdade).

## Comandos que você vai usar

| Para quê | Comando | Esperado |
| --- | --- | --- |
| Tipos | `npm run typecheck` | sai com 0, sem erros |
| Lint | `npm run check` | sai com 0, `No fixes applied` |
| Testes | `npm run test` | todos passam (212 antes da Parte B; 216 depois) |
| Um teste só | `npx vitest run scripts/deploy-builds.test.ts` | 4 passam |
| Build | `npm run build` | sai com 0, lista de `[prerender]` no fim |
| Dry-run | `npx wrangler deploy --dry-run` | sai com 0, lista os bindings |
| Formatar um arquivo | `npx biome check --write <arquivo>` | sai com 0 |

O `npm run typecheck` e o `npm run build` precisam de um `.dev.vars` (copie de `.dev.vars.example` e ponha qualquer texto de 32+ caracteres em `BETTER_AUTH_SECRET`, se ainda não existir). Não versione o `.dev.vars`.

**NUNCA rode `npm run deploy:builds`, `npm run deploy`, `npx wrangler deploy` (sem `--dry-run`) nem `wrangler d1 ... --remote`.** Eles publicam ou mexem no banco de produção de quem estiver logado.

## Ferramentas sugeridas

- Se a skill `wrangler` ou `cloudflare:wrangler` existir no seu ambiente, use para tirar dúvida sobre flags do Wrangler. Sem ela: `curl -sL -H "Accept: text/markdown" https://developers.cloudflare.com/workers/ci-cd/builds/configuration/`.

## Escopo

**Dentro do escopo** (os únicos arquivos que você pode modificar):

- `.github/workflows/ci.yml`
- `scripts/deploy-builds.sh` (criar)
- `scripts/deploy-builds.test.ts` (criar)
- `package.json` (só a linha nova em `scripts`)
- `README.md`
- `AGENTS.md`
- `content/docs/deploy.mdx`
- `.claude/skills/deploy/SKILL.md`
- `worker-configuration.d.ts`, `src/routeTree.gen.ts`, `public/sitemap.xml`, `public/robots.txt` — só se o Passo 1 mostrar que estão desatualizados, e só pelo comando que os gera (nunca à mão)
- `plans/README.md` (só a linha deste plano)

**Fora do escopo** (NÃO toque, mesmo parecendo relacionado):

- Os scripts `deploy` e `predeploy` do `package.json`: são o caminho manual (`npm run deploy`) e estão documentados em vários lugares. Mudar aqui muda o deploy de quem publica do próprio computador.
- `wrangler.jsonc`: nada de `database_id`, nada de binding novo.
- `.github/workflows/e2e.yml` e `.github/dependabot.yml`.
- `scripts/generate-sitemap.ts`, `vite.config.ts`, `biome.json`, `vitest.config.ts`.
- Qualquer coisa em `src/` além do `src/routeTree.gen.ts` regenerado.
- `package-lock.json`: nenhuma dependência nova. Não rode `npm install <pacote>`.
- Publicar, dar push ou abrir PR.

## Fluxo de git

- Comece de um commit que já contenha as mudanças de 2026-11-13 (ver Passo 0).
- Branch: `advisor/005-ci-arquivos-gerados-e-ordem-do-deploy`.
- Dois commits (três, se o Passo 1 precisar regenerar algo): um para a Parte A, um para a Parte B. Assim a Parte B pode ser revertida sozinha se a validação do Passo 12 falhar.
- Mensagens no estilo do repositório, por exemplo: `CI: acusa arquivo gerado desatualizado` e `Deploy: Workers Builds migra o banco antes de publicar`.
- NÃO dê push nem abra PR sem ordem do operador.

## Passos

### Passo 0: Ponto de partida

1. Rode `git status --short`. Se aparecerem arquivos modificados que este plano não criou (em 2026-11-13 havia 47 linhas de mudanças não commitadas, contando a pasta `plans/`, entre elas `public/sitemap.xml`, `public/robots.txt`, `src/routeTree.gen.ts`, `README.md`, `AGENTS.md`, `package.json`), **PARE**: peça ao operador para commitar essas mudanças antes. Não commite você mesmo o trabalho dos outros.
2. Crie o branch: `git switch -c advisor/005-ci-arquivos-gerados-e-ordem-do-deploy`.
3. Confira os trechos da seção "Estado atual" contra os arquivos.

**Verificação**: `git status --short` → saída vazia. `npm run test` → `Test Files  26 passed`, `Tests  212 passed` (se os planos 001 a 004 já rodaram, os números podem ser maiores; o que importa é zero falhas; anote os números).

## Parte A: o CI acusa arquivo gerado desatualizado

### Passo 1: Confirmar que os quatro arquivos estão em dia hoje

```bash
npm run typecheck
npm run build
git status --porcelain -- worker-configuration.d.ts src/routeTree.gen.ts public/sitemap.xml public/robots.txt
```

**Verificação**: o `git status` acima → saída vazia.

Se algum dos quatro aparecer: é arquivo que já estava desatualizado. Confira com `git diff -- <arquivo>` que a diferença é só conteúdo gerado, e faça um commit só com esses arquivos (`git add` nos caminhos exatos), com a mensagem `Regenera arquivos gerados`. Se a diferença for em `worker-configuration.d.ts` e só da linha 57 em diante (tipos do runtime), commite do mesmo jeito. Depois rode o `git status` de novo → saída vazia.

### Passo 2: Acrescentar o passo no CI

Em `.github/workflows/ci.yml`, acrescente NO FIM do arquivo, depois do passo `Schema e migrações combinam`, com a mesma indentação dos outros passos (6 espaços antes de `- name:`), uma linha em branco antes:

```yaml

      # Quatro arquivos gerados são versionados: o editor e o tsc leem os tipos
      # do repositório, e os buscadores leem o sitemap. A esta altura todos já
      # foram gerados de novo aqui no CI: o typecheck rodou o cf-typegen, e o
      # build rodou o sitemap e o gerador de rotas. Se algum saiu diferente do
      # que está no commit, alguém mudou a fonte e esqueceu de gerar e versionar.
      #
      # No worker-configuration.d.ts só a parte do Env é comparada (do começo
      # até a linha "// Begin runtime types"). O resto são os tipos do runtime,
      # que mudam a cada versão nova do workerd: comparar tudo deixaria todo PR
      # do Dependabot vermelho. O typecheck sempre regenera o arquivo antes de
      # usar, então a parte de runtime velha no repositório não faz mal.
      - name: Arquivos gerados estão em dia
        run: |
          falhou=0
          for arquivo in src/routeTree.gen.ts public/sitemap.xml public/robots.txt; do
            if ! git diff --exit-code -- "$arquivo"; then
              falhou=1
            fi
          done
          parte_do_env() {
            sed '/^\/\/ Begin runtime types/,$d' | grep -v '^// Runtime types generated with workerd@'
          }
          if ! diff <(git show HEAD:worker-configuration.d.ts | parte_do_env) <(parte_do_env < worker-configuration.d.ts); then
            falhou=1
          fi
          if [ "$falhou" -ne 0 ]; then
            echo "::error::Arquivo gerado desatualizado. Rode npm run typecheck e npm run build e versione o que mudar (worker-configuration.d.ts, src/routeTree.gen.ts, public/sitemap.xml, public/robots.txt)."
            exit 1
          fi
```

Não mude nenhum outro passo. O `<( ... )` exige bash; o `run:` do GitHub Actions em `ubuntu-latest` usa bash, então não acrescente `shell:`.

**Verificação** (o YAML continua válido e o passo é o último):

```bash
node --input-type=module -e "import { parse } from 'yaml'; import { readFileSync } from 'node:fs'; const s = parse(readFileSync('.github/workflows/ci.yml', 'utf8')).jobs.check.steps; console.log(s.length, s.at(-1).name, s.at(-2).name)"
```

→ imprime `12 Arquivos gerados estão em dia Schema e migrações combinam`.

### Passo 3: Provar o passo localmente (caso verde e casos vermelhos)

Crie um arquivo temporário FORA do repositório com o mesmo conteúdo do `run:` do Passo 2 (sem a indentação do YAML) e rode com as mesmas opções de bash do GitHub Actions:

```bash
PROVA="$(mktemp -d)/gerados.sh"
node --input-type=module -e "import { parse } from 'yaml'; import { readFileSync, writeFileSync } from 'node:fs'; writeFileSync(process.argv[1], parse(readFileSync('.github/workflows/ci.yml', 'utf8')).jobs.check.steps.at(-1).run)" "$PROVA"
git add .github/workflows/ci.yml

# 1) Caso verde
bash --noprofile --norc -eo pipefail "$PROVA"; echo "saida=$?"
```

→ `saida=0`, sem nenhum diff impresso.

```bash
# 2) Sitemap/robots desatualizado
echo "# lixo" >> public/robots.txt
bash --noprofile --norc -eo pipefail "$PROVA"; echo "saida=$?"
git checkout -- public/robots.txt
```

→ imprime o diff do `robots.txt`, a linha `::error::Arquivo gerado desatualizado...` e `saida=1`.

```bash
# 3) Binding novo sem regenerar os tipos (mexe na parte do Env)
node -e "const fs=require('node:fs');const f='worker-configuration.d.ts';fs.writeFileSync(f,fs.readFileSync(f,'utf8').replace('\tDB: D1Database;','\tDB: D1Database;\n\tNOVO: string;'))"
bash --noprofile --norc -eo pipefail "$PROVA"; echo "saida=$?"
git checkout -- worker-configuration.d.ts
```

→ imprime um diff com `NOVO: string;` e `saida=1`.

```bash
# 4) Workerd novo (mexe só no cabeçalho de runtime e no fim do arquivo): tem que passar
node -e "const fs=require('node:fs');const f='worker-configuration.d.ts';fs.writeFileSync(f,fs.readFileSync(f,'utf8').replace(/workerd@[0-9.]+/,'workerd@9.9.9')+'declare var teste_de_runtime: never;\n')"
bash --noprofile --norc -eo pipefail "$PROVA"; echo "saida=$?"
git checkout -- worker-configuration.d.ts
```

→ `saida=0`.

**Verificação final do passo**: `git status --short` → só `.github/workflows/ci.yml` (com `A` ou `M`). Nenhum dos quatro arquivos gerados aparece.

(O `node -e` com `require` funciona mesmo com `"type": "module"` no `package.json`: código passado por `-e` é CommonJS por padrão. Se der erro de `require is not defined`, use `node --input-type=commonjs -e "..."`.)

### Passo 4: Documentar a checagem

1. `AGENTS.md`, seção "Comandos", item do CI (linha 33). Troque o trecho

   `e falha se `npm run db:generate` mudar `drizzle/`);`

   por

   `falha se `npm run db:generate` mudar `drizzle/`, e falha se um arquivo gerado estiver desatualizado: `src/routeTree.gen.ts`, `public/sitemap.xml`, `public/robots.txt` e a parte do `Env` de `worker-configuration.d.ts`; a parte de runtime, depois de `// Begin runtime types`, fica de fora porque muda a cada workerd novo);`

2. `AGENTS.md`, seção "Regras", item "Tipos de `Env`" (linha 62). Depois de `Regenere e versione o arquivo.` acrescente, na mesma linha:

   ` O CI compara a parte do `Env` com a do commit e falha se estiver velha.`

3. `README.md`, seção "CI e publicação automática". Troque

   ```
   pull request: tipos, Biome, testes, build, `wrangler deploy --dry-run` e a checagem
   de que o schema e as migrações combinam. O CI **nunca publica**; o Playwright
   ```

   por

   ```
   pull request: tipos, Biome, testes, build, `wrangler deploy --dry-run`, a checagem
   de que o schema e as migrações combinam e a de que os arquivos gerados (tipos do
   `env`, rotas, sitemap e robots) estão em dia. Ficou vermelho nessa última? Rode
   `npm run typecheck` e `npm run build` e versione o que mudar. O CI **nunca publica**; o Playwright
   ```

**Verificação**:

```bash
grep -c "arquivo gerado estiver desatualizado" AGENTS.md   # → 1
grep -c "O CI compara a parte do \`Env\`" AGENTS.md         # → 1
grep -c "arquivos gerados (tipos do" README.md             # → 1
npm run test                                               # → zero falhas (src/rules.test.ts lê o src/, não estes textos)
```

### Passo 5: Commit da Parte A

```bash
git add .github/workflows/ci.yml AGENTS.md README.md
git commit -m "CI: acusa arquivo gerado desatualizado"
```

**Verificação**: `git status --short` → vazio. `git show --stat HEAD` → só esses três arquivos.

## Parte B: o Workers Builds migra antes de publicar

### Passo 6: Criar `scripts/deploy-builds.sh`

Crie o arquivo com exatamente este conteúdo (fim de linha LF, uma quebra de linha no fim):

```sh
#!/bin/sh
# Comando de deploy do Workers Builds (botão Deploy to Cloudflare).
# Rode sempre por `npm run deploy:builds`: é o npm que põe o `wrangler` do
# projeto no PATH. No seu computador use `npm run deploy`.
#
# Ordem: migra o banco ANTES de publicar o código novo, para a tabela ou a
# coluna nova já existir quando o código que depende dela entrar no ar.
#
# No primeiro deploy o banco D1 pode ainda não existir (é o `wrangler deploy`
# que cria). Aí a pergunta "o banco responde?" falha e a ordem se inverte só
# dessa vez: publica, e migra logo depois.

if wrangler d1 migrations list DB --remote; then
  echo "[deploy] Banco encontrado: aplicando as migrações antes de publicar."
  if ! wrangler d1 migrations apply DB --remote; then
    echo "[deploy] ERRO: a migração falhou. O código novo NÃO foi publicado." >&2
    exit 1
  fi
else
  echo "[deploy] Não consegui ler o banco (primeiro deploy?). Publico primeiro e migro depois."
fi

wrangler deploy || exit 1

# Primeiro deploy: o banco acabou de ser criado, agora dá para migrar.
# Nos seguintes não há mais nada a aplicar e o comando só confirma.
wrangler d1 migrations apply DB --remote
```

Por que assim (não mude sem entender):

- A sonda é `d1 migrations list`, não `|| true` na migração: erro de SQL na migração aborta o deploy em vez de ser engolido.
- Se a sonda falhar por outro motivo (rede, permissão), o script cai no comportamento de hoje (publica e migra depois). Nunca fica pior do que o comando antigo.
- `wrangler` sem `npx`: o `npm run` põe `node_modules/.bin` no PATH, e o teste do Passo 7 depende disso para trocar o `wrangler` por um de mentira.

**Verificação**: `sh -n scripts/deploy-builds.sh; echo "saida=$?"` → `saida=0`. **Não execute o script.**

### Passo 7: Criar `scripts/deploy-builds.test.ts`

Crie o arquivo com exatamente este conteúdo (já está no formato do Biome):

```ts
import { execFileSync } from 'node:child_process'
import {
  chmodSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { delimiter, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

// scripts/deploy-builds.sh é o comando de deploy do Workers Builds. Ele não
// pode rodar de verdade no teste (publicaria o app), então um `wrangler` de
// mentira entra na frente do PATH: anota cada chamada num arquivo e sai com o
// código que o teste mandar. O que se confere é a ORDEM das chamadas.

const SCRIPT = fileURLToPath(new URL('./deploy-builds.sh', import.meta.url))

const LIST = 'd1 migrations list DB --remote'
const APPLY = 'd1 migrations apply DB --remote'
const DEPLOY = 'deploy'

const WRANGLER_DE_MENTIRA = `#!/bin/sh
echo "$*" >> "$STUB_LOG"
case "$*" in
  "${LIST}") exit "\${STUB_LIST:-0}" ;;
  "${APPLY}") exit "\${STUB_APPLY:-0}" ;;
  "${DEPLOY}") exit "\${STUB_DEPLOY:-0}" ;;
esac
exit 64
`

let dir: string

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'deploy-builds-'))
  writeFileSync(join(dir, 'wrangler'), WRANGLER_DE_MENTIRA)
  chmodSync(join(dir, 'wrangler'), 0o755)
})

afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

// `falhas` diz qual chamada do wrangler de mentira deve falhar (sair com 1).
function rodar(falhas: Record<string, string> = {}) {
  const log = join(dir, 'chamadas.log')
  let saida = 0
  try {
    execFileSync('sh', [SCRIPT], {
      env: {
        ...process.env,
        ...falhas,
        STUB_LOG: log,
        PATH: `${dir}${delimiter}${process.env.PATH}`,
      },
      stdio: 'ignore',
    })
  } catch (error) {
    saida = (error as { status?: number }).status ?? -1
  }
  const chamadas = existsSync(log)
    ? readFileSync(log, 'utf8').trim().split('\n')
    : []
  return { saida, chamadas }
}

// O script é de shell e só roda no Workers Builds (Linux). No Windows não há
// `sh`, então o teste é pulado lá; o CI (Linux) sempre roda.
describe.skipIf(process.platform === 'win32')(
  'scripts/deploy-builds.sh',
  () => {
    it('banco existe: migra ANTES de publicar', () => {
      expect(rodar()).toEqual({
        saida: 0,
        chamadas: [LIST, APPLY, DEPLOY, APPLY],
      })
    })

    it('primeiro deploy (banco ainda não existe): publica e migra depois', () => {
      expect(rodar({ STUB_LIST: '1' })).toEqual({
        saida: 0,
        chamadas: [LIST, DEPLOY, APPLY],
      })
    })

    it('migração falhou: para sem publicar o código novo', () => {
      expect(rodar({ STUB_APPLY: '1' })).toEqual({
        saida: 1,
        chamadas: [LIST, APPLY],
      })
    })

    it('deploy falhou: sai com erro e não migra de novo', () => {
      expect(rodar({ STUB_DEPLOY: '1' })).toEqual({
        saida: 1,
        chamadas: [LIST, APPLY, DEPLOY],
      })
    })
  },
)
```

Atenção ao copiar: dentro da string `WRANGLER_DE_MENTIRA`, `${LIST}` é interpolação do TypeScript e `\${STUB_LIST:-0}` (com a barra) é texto que vai para o shell. Não tire a barra.

O teste não chama o Wrangler de verdade: o `PATH` começa pela pasta temporária e o script chama `wrangler` sem caminho. Se algum dia o script passar a usar `npx wrangler`, este teste deixaria de proteger (o `npx` acha o Wrangler real primeiro); por isso o Passo 6 proíbe.

**Verificação**:

```bash
npx vitest run scripts/deploy-builds.test.ts   # → Tests  4 passed (4)
npx biome check scripts/deploy-builds.test.ts  # → No fixes applied, sai com 0
```

Se o Biome reclamar só de formatação: `npx biome check --write scripts/deploy-builds.test.ts` e rode os dois comandos de novo.

### Passo 8: Script no `package.json`

Em `package.json`, dentro de `"scripts"`, logo DEPOIS da linha `"deploy": "npm run build && wrangler deploy",` acrescente:

```json
    "deploy:builds": "sh scripts/deploy-builds.sh",
```

Não mude `predeploy` nem `deploy`. Não rode `npm install`.

**Verificação**:

```bash
node -p "require('./package.json').scripts['deploy:builds']"   # → sh scripts/deploy-builds.sh
node -p "require('./package.json').scripts.deploy"             # → npm run build && wrangler deploy
node -p "require('./package.json').scripts.predeploy"          # → wrangler d1 migrations apply DB --remote
git diff --stat -- package-lock.json                           # → vazio
```

### Passo 9: Trocar o comando nos quatro documentos

Em todos, a frase nova tem de dizer três coisas: o comando é `npm run deploy:builds`; ele migra ANTES quando o banco já existe; no primeiro deploy publica primeiro e migra depois.

1. `README.md`, bloco do botão. Troque as quatro linhas que começam em `> - **Deploy command:**` (até `Por isso não é `npm run deploy`, que migra antes).`) por:

   ```
   > - **Deploy command:** `npm run deploy:builds`
   >   (a Cloudflare deixa trocar esse campo. O script migra o banco **antes** de
   >   publicar o código novo; só no primeiro deploy, quando o banco ainda não
   >   existe, ele publica primeiro e migra em seguida. Se a migração falhar, o código
   >   novo não sobe. Não use `npm run deploy` aqui: ele refaz o build e pode falhar
   >   no primeiro deploy. Já usa o botão com o comando antigo? Troque no painel:
   >   o Worker → **Settings** → **Build** → Deploy command).
   ```

2. `README.md`, tabela "Scripts". Logo depois da linha de `npm run deploy`, acrescente:

   ```
   | `npm run deploy:builds` | comando de deploy do Workers Builds (botão Deploy): migra o banco antes de publicar; no primeiro deploy publica e migra depois. Não rode no seu computador |
   ```

3. `content/docs/deploy.mdx`, linha 74. Troque a linha inteira por (uma linha só):

   ```
   - **Deploy command:** `npm run deploy:builds`. A Cloudflare permite trocar esse campo. O script (`scripts/deploy-builds.sh`) migra o banco **antes** de publicar o código novo; só no primeiro deploy, quando o banco ainda não existe, ele publica primeiro e migra em seguida. Se a migração falhar, o código novo não sobe. Não use `npm run deploy` aqui (ele refaz o build e pode falhar no primeiro deploy). Já usa o botão com o comando antigo? Troque no painel: o Worker, **Settings**, **Build**, Deploy command.
   ```

4. `.claude/skills/deploy/SKILL.md`, linhas 143 a 146. Troque as quatro linhas por:

   ```
   Botão Deploy to Cloudflare (Workers Builds): publica a cada push na `main`.
   Build command `npm run build`; deploy command `npm run deploy:builds`
   (`scripts/deploy-builds.sh`: migra o banco antes de publicar; só no primeiro
   deploy, sem banco ainda, publica primeiro e migra depois; migração com erro
   não publica). Quem configurou com o comando antigo troca em Settings → Build.
   ```

5. `AGENTS.md`, seção "D1 e UUID" (linha 109). Troque a frase final

   `No botão Deploy (Workers Builds) o comando de deploy é `npx wrangler deploy && npx wrangler d1 migrations apply DB --remote` (migra depois porque o banco só existe depois do primeiro deploy).`

   por

   `No botão Deploy (Workers Builds) o comando de deploy é `npm run deploy:builds` (`scripts/deploy-builds.sh`): se o banco já responde (`wrangler d1 migrations list DB --remote`), migra ANTES de publicar e aborta o deploy se a migração falhar; se não responde (primeiro deploy), publica e migra depois. Não troque por `|| true` na migração: isso publica código novo mesmo com migração quebrada. O script chama `wrangler` sem `npx` de propósito (o teste `scripts/deploy-builds.test.ts` troca o `wrangler` pelo PATH).`

6. `AGENTS.md`, seção "Comandos". Logo depois do item que começa com `- `npx wrangler deploy --dry-run`` (linha 29), acrescente um item novo:

   ```
   - `npm run deploy:builds` — comando de deploy do Workers Builds (`scripts/deploy-builds.sh`): migra antes de publicar; no primeiro deploy publica e migra depois. Só roda no build da Cloudflare; no computador use `npm run deploy`
   ```

**Verificação**:

```bash
grep -rn "wrangler deploy && npx wrangler d1 migrations apply" README.md AGENTS.md content .claude/skills   # → nenhuma linha
grep -c "deploy:builds" README.md                          # → 2
grep -c "deploy:builds" AGENTS.md                          # → 2
grep -c "deploy:builds" content/docs/deploy.mdx            # → 1
grep -c "deploy:builds" .claude/skills/deploy/SKILL.md     # → 1
```

### Passo 10: Verificação completa

```bash
npm run typecheck
npm run check
npm run test
npm run build
npx wrangler deploy --dry-run
git status --porcelain -- worker-configuration.d.ts src/routeTree.gen.ts public/sitemap.xml public/robots.txt
```

**Verificação**: os cinco primeiros saem com 0. `npm run test` → um arquivo de teste e 4 testes a mais que a linha de base anotada no Passo 0 (com a base de 2026-11-13: `Test Files  27 passed`, `Tests  216 passed`). O `git status` final → vazio (mexer em `content/docs/deploy.mdx` não muda o sitemap: docs não têm `lastmod`).

### Passo 11: Commit da Parte B

```bash
git add scripts/deploy-builds.sh scripts/deploy-builds.test.ts package.json README.md AGENTS.md content/docs/deploy.mdx .claude/skills/deploy/SKILL.md
git commit -m "Deploy: Workers Builds migra o banco antes de publicar"
```

**Verificação**: `git status --short` → vazio. `git show --stat HEAD` → só esses sete arquivos.

### Passo 12: PARE aqui. Validação em deploy real (é do operador, não sua)

O comportamento dentro do Workers Builds não pode ser confirmado sem publicar de verdade, e você não publica. **Não dê push, não abra PR e não marque o plano como DONE.** Relate ao operador que a Parte A está pronta e que a Parte B está commitada no branch aguardando este roteiro, que ele roda numa conta Cloudflare descartável (ou num Worker de teste), com um repositório de teste apontando para este branch:

1. **Primeiro deploy pelo botão.** Usar o botão Deploy com o repositório de teste; no campo Deploy command pôr `npm run deploy:builds`. Esperado no log do build: OU `[deploy] Não consegui ler o banco (primeiro deploy?)...` seguido do deploy e depois das migrações aplicadas, OU `[deploy] Banco encontrado...` (se o botão já criou o banco antes). Nos dois casos: build verde e login por código funcionando na URL publicada (prova de que as tabelas existem). Anotar qual das duas mensagens apareceu.
2. **Push seguinte com migração nova.** Acrescentar uma tabela qualquer em `src/db/schema.ts`, `npm run db:generate`, commit, push. Esperado no log: `[deploy] Banco encontrado: aplicando as migrações antes de publicar.` e a migração aplicada ANTES da saída do `wrangler deploy`. Build verde.
3. **Push com migração quebrada.** Criar à mão um `.sql` com erro de sintaxe na pasta `drizzle/` (seguindo a numeração), commit, push. Esperado: build VERMELHO, log com `[deploy] ERRO: a migração falhou. O código novo NÃO foi publicado.`, e a aba Deployments do Worker sem versão nova. Reverter o commit depois.
4. **Permissão.** Se os passos 1 ou 2 falharem com erro de autenticação ao falar com o D1, o token do Workers Builds não tem permissão de D1 (a doc lista Workers Scripts, KV e R2 no token automático). Anotar a mensagem exata.

Resultado e o que fazer:

| Resultado | Ação |
| --- | --- |
| 1, 2 e 3 como esperado | Operador mescla. Acrescentar em `AGENTS.md`, seção "Decisões registradas", uma entrada datada: comando antigo, comando novo, e qual mensagem apareceu no primeiro deploy. Marcar o plano como DONE. |
| 1 falha (primeiro deploy quebra) | Reverter o commit da Parte B (`git revert`), manter a Parte A. Relatar o log. Não tentar outro comando por conta própria. |
| 2 mostra a migração DEPOIS do deploy (a sonda `list` falha mesmo com o banco existindo) | Não é regressão (é o comportamento antigo), mas o objetivo não foi atingido: relatar o log da sonda. Não mesclar a Parte B como está. |
| 4 (erro de permissão) | Relatar. A correção é no token da conta, não no código. |

## Plano de testes

- **Teste novo**: `scripts/deploy-builds.test.ts`, 4 casos, todos sobre a ordem das chamadas ao `wrangler`:
  1. banco existe → `list`, `apply`, `deploy`, `apply` (migra antes);
  2. primeiro deploy (sonda falha) → `list`, `deploy`, `apply`;
  3. migração falha → `list`, `apply`, sai com 1, sem `deploy` (é a regressão que o `|| true` deixaria passar);
  4. deploy falha → sai com 1, sem a segunda migração.
- **Modelo de estrutura**: não há outro teste que execute processo no repositório; siga o código do Passo 7 ao pé da letra. Para estilo de `describe`/`it` em pt-BR, veja `src/config/public-paths.test.ts`.
- **Checagem do CI (Parte A)**: não tem teste automatizado no Vitest; a prova é o Passo 3 (um caso verde e três simulações) e a primeira execução real do workflow depois do push.
- **Verificação**: `npm run test` → zero falhas, 4 testes a mais que a linha de base.

## Critérios de pronto

Verificáveis por comando. TODOS precisam valer:

- [ ] `npm run typecheck` sai com 0
- [ ] `npm run check` sai com 0
- [ ] `npm run test` sai com 0, com `scripts/deploy-builds.test.ts` na lista e 4 testes a mais que a linha de base
- [ ] `npm run build` e `npx wrangler deploy --dry-run` saem com 0
- [ ] O comando de verificação do Passo 2 imprime `12 Arquivos gerados estão em dia Schema e migrações combinam`
- [ ] As quatro provas do Passo 3 deram `saida=0`, `saida=1`, `saida=1`, `saida=0`, nessa ordem
- [ ] `grep -rn "wrangler deploy && npx wrangler d1 migrations apply" README.md AGENTS.md content .claude/skills` não retorna nada
- [ ] `node -p "require('./package.json').scripts.deploy"` continua `npm run build && wrangler deploy`
- [ ] `git diff --stat bb7333e..HEAD -- package-lock.json wrangler.jsonc .github/workflows/e2e.yml .github/dependabot.yml` não mostra mudança feita por este plano
- [ ] `git status --porcelain -- worker-configuration.d.ts src/routeTree.gen.ts public/sitemap.xml public/robots.txt` vazio depois de typecheck + build
- [ ] `git log --oneline -3` mostra os commits da Parte A e da Parte B separados
- [ ] Linha deste plano em `plans/README.md` (se existir) atualizada: `BLOCKED (Parte A pronta; Parte B aguardando validação em deploy real, Passo 12)` até o operador validar; só então `DONE`

## Condições de STOP

Pare e relate (não improvise) se:

- `git status --short` no Passo 0 mostrar mudanças não commitadas que não são suas.
- Qualquer trecho de "Estado atual" não bater com o arquivo em disco.
- No Passo 1, um arquivo gerado aparecer diferente e a diferença NÃO for só conteúdo gerado (por exemplo, o sitemap perder uma página que existe em `content/`), ou continuar diferente depois de commitar e gerar de novo (gerador não determinístico: a checagem do CI ficaria vermelha à toa).
- No Passo 3, a prova 4 (workerd novo) der `saida=1`: a comparação da parte do `Env` está pegando a parte de runtime; não ajuste o `sed` por tentativa.
- No Passo 3, a prova 1 (caso verde) der `saida=1` com a árvore limpa.
- O teste do Passo 7 falhar duas vezes depois de uma tentativa razoável de conserto, ou só passar se o script mudar para `npx wrangler`.
- Alguma etapa parecer exigir mudar `deploy`/`predeploy`, o `wrangler.jsonc`, ou instalar dependência.
- Você se pegar prestes a rodar `npm run deploy:builds`, `npm run deploy`, `wrangler deploy` sem `--dry-run`, ou qualquer `wrangler d1 ... --remote`.
- Chegou ao Passo 12: a validação em deploy real é do operador. Pare, relate e deixe o plano como BLOCKED.

## Notas de manutenção

- **Arquivo gerado novo e versionado** (por exemplo, outro `*.gen.ts`): acrescente na lista do `for` do passo `Arquivos gerados estão em dia`, e confira antes que o gerador é determinístico (rodar duas vezes dá o mesmo arquivo).
- **Sitemap com data do relógio**: se alguém fizer `scripts/generate-sitemap.ts` escrever a data de hoje em `<lastmod>`, o CI passa a ficar vermelho todo dia. A data tem de continuar vindo do frontmatter.
- **`appConfig.url`**: trocar a URL em `src/config/app.ts` muda `public/sitemap.xml` e `public/robots.txt`; agora o CI cobra o `npm run sitemap` + commit. É o comportamento desejado (era exatamente o esquecimento que já aconteceu).
- **Dependabot e `worker-configuration.d.ts`**: bump de workerd passa verde e deixa a parte de runtime do arquivo versionado velha até alguém rodar `npm run typecheck` e commitar. Não faz mal (o typecheck regenera antes de usar). Se um Wrangler novo mudar o formato da parte do `Env`, o PR fica vermelho uma vez: `npm run typecheck` no branch e commit.
- **`cf` / plugin v2 no GA** (`AGENTS.md`, "Decisões registradas"): a migração para o `cf` troca o gerador de tipos e os comandos de D1. Revisar o passo do CI (marcador `// Begin runtime types`) e o `scripts/deploy-builds.sh` nessa hora.
- **Quem já publicou pelo botão** continua com o comando antigo salvo no painel (Settings → Build). O repositório não consegue mudar isso; a doc nova avisa. O comando antigo continua funcionando, só mantém a ordem antiga.
- **O que o revisor deve olhar no PR**: (1) o passo novo do CI é o último e não mudou os outros; (2) `scripts/deploy-builds.sh` chama `wrangler` sem `npx` e não tem `|| true`; (3) `deploy` e `predeploy` intactos; (4) o resultado do roteiro do Passo 12 registrado antes de mesclar a Parte B.
- **Adiado de propósito**: (a) usar o próprio script `deploy` como comando do Workers Builds (é o que o botão pré-preenche e o que a doc da Cloudflare sugere). Depende de saber se o botão cria o banco antes do primeiro comando de deploy; o item 1 do Passo 12 responde, e se a resposta for "sim" vale um plano próprio para simplificar. (b) Acrescentar `database_id` de exemplo no `wrangler.jsonc`, como a doc do botão recomenda: muda o provisionamento automático, fora deste plano. (c) Rodar o passo de arquivos gerados também no `e2e.yml`: desnecessário, o `ci.yml` já cobre todo push e PR.
