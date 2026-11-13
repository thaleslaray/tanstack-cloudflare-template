# Plano 004: Primeiro uso sem tropeço para quem não usa o Claude Code: engines, migração automática e npm run setup

> **Instruções para quem executa**: siga este plano passo a passo. Rode cada
> comando de verificação e confirme o resultado esperado antes de ir para o
> próximo passo. Se acontecer qualquer coisa da seção "Condições de STOP",
> pare e relate: não improvise. Ao terminar, atualize a linha deste plano em
> `plans/README.md` SE o arquivo existir (quando o plano foi escrito ele não
> existia; nesse caso o item é N/A e você não cria o arquivo).
>
> **Conferência de drift (rode primeiro)**: este plano foi escrito contra o
> commit `bb7333e` MAIS mudanças ainda não commitadas na árvore de trabalho
> (2026-11-13). Vários arquivos já estavam modificados e sem commit, por
> trabalho de outra pessoa, quando o plano foi escrito; então
> `git diff --stat bb7333e..HEAD` sozinho NÃO basta. Rode:
>
> ```bash
> git status --short -- package.json package-lock.json .nvmrc scripts .dev.vars.example README.md AGENTS.md content/docs/comecando.mdx .claude/skills/setup/SKILL.md .github/workflows worker-configuration.d.ts
> git diff --stat bb7333e -- package.json scripts .dev.vars.example README.md AGENTS.md content/docs/comecando.mdx .claude/skills/setup/SKILL.md .github/workflows
> ```
>
> Saída esperada (a de quando o plano foi escrito). Primeiro comando,
> exatamente estas 6 linhas, em qualquer ordem:
>
> ```
>  M .claude/skills/setup/SKILL.md
>  M AGENTS.md
>  M README.md
>  M content/docs/comecando.mdx
>  M package-lock.json
>  M package.json
> ```
>
> Segundo comando: os mesmos 5 arquivos (sem o lock) e o resumo
> `5 files changed, 44 insertions(+), 36 deletions(-)`. Nenhum dos dois cita
> `.nvmrc`, `scripts/`, `.dev.vars.example`, `.github/workflows` nem
> `worker-configuration.d.ts`. Se aparecer arquivo a mais (em especial
> `.nvmrc` ou `scripts/setup.ts`), é STOP. Se os números do segundo comando
> forem outros, alguém mexeu nesses arquivos depois do plano: NÃO é STOP por
> si só, mas aí a conferência por trecho abaixo vira obrigatória linha a linha.
>
> Depois **confira os trechos-âncora**: rode o bloco da subseção
> "Conferência dos trechos" (dentro de "Estado atual"; são `grep -c` com
> resultado esperado ao lado). Se um resultado não bater, é condição de
> STOP. Só então siga para o Passo 0.
>
> O `package-lock.json` aparece como ` M` por trabalho alheio e continua
> assim depois deste plano: você não mexe nele. Quem prova isso é o `shasum`
> anotado no Passo 0 e conferido no Passo 5 e nos critérios de pronto.

## Status

- **Prioridade**: P2
- **Esforço**: M
- **Risco**: LOW
- **Depende de**: nenhum
- **Categoria**: dx
- **Planejado em**: commit `bb7333e` + árvore de trabalho de 2026-11-13 (não commitada); confira o drift pelos trechos citados

## Por que isso importa

O template é para alunos leigos, e hoje o caminho "clonei e quero ver rodando"
tem três armadilhas para quem NÃO usa o Claude Code. (1) Nada no repositório
declara a versão do Node: o README e o CI pedem Node 22, mas o `package.json`
não tem `engines` e não existe `.nvmrc`, então quem está no Node 18/20 só
descobre por um erro estranho. (2) Quem esquece `npm run db:migrate:local`
sobe o app, pede o código de login e leva um erro cru do D1 de tabela
inexistente. (3) Criar o `.dev.vars` é manual: copiar o exemplo, gerar um
segredo com `openssl` (com receita à parte para Windows) e colar. A automação
disso só existe como skill do Claude (`/setup`), e os dois workflows do GitHub
repetem a mesma lógica com `sed`.

Depois deste plano: `npm install && npm run dev` basta num clone novo. Um
script único (`npm run setup`, também ligado como `predev`) cria o
`.dev.vars`, gera o segredo se estiver vazio (sem nunca sobrescrever nem
imprimir o valor) e aplica as migrações locais. README, docs, a skill `/setup`
e os dois workflows passam a usar esse mesmo script.

## Estado atual

Tudo abaixo foi lido nos arquivos em disco em 2026-11-13.

### Fatos conferidos (e correções ao achado original)

- `package.json` não tem `engines`; `.nvmrc` não existe. **Confirmado.**
- Não há `predev` no `package.json`. **Confirmado.**
- `tsx` já é devDependency (`"tsx": "^4.21.0"`), `yaml` também. **Confirmado.**
- Os dois workflows usam `node-version: 22` fixo e repetem `cp` + `sed`.
  **Confirmado**, com uma precisão: eles geram o segredo com
  `openssl rand -hex 32` (não `-base64`), porque o `sed` usa `|` como
  separador. O script novo usa base64, que é o que o README já recomenda.
- **Correção ao achado**: o `e2e.yml` NÃO precisa migrar à mão; o Playwright já
  roda `npm run db:migrate:local` em `e2e/global-setup.ts`. E o Playwright e o
  `test:cold` sobem o servidor com `npx vite dev` direto (não `npm run dev`),
  então um `predev` não os afeta.
- **Medição feita (migração local)**, com `wrangler 4.158.0`, sem login na
  Cloudflare, com a entrada padrão fechada (`< /dev/null`):
  - banco novo (5 migrações): cerca de 3,8 s, saída termina com a tabela de
    migrações e exit 0;
  - banco já em dia: cerca de 1,8 s, saída contém `No migrations to apply!`,
    exit 0.
  - Em nenhum dos casos pediu login.
- **Detalhe que o achado não tinha**: num terminal interativo, o
  `wrangler d1 migrations apply` PERGUNTA "About to apply N migration(s) ...
  Ok to proceed?" antes de aplicar. Com a entrada padrão fechada ele assume
  "sim" sozinho (foi assim que a medição acima rodou). Por isso o `predev` não
  pode ser simplesmente `npm run db:migrate:local`: o aluno ficaria preso numa
  pergunta em inglês. O script novo chama o wrangler com `stdin` ignorado.
- O binário do wrangler fica em `node_modules/wrangler/bin/wrangler.js`
  (conferido). Chamar `node node_modules/wrangler/bin/wrangler.js ...`
  funciona e evita o `npx` (que no Windows exige `shell: true`).
- Linha de base hoje: `npx vitest run` → `Test Files 26 passed (26)`,
  `Tests 212 passed (212)`; `npx tsc --noEmit` → exit 0; `npm run check`
  (Biome) → exit 0, `Checked 155 files ... No fixes applied.` Ou seja, os
  arquivos alheios modificados na árvore NÃO quebram o Biome hoje. Se no
  Passo 0 o `npm run check` já falhar, é STOP (a falha não é sua e o critério
  "check sai com 0" ficaria impossível sem mexer fora do escopo).
- **Biome nos arquivos novos, conferido sem gravar nada**: o conteúdo dos
  passos 1, 2 e 3 foi passado por
  `npx biome check --write --stdin-file-path=scripts/<arquivo> < <cópia fora do repo>`
  (lê da entrada e devolve na saída, não grava arquivo). Os três saíram com
  exit 0 e **nenhum diagnóstico de lint**; o único ajuste de formatação (uma
  chamada `replace` no teste) já está aplicado no texto do Passo 2. Então o
  `check:fix` do Passo 9 deve ser uma operação vazia.
- A porta 3000 pode estar ocupada na máquina de quem executa (quando o plano
  foi escrito, estava: um `vite dev --port 3000 --strictPort` de OUTRO
  projeto). O `npm run dev` deste projeto não usa `--strictPort`, então o
  Vite sobe na próxima porta livre (3001, 3002...) e imprime a URL real na
  linha `Local:`. O Passo 6 lê a porta dessa linha.

### Arquivos e trechos

`package.json` (linhas 1-7 e 39-51):

```json
{
  "name": "tanstack-cloudflare-template",
  "private": true,
  "type": "module",
  "imports": {
    "#/*": "./src/*"
  },
```

```json
  "scripts": {
    "dev": "vite dev --port 3000",
    "sitemap": "tsx scripts/generate-sitemap.ts",
    "prebuild": "npm run sitemap",
    "build": "vite build",
    ...
    "db:generate": "drizzle-kit generate",
    "db:migrate:local": "wrangler d1 migrations apply DB --local",
    "db:migrate:remote": "wrangler d1 migrations apply DB --remote",
```

`.dev.vars.example` (33 linhas; só comentários e chaves vazias). Linhas que
importam aqui:

```
1  # Segredos LOCAIS. Copie para .dev.vars (não versionado): cp .dev.vars.example .dev.vars
7  # Assina os cookies de sessão. Gere com: openssl rand -base64 32
8  # Mínimo de 32 caracteres: vazio ou curto faz o app recusar o login.
9  BETTER_AUTH_SECRET=
```

(`.dev.vars` está no `.gitignore`. NUNCA imprima, copie para o chat ou
commite o conteúdo dele.)

`.github/workflows/ci.yml` (linhas 24-36):

```yaml
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci

      # O .dev.vars não é versionado e chave real nunca entra no CI: o build,
      # o prerender e os testes rodam com um segredo aleatório descartável.
      - name: .dev.vars de mentira
        run: |
          cp .dev.vars.example .dev.vars
          sed -i "s|^BETTER_AUTH_SECRET=.*|BETTER_AUTH_SECRET=$(openssl rand -hex 32)|" .dev.vars
```

`.github/workflows/e2e.yml` (linhas 19-31):

```yaml
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci

      # Segredo aleatório: o login do teste usa o código impresso no log do
      # servidor, então nenhuma chave real é necessária.
      - name: .dev.vars de mentira
        run: |
          cp .dev.vars.example .dev.vars
          sed -i "s|^BETTER_AUTH_SECRET=.*|BETTER_AUTH_SECRET=$(openssl rand -hex 32)|" .dev.vars
```

`README.md` (linhas 26-48, seção "Pré-requisitos" e "Começar em cinco comandos"):

````markdown
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
````

`README.md` (linhas 64-66; e a tabela da seção `## Scripts`, que começa na
linha 89: cabeçalho e as linhas do `dev` e do `build` nas linhas 91-94):

```markdown
Com o Claude Code aberto na pasta, `/setup` faz tudo isso, `/google-oauth`
liga o login com Google, `/tela` cria uma tela nova no visual do app (peça
"cria uma tela de clientes") e `/deploy` publica.
```

```markdown
| Script | O que faz |
| --- | --- |
| `npm run dev` | `vite dev --port 3000`: o app em workerd local com D1, R2 e DO simulados |
| `npm run build` | `vite build`: build de produção com prerender das páginas públicas |
```

`content/docs/comecando.mdx`. Linhas literais que delimitam o trecho a
trocar (o meio, linhas 31-61, tem o `cp .dev.vars.example .dev.vars`, o
`openssl rand -base64 32`, a alternativa `node -e` para Windows, o parágrafo
"As outras chaves (Resend, Google, GitHub)..." e o `npm run db:migrate:local`):

```markdown
30  ## Crie o arquivo de segredos locais
54  ## Crie as tabelas do banco
62  Faça isso uma vez, e de novo sempre que você criar uma migration nova.
64  ## Rode o app
```

E, mais abaixo:

```markdown
88  O comando conversa com você, confere os pré-requisitos, cria o `.dev.vars`, aplica as migrations e sobe o servidor. O arquivo `AGENTS.md` na raiz (...)
94  - **Erro de tabela inexistente:** rode `npm run db:migrate:local` de novo.
```

`.claude/skills/setup/SKILL.md` (7 títulos `##`). Linhas literais:

```markdown
20  ## 2. Criar o `.dev.vars`
23  novo ele não existe:
26  [ -f .dev.vars ] || cp .dev.vars.example .dev.vars
45  Os tipos dos bindings já vêm prontos em `worker-configuration.d.ts`; só rode `npm run cf-typegen` se mudar o `wrangler.jsonc` ou o `.dev.vars.example`:
47  ```bash
48  npm run cf-typegen
49  ```
51  ## 3. Banco de dados local
60  ## 4. Subir e conferir
74  ## 5. Primeiro login
87  ## 6. Próximos passos
94  ## Problemas comuns
97  - **Login quebra com erro de segredo**: o `.dev.vars` não existe ou `BETTER_AUTH_SECRET` está vazio. Refaça o passo 2 e reinicie o dev (os segredos são lidos ao iniciar).
```

O trecho a trocar no Passo 8 é das linhas 20 a 59 (do título `## 2.` até a
linha em branco antes de `## 4. Subir e conferir`), o que inclui o bloco
` ```bash / npm run cf-typegen / ``` ` das linhas 47-49.

`AGENTS.md` (seção "## Comandos", linhas 16 e 28; seção "## Mapa", linha 43):

```markdown
- `npm run dev` — `vite dev --port 3000` em http://localhost:3000 (outra porta: `npx vite dev --port 3001`; a URL vem da requisição, ...
...
- `npm run db:migrate:local` / `db:migrate:remote`
...
- `scripts/generate-sitemap.ts` — gera `public/sitemap.xml` e `public/robots.txt` (versionados; não edite à mão). ...
```

### Conferência dos trechos (rode antes do Passo 0)

Cada linha imprime um número; o esperado está no comentário. Use `-E` como
está (o `grep` do macOS erra alternância `\|` com `^...$` sem ele). Tudo
conferido em disco quando o plano foi escrito.

```bash
grep -cE '"engines"|"predev"|"setup"' package.json                                   # 0
grep -c '"dev": "vite dev --port 3000",' package.json                                # 1
grep -c '"db:migrate:local": "wrangler d1 migrations apply DB --local",' package.json # 1
grep -c '^BETTER_AUTH_SECRET=$' .dev.vars.example                                    # 1
grep -c '=$' .dev.vars.example                                                       # 9
wc -l < .dev.vars.example                                                            # 33
grep -c 'node-version: 22' .github/workflows/ci.yml .github/workflows/e2e.yml        # 1 em cada
grep -c 'openssl rand -hex 32' .github/workflows/ci.yml .github/workflows/e2e.yml    # 1 em cada
grep -c '^## Começar em cinco comandos$' README.md                                   # 1
grep -c '^Para gerar o segredo (mínimo de 32 caracteres)' README.md                  # 1
grep -c '`/setup` faz tudo isso' README.md                                           # 1
grep -c '^| `npm run dev` | `vite dev --port 3000`: o app em workerd local' README.md # 1
grep -cE '^## Crie o arquivo de segredos locais$|^## Crie as tabelas do banco$|^Faça isso uma vez, e de novo sempre que você criar uma migration nova\.$' content/docs/comecando.mdx  # 3
grep -c '^O comando conversa com você, confere os pré-requisitos' content/docs/comecando.mdx  # 1
grep -c '^- \*\*Erro de tabela inexistente:\*\* rode `npm run db:migrate:local` de novo\.$' content/docs/comecando.mdx  # 1
grep -c '^## ' .claude/skills/setup/SKILL.md                                         # 7
grep -cE '^## 2\. Criar o `\.dev\.vars`$|^## 3\. Banco de dados local$' .claude/skills/setup/SKILL.md  # 2
grep -c 'Refaça o passo 2 e reinicie o dev' .claude/skills/setup/SKILL.md            # 1
grep -c '^npm run cf-typegen$' .claude/skills/setup/SKILL.md                         # 1
grep -c '^- `npm run dev` — `vite dev --port 3000` em http://localhost:3000 (outra porta' AGENTS.md  # 1
grep -c '^- `npm run db:migrate:local` / `db:migrate:remote`$' AGENTS.md             # 1
grep -c '^- `scripts/generate-sitemap.ts` — gera' AGENTS.md                          # 1
ls .nvmrc scripts/setup.ts scripts/dev-vars.ts 2>&1 | grep -c 'No such file'         # 3
```

Qualquer número diferente: STOP (relate qual linha e o número que deu).

### Convenções do repositório que valem aqui

- Tudo em **pt-BR**, simples e direto (público leigo). Comentários explicam o
  porquê.
- Scripts ficam em `scripts/`, rodam com `tsx`, importam com a extensão `.ts`
  e acham a raiz do projeto pelo próprio arquivo. Exemplar:
  `scripts/generate-sitemap.ts`, linhas 1-3 e 12-24:

  ```ts
  // Gera public/sitemap.xml e public/robots.txt. Roda sozinho antes de todo
  // `npm run build` (script `prebuild`); à mão: `npm run sitemap`.
  //
  ...
  import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
  import { join } from 'node:path'
  import { fileURLToPath } from 'node:url'
  import { parse } from 'yaml'

  import { appConfig } from '../src/config/app.ts'
  ...
  const root = fileURLToPath(new URL('..', import.meta.url))
  ```

- Formatação (Biome, `biome.json`): aspas simples, sem ponto e vírgula,
  vírgula no fim, 2 espaços. `scripts/**` entra no lint (`npm run check`) e no
  `tsconfig.json` (`"include": ["src", "e2e", "scripts", ...]`), então o
  arquivo novo passa por `tsc` e Biome.
- Testes: Vitest, ambiente node; o `vitest.config.ts` só exclui `node_modules`,
  `e2e/**` e `.wrangler/**`, então um `scripts/*.test.ts` é achado sozinho.
  Estilo (de `src/config/public-paths.test.ts`):
  `import { describe, expect, it } from 'vitest'`, nomes de teste em pt-BR.
- `process.env` é proibido só dentro de `src/` (regra testada em
  `src/rules.test.ts`); em `scripts/` pode usar `process`.
- Regras do `AGENTS.md` que tocam este plano: "Segredo nunca vai em `"vars"`";
  "Mudou `wrangler.jsonc` ou o `.dev.vars.example`? Regenere e versione o
  arquivo" (aqui só mudam COMENTÁRIOS do `.dev.vars.example`, então o
  `worker-configuration.d.ts` não pode mudar: o passo 5 confere); "NÃO
  instalar o `cf`"; dependências novas: nenhuma neste plano.

## Comandos que você vai usar

| Para quê | Comando | Esperado |
| --- | --- | --- |
| Tipos | `npm run typecheck` | exit 0, sem erros |
| Lint | `npm run check` | exit 0 |
| Testes | `npm run test` | todos passam (hoje 26 arquivos, 212 testes; depois 27 arquivos) |
| Um teste só | `npx vitest run scripts/dev-vars.test.ts` | todos passam |
| Setup | `npm run setup` | exit 0, linhas começando com `[setup]` |
| Migração local (crua) | `npm run db:migrate:local` | exit 0 |
| Dry-run de deploy (opcional, exige `npm run build` antes) | `npx wrangler deploy --dry-run` | exit 0 |

Não é preciso rodar `npm install`: nenhuma dependência muda. Não rode
`npm run e2e` nem `npm run build` como parte deste plano (não são afetados).

## Escopo

**Dentro do escopo** (os únicos arquivos que você pode criar ou modificar):

- `package.json` (só `engines` e os scripts `setup` e `predev`)
- `.nvmrc` (criar)
- `scripts/dev-vars.ts` (criar)
- `scripts/dev-vars.test.ts` (criar)
- `scripts/setup.ts` (criar)
- `.dev.vars.example` (só os comentários das linhas 1 e 7)
- `.github/workflows/ci.yml`
- `.github/workflows/e2e.yml`
- `README.md`
- `content/docs/comecando.mdx`
- `.claude/skills/setup/SKILL.md`
- `AGENTS.md` (só as seções "Comandos" e "Mapa")
- `plans/README.md` (só a linha de status deste plano, se o arquivo existir)

**Fora do escopo** (NÃO toque, mesmo parecendo relacionado):

- `package-lock.json` — nenhuma dependência muda. (`engines` não altera o lock
  a menos que você rode `npm install`; não rode.)
- `.dev.vars` do desenvolvedor — o script o lê e, só se a chave estiver vazia,
  preenche. Você nunca edita, imprime nem commita esse arquivo à mão.
- `e2e/global-setup.ts`, `playwright.config.ts`, `scripts/cold-start-check.ts`
  — já funcionam; trocar a migração deles para o script novo é melhoria
  separada.
- O campo `cloudflare.bindings` do `package.json` e os comentários das outras
  chaves do `.dev.vars.example` — falam do segredo de PRODUÇÃO (botão Deploy),
  onde `openssl rand -base64 32` continua sendo a instrução certa.
- `content/docs/estrutura.mdx`, `content/docs/deploy.mdx`, `e2e/README.md`,
  `.claude/skills/deploy/SKILL.md`, `load/README.md` (linha 42),
  `.claude/skills/tela/SKILL.md` (linha 85), `src/routes/demo/drizzle.tsx`
  (linha 145) e `src/content/blocos-exemplo.ts` (linha 213) — as menções a
  `npm run db:migrate:local` lá continuam corretas (o script continua
  existindo; o bloco de `blocos-exemplo.ts` é só um exemplo de terminal).
- `src/content/landing.ts` — **decisão consciente, não esquecimento.** A
  linha 35 diz "Você clona, roda cinco comandos e publica com um botão" e a
  linha 123 mostra `['npm install', 'npm run db:migrate:local', 'npm run dev']`
  no bloco de terminal. Depois deste plano os dois ficam desatualizados (mas
  não errados: os comandos continuam funcionando). Ficam de fora porque `src/`
  está fora do escopo e a landing tem a própria direção de texto
  (`src/CLAUDE.md`, `/blocos`, `render.test.tsx`). **Não corrija**; cite as duas
  linhas no seu relato final como seguimento sugerido (ver "Notas de
  manutenção").
- `wrangler.jsonc`, `worker-configuration.d.ts`, qualquer coisa em `src/`.
- Capturar o erro "no such table" dentro do app (em `src/`): descartado em
  favor do `predev`, que evita o erro em vez de traduzi-lo.

## Fluxo de git

- A árvore de trabalho tem dezenas de mudanças NÃO commitadas que não são
  suas. **Não rode** `git stash`, `git checkout -- .`, `git reset`,
  `git add -A` nem `git commit -a`.
- **Estado final esperado: nada commitado, nenhuma branch nova, nada
  adicionado ao índice** (`git diff --cached --name-only` vazio). Você entrega
  as mudanças na árvore de trabalho, na `main`, e para.
- Se, e só se, quem te deu este plano pedir um commit por escrito: adicione só
  os arquivos do escopo, um por um pelo nome, e use o estilo de mensagem do
  repositório (frase em pt-BR, área na frente), por exemplo de `git log`:
  `Deploy: passo final de medir a performance`. Sugestão:
  `Setup: npm run setup, predev com migração local e Node 22 declarado`.
- Não faça push nem abra PR.

## Passos

Todos os comandos rodam na raiz do repositório. Os arquivos temporários
deste plano ficam em `${TMPDIR:-/tmp}` com o prefixo `plano004` e são
apagados no Passo 10. Cada bloco de comandos foi escrito para rodar numa
chamada só do shell (não depende de variável ou job de chamada anterior;
o que precisa atravessar passos fica em arquivo).

### Passo 0: Fotografar o estado antes de mexer

```bash
T="${TMPDIR:-/tmp}"
git status --short > "$T/plano004-status-antes.txt"
shasum package-lock.json worker-configuration.d.ts > "$T/plano004-intocados.sha"
git diff -- . ':(exclude)package.json' ':(exclude)README.md' ':(exclude)AGENTS.md' ':(exclude)content/docs/comecando.mdx' ':(exclude).claude/skills/setup/SKILL.md' ':(exclude).github/workflows' ':(exclude).dev.vars.example' | shasum > "$T/plano004-diff-antes.sha"
wc -l < "$T/plano004-status-antes.txt"
cat "$T/plano004-intocados.sha"
npm run check > "$T/plano004-check-antes.txt" 2>&1; echo "check=$?"
```

**Verifique**: o `wc -l` imprime o número de linhas do `git status` (eram 47
quando o plano foi escrito; outro número não é STOP, é só a sua linha de
base); o arquivo `plano004-diff-antes.sha` guarda a "impressão digital" do
`git diff` de todos os arquivos rastreados FORA do escopo (para provar no fim
que você não mexeu em nenhum deles); o `shasum` imprime duas linhas (anote; quando o plano foi escrito, a
do lock era `844febb9f49ecb551543224142e3bd4063cfc92f`; outro valor não é
STOP, desde que ele não mude daqui até o fim); e `check=0`. Não importa se
você já tem `.dev.vars` ou não: o Passo 3 cria se faltar. Se `check` não for 0: STOP (ver "Estado atual").

Se em qualquer momento depois daqui existir o arquivo
`${TMPDIR:-/tmp}/dev.vars.plano004`, é sinal de que o Passo 4 foi
interrompido no meio: antes de qualquer outra coisa, rode
`mv "${TMPDIR:-/tmp}/dev.vars.plano004" .dev.vars` (isso devolve o seu
`.dev.vars` original) e recomece o Passo 4.

### Passo 1: Criar a função pura que edita o texto do `.dev.vars`

Crie `scripts/dev-vars.ts` com exatamente este conteúdo (esta implementação
foi testada fora do repositório contra o `.dev.vars.example` real):

```ts
// Edita o TEXTO de um .dev.vars. Função pura (não lê nem grava arquivo),
// usada por scripts/setup.ts e testada em scripts/dev-vars.test.ts.
//
// Regra: só preenche BETTER_AUTH_SECRET quando a chave está vazia ou não
// existe. Valor já preenchido NUNCA é trocado, e nenhuma outra linha muda.
const KEY = 'BETTER_AUTH_SECRET'

// A chave aparece em alguma linha que não é comentário?
const HAS_KEY = new RegExp(`^[ \\t]*${KEY}[ \\t]*=`, 'm')

// A linha da chave está vazia? Vale `CHAVE=`, `CHAVE=""` e `CHAVE=''`.
// O `(\r?)` guarda o fim de linha do Windows para devolvê-lo igual.
const EMPTY_LINE = new RegExp(
  `^([ \\t]*${KEY}[ \\t]*=)[ \\t]*(?:""|'')?[ \\t]*(\\r?)$`,
  'm',
)

export function fillAuthSecret(
  text: string,
  secret: string,
): { text: string; changed: boolean } {
  // Sem a chave: acrescenta no fim, no mesmo estilo de quebra de linha.
  if (!HAS_KEY.test(text)) {
    const eol = text.includes('\r\n') ? '\r\n' : '\n'
    const gap = text === '' || text.endsWith('\n') ? '' : eol
    return { text: `${text}${gap}${KEY}=${secret}${eol}`, changed: true }
  }
  // Já tem valor: não toca.
  if (!EMPTY_LINE.test(text)) return { text, changed: false }
  return {
    // Função no lugar de string: um `$` no segredo não vira referência de grupo.
    text: text.replace(
      EMPTY_LINE,
      (_line, prefix: string, cr: string) => `${prefix}${secret}${cr}`,
    ),
    changed: true,
  }
}
```

**Verifique**: `npx tsc --noEmit` → exit 0, sem saída.

### Passo 2: Escrever o teste unitário da função

Crie `scripts/dev-vars.test.ts`. Use um segredo de mentira fixo (nunca um
segredo real). Conteúdo:

```ts
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

import { fillAuthSecret } from './dev-vars.ts'

// Valor de mentira, com os caracteres que um base64 pode ter (e um `$`).
const FAKE = 'abc+/=$&x'

describe('fillAuthSecret', () => {
  it('preenche a chave vazia do .dev.vars.example e não muda mais nada', () => {
    const example = readFileSync(
      fileURLToPath(new URL('../.dev.vars.example', import.meta.url)),
      'utf8',
    )
    const result = fillAuthSecret(example, FAKE)
    expect(result.changed).toBe(true)
    expect(result.text).toContain(`\nBETTER_AUTH_SECRET=${FAKE}\n`)
    // Tirando o valor, o texto volta a ser idêntico ao exemplo.
    expect(
      result.text.replace(`BETTER_AUTH_SECRET=${FAKE}`, 'BETTER_AUTH_SECRET='),
    ).toBe(example)
  })

  it('nunca sobrescreve um valor já preenchido', () => {
    const text = 'BETTER_AUTH_SECRET=ja-existe\nOUTRA=1\n'
    expect(fillAuthSecret(text, FAKE)).toEqual({ text, changed: false })
  })

  it('não sobrescreve valor entre aspas', () => {
    const text = 'BETTER_AUTH_SECRET="ja-existe"\n'
    expect(fillAuthSecret(text, FAKE)).toEqual({ text, changed: false })
  })

  it('rodar duas vezes não troca o segredo gerado na primeira', () => {
    const first = fillAuthSecret('BETTER_AUTH_SECRET=\n', FAKE)
    expect(fillAuthSecret(first.text, 'outro')).toEqual({
      text: first.text,
      changed: false,
    })
  })

  it.each([
    ['aspas duplas vazias', 'BETTER_AUTH_SECRET=""\nX=1\n'],
    ['aspas simples vazias', "BETTER_AUTH_SECRET=''\nX=1\n"],
    ['só espaços', 'BETTER_AUTH_SECRET=   \nX=1\n'],
  ])('trata %s como vazio', (_nome, text) => {
    expect(fillAuthSecret(text, FAKE)).toEqual({
      text: `BETTER_AUTH_SECRET=${FAKE}\nX=1\n`,
      changed: true,
    })
  })

  it('preserva quebras de linha do Windows (CRLF)', () => {
    expect(
      fillAuthSecret('A=1\r\nBETTER_AUTH_SECRET=\r\nB=2\r\n', FAKE),
    ).toEqual({
      text: `A=1\r\nBETTER_AUTH_SECRET=${FAKE}\r\nB=2\r\n`,
      changed: true,
    })
  })

  it('acrescenta a chave quando ela não existe', () => {
    expect(fillAuthSecret('A=1', FAKE)).toEqual({
      text: `A=1\nBETTER_AUTH_SECRET=${FAKE}\n`,
      changed: true,
    })
    expect(fillAuthSecret('', FAKE)).toEqual({
      text: `BETTER_AUTH_SECRET=${FAKE}\n`,
      changed: true,
    })
  })

  it('linha comentada não conta como chave', () => {
    expect(fillAuthSecret('# BETTER_AUTH_SECRET=\nA=1\n', FAKE)).toEqual({
      text: `# BETTER_AUTH_SECRET=\nA=1\nBETTER_AUTH_SECRET=${FAKE}\n`,
      changed: true,
    })
  })

  it('não confunde com chave de nome parecido', () => {
    expect(
      fillAuthSecret('BETTER_AUTH_SECRET=\nBETTER_AUTH_SECRET_OLD=\n', FAKE)
        .text,
    ).toBe(`BETTER_AUTH_SECRET=${FAKE}\nBETTER_AUTH_SECRET_OLD=\n`)
  })
})
```

**Verifique**: `npx vitest run scripts/dev-vars.test.ts` → `Test Files 1 passed (1)`,
`Tests 11 passed (11)`, exit 0. (O texto acima já está no formato do Biome;
se mesmo assim o Biome reformatar alguma quebra de linha no Passo 9, tudo
bem: o número de testes é o que importa.)

### Passo 3: Criar `scripts/setup.ts`

Crie `scripts/setup.ts` com este conteúdo:

```ts
// Primeira configuração do projeto, sem precisar de nenhuma ferramenta de IA.
// Roda com `npm run setup` e também sozinho antes de todo `npm run dev`
// (script `predev`). Pode rodar quantas vezes quiser: só faz o que falta.
//
// O que faz, nesta ordem:
// 1. Confere a versão do Node (22 ou mais novo).
// 2. Cria o .dev.vars a partir do .dev.vars.example, se ele não existir.
// 3. Gera BETTER_AUTH_SECRET se estiver vazio. Nunca troca um valor que já
//    existe e nunca mostra o valor na tela.
// 4. Aplica as migrações no D1 local (.wrangler/state/). Não usa a nuvem nem
//    pede login na Cloudflare.
import { spawnSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { fillAuthSecret } from './dev-vars.ts'

const root = fileURLToPath(new URL('..', import.meta.url))
const examplePath = join(root, '.dev.vars.example')
const devVarsPath = join(root, '.dev.vars')
const wranglerBin = join(root, 'node_modules', 'wrangler', 'bin', 'wrangler.js')

const log = (message: string) => console.log(`[setup] ${message}`)
function fail(message: string): never {
  console.error(`[setup] ERRO: ${message}`)
  process.exit(1)
}

// 1. Node
const major = Number(process.versions.node.split('.')[0])
if (major < 22) {
  fail(
    `este projeto precisa do Node.js 22 ou mais novo, e você está no ${process.versions.node}. ` +
      'Instale a versão 22 em https://nodejs.org (ou `nvm install` nesta pasta) e rode de novo.',
  )
}

// 2. .dev.vars
if (!existsSync(devVarsPath)) {
  if (!existsSync(examplePath)) {
    fail('não achei o .dev.vars.example. Rode o comando na pasta do projeto.')
  }
  copyFileSync(examplePath, devVarsPath)
  log('criei o .dev.vars a partir do .dev.vars.example')
}

// 3. Segredo das sessões (só se estiver vazio; o valor nunca vai para a tela)
const filled = fillAuthSecret(
  readFileSync(devVarsPath, 'utf8'),
  randomBytes(32).toString('base64'),
)
if (filled.changed) {
  writeFileSync(devVarsPath, filled.text)
  log('gerei o BETTER_AUTH_SECRET no .dev.vars (o valor não aparece aqui)')
}

// 4. Banco local. Chama o wrangler pelo arquivo dele (funciona igual no
// Windows) e com a entrada fechada (`stdin: 'ignore'`): assim ele não para
// para perguntar "Ok to proceed?" antes de aplicar as migrações.
if (!existsSync(wranglerBin)) {
  fail('as dependências não estão instaladas. Rode `npm install` primeiro.')
}
const migration = spawnSync(
  process.execPath,
  [wranglerBin, 'd1', 'migrations', 'apply', 'DB', '--local'],
  { cwd: root, stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8' },
)
if (migration.status !== 0) {
  // Só em erro a saída do wrangler aparece (ela não contém segredos).
  console.error(migration.stdout)
  console.error(migration.stderr)
  fail(
    'não consegui aplicar as migrações no banco local. Veja a mensagem acima; ' +
      'para tentar à mão: npm run db:migrate:local',
  )
}
log(
  migration.stdout.includes('No migrations to apply')
    ? 'banco local em dia'
    : 'migrações aplicadas no banco local',
)
log('pronto. O app sobe com: npm run dev (http://localhost:3000)')
```

Ainda NÃO ligue no `package.json`. Rode direto, uma vez:

**Verifique**:

```bash
T="${TMPDIR:-/tmp}"
npx tsx scripts/setup.ts > "$T/plano004-setup.log" 2>&1; echo "exit=$?"
grep -Ec '^BETTER_AUTH_SECRET=.{32,}$' .dev.vars
grep -cF -e "$(sed -n 's/^BETTER_AUTH_SECRET=//p' .dev.vars)" "$T/plano004-setup.log"
grep -vc '^\[setup\]' "$T/plano004-setup.log"
```

(Os comandos acima nunca mostram o segredo: `-c` só conta. O terceiro conta
quantas linhas da saída contêm o valor exato do segredo.)

→ `exit=0`; depois `1` (a chave existe e tem 32+ caracteres); depois `0`
(o segredo não apareceu na saída; se der qualquer outro número, é STOP: NÃO
abra o log, apague-o com `rm "${TMPDIR:-/tmp}/plano004-setup.log"` e relate);
depois `0` (todas as linhas começam com `[setup]`). Só então olhe a saída com
`cat "${TMPDIR:-/tmp}/plano004-setup.log"`: são 2, 3 ou 4 linhas, a última é
`[setup] pronto. O app sobe com: npm run dev (http://localhost:3000)` e a
penúltima é `[setup] banco local em dia` OU
`[setup] migrações aplicadas no banco local` (antes delas podem aparecer
`[setup] criei o .dev.vars ...` e `[setup] gerei o BETTER_AUTH_SECRET ...`,
se o seu `.dev.vars` não existia ou estava com a chave vazia).

Se o comando ficar parado mais de 30 s, interrompa (Ctrl-C) e veja as
Condições de STOP.

### Passo 4: Conferir que o script não sobrescreve e que funciona do zero

Idempotência (não troca o segredo que já existe):

```bash
T="${TMPDIR:-/tmp}"
shasum .dev.vars > "$T/plano004.sha" && npx tsx scripts/setup.ts > /dev/null 2>&1 && shasum -c "$T/plano004.sha"
```

**Verifique**: a última linha é `.dev.vars: OK`.

Do zero (sem `.dev.vars`), guardando o seu arquivo FORA do repositório e
devolvendo no fim. Rode o bloco INTEIRO de uma vez (é um `if` só: o `mv` de
volta roda mesmo que algum comando do meio falhe):

```bash
T="${TMPDIR:-/tmp}"
B="$T/dev.vars.plano004"
if mv .dev.vars "$B"; then
  npx tsx scripts/setup.ts > "$T/plano004-zero.log" 2>&1; echo "setup_exit=$?"
  echo "vazou=$(grep -cF -e "$(sed -n 's/^BETTER_AUTH_SECRET=//p' .dev.vars)" "$T/plano004-zero.log")"
  echo "tamanho44=$(grep -Ec '^BETTER_AUTH_SECRET=.{44}$' .dev.vars)"
  diff <(sed 's/^BETTER_AUTH_SECRET=.*/BETTER_AUTH_SECRET=/' .dev.vars) .dev.vars.example > /dev/null && echo IGUAL || echo DIFERENTE
  mv "$B" .dev.vars && echo RESTAURADO
else
  echo "MV_FALHOU"
fi
shasum -c "$T/plano004.sha"
```

**Verifique**: `setup_exit=0`; `vazou=0` (se não for 0: STOP, apague o log
com `rm "${TMPDIR:-/tmp}/plano004-zero.log"` sem abrir e relate);
`tamanho44=1` (32 bytes em base64 = 44 caracteres); `IGUAL`; `RESTAURADO`;
e a última linha é `.dev.vars: OK` (seu arquivo original voltou intacto).
Com `vazou=0`, confira a saída do script com
`cat "${TMPDIR:-/tmp}/plano004-zero.log"`: exatamente 4 linhas, nesta ordem:

```
[setup] criei o .dev.vars a partir do .dev.vars.example
[setup] gerei o BETTER_AUTH_SECRET no .dev.vars (o valor não aparece aqui)
[setup] banco local em dia
[setup] pronto. O app sobe com: npm run dev (http://localhost:3000)
```

(O banco já estava em dia pelo Passo 3, por isso "em dia".) Se aparecer
`MV_FALHOU`, nada foi feito: relate o erro do `mv`. Se aparecer
`RESTAURADO` mas o `shasum -c` não der `OK`, ou se não aparecer `RESTAURADO`,
é STOP: relate o caminho do backup (`${TMPDIR:-/tmp}/dev.vars.plano004`) sem
mostrar o conteúdo. Se o bloco for interrompido no meio (Ctrl-C, queda),
rode `mv "${TMPDIR:-/tmp}/dev.vars.plano004" .dev.vars` à mão antes de
qualquer outra coisa.

### Passo 5: Ligar no `package.json`, declarar o Node e criar o `.nvmrc`

Em `package.json`:

1. Logo depois da linha `"type": "module",` acrescente:

   ```json
   "engines": {
     "node": ">=22"
   },
   ```

2. Em `"scripts"`, acrescente duas linhas ANTES de `"dev"`:

   ```json
   "setup": "tsx scripts/setup.ts",
   "predev": "tsx scripts/setup.ts",
   ```

   (`predev` chama o `tsx` direto, e não `npm run setup`, para não pagar a
   subida de um segundo `npm`.) Não mexa em nenhum outro script.

Crie `.nvmrc` na raiz com uma linha só:

```
22
```

Em `.dev.vars.example`, troque só os comentários das linhas 1 e 7:

As duas linhas novas abaixo contêm crases (`` ` ``) de verdade: copie como
estão, crases incluídas (no arquivo, elas são texto de comentário).

- linha 1, de
  ``# Segredos LOCAIS. Copie para .dev.vars (não versionado): cp .dev.vars.example .dev.vars``
  para
  ``# Segredos LOCAIS. O `npm run setup` (e o `npm run dev`) copia este arquivo para .dev.vars (não versionado).``
- linha 7, de
  ``# Assina os cookies de sessão. Gere com: openssl rand -base64 32``
  para
  ``# Assina os cookies de sessão. O `npm run setup` gera um sozinho; à mão: openssl rand -base64 32``

**Verifique**:

```bash
node -e "const p=require('./package.json');console.log(p.engines.node,'|',p.scripts.setup,'|',p.scripts.predev,'|',p.scripts.dev)"
cat .nvmrc
npm run setup 2>&1 | tail -2
grep -c '=$' .dev.vars.example
sed -n '1p;7p' .dev.vars.example
npm run typecheck > /dev/null 2>&1; echo "typecheck=$?"
shasum -c "${TMPDIR:-/tmp}/plano004-intocados.sha"
```

→ primeira linha: `>=22 | tsx scripts/setup.ts | tsx scripts/setup.ts | vite dev --port 3000`;
`.nvmrc` mostra `22`; o `npm run setup` termina com as duas linhas
`[setup] banco local em dia` e `[setup] pronto. O app sobe com: npm run dev (http://localhost:3000)`;
o `grep -c` imprime `9` (as 9 chaves continuam vazias no exemplo); o `sed`
mostra as duas linhas novas, com crases; `typecheck=0`; e o `shasum -c`
imprime `package-lock.json: OK` e `worker-configuration.d.ts: OK` (os tipos
gerados e o lock estão byte a byte iguais ao Passo 0). Não use
`git status` para isso: o lock já aparecia como ` M` antes de você começar.
Se `worker-configuration.d.ts` der `FAILED`: STOP. Se `package-lock.json`
der `FAILED`: STOP (algo rodou `npm install`).

### Passo 6: Conferir o `predev` de verdade

Este passo vale com a porta 3000 livre OU ocupada: o `npm run dev` não usa
`--strictPort`, então se a 3000 estiver ocupada o Vite sobe na próxima porta
livre e escreve a URL real na linha `Local:` do log. O bloco abaixo lê a
porta dali, nunca supõe 3000. Ele também anota, ANTES de subir, todos os
processos que já escutavam em alguma porta, e no fim só encerra processo que
não estava nessa lista (assim um servidor seu, de outro projeto, nunca é
morto).

Rode o bloco inteiro numa chamada só do shell (ele espera sozinho: até 60 s
pela URL e mais até 30 s pelo `200`; dê ao comando um tempo-limite de pelo
menos 150 s):

```bash
T="${TMPDIR:-/tmp}"; LOG="$T/plano004-dev.log"; : > "$LOG"
lsof -nP -iTCP -sTCP:LISTEN -t 2>/dev/null | sort -u > "$T/plano004-pids-antes.txt"
npm run dev > "$LOG" 2>&1 &
NPM_PID=$!
URL=""
for i in $(seq 1 60); do
  URL=$(grep 'Local:' "$LOG" | grep -oE 'http://localhost:[0-9]+/' | head -1)
  [ -n "$URL" ] && break
  sleep 1
done
echo "url=${URL:-NENHUMA}"
CODE=000
if [ -n "$URL" ]; then
  for i in $(seq 1 30); do
    CODE=$(curl -s -o /dev/null -w "%{http_code}" "${URL}login")
    [ "$CODE" = 200 ] && break
    sleep 1
  done
fi
echo "login=$CODE"
echo "linhas_setup=$(grep -c '^\[setup\]' "$LOG")"
L_SETUP=$(grep -n '^\[setup\] pronto' "$LOG" | head -1 | cut -d: -f1)
L_VITE=$(grep -n 'Local:' "$LOG" | head -1 | cut -d: -f1)
[ -n "$L_SETUP" ] && [ -n "$L_VITE" ] && [ "$L_SETUP" -lt "$L_VITE" ] && echo "ordem=ok" || echo "ordem=ERRADA"
PORT=$(echo "$URL" | grep -oE '[0-9]+' | tail -1)
NOVOS=""
if [ -n "$PORT" ]; then
  NOVOS=$(lsof -nP -iTCP:"$PORT" -sTCP:LISTEN -t 2>/dev/null | sort -u | comm -23 - "$T/plano004-pids-antes.txt")
fi
kill $NPM_PID $NOVOS 2>/dev/null
for i in $(seq 1 10); do
  kill -0 $NPM_PID $NOVOS 2>/dev/null || break
  sleep 1
done
kill -0 $NPM_PID $NOVOS 2>/dev/null && echo "parou=NAO" || echo "parou=sim"
```

**Verifique**: `url=http://localhost:<porta>/` (3000 se estava livre, outra
se não); `login=200`; `linhas_setup=2` (o `.dev.vars` já existe e está em
dia, então só "banco local em dia" e "pronto"); `ordem=ok` (a linha
`[setup] pronto` veio ANTES da linha `Local:` do Vite: o `predev` rodou
antes do servidor); `parou=sim`.

Se der `url=NENHUMA`: o servidor não subiu em 60 s. Abra o log
(`cat "${TMPDIR:-/tmp}/plano004-dev.log"`; ele não contém o segredo, só a
saída do setup e do Vite) e confira se o processo sobrou com
`lsof -nP -iTCP -sTCP:LISTEN -t | sort -u | comm -23 - "${TMPDIR:-/tmp}/plano004-pids-antes.txt"`
(lista só os processos novos; encerre esses com `kill <pid>`). Tente o bloco
uma segunda vez; se falhar de novo, é STOP. Se der `parou=NAO`, encerre os
PIDs da lista acima com `kill <pid>` e relate.

Este passo não é dispensável: `ordem=ok` é a única prova de que o `predev`
roda antes do Vite.

### Passo 7: Apontar os dois workflows para o script

Em `.github/workflows/ci.yml`:

- troque `          node-version: 22` por `          node-version-file: .nvmrc`;
- troque o passo ".dev.vars de mentira" inteiro (comentário + `run: |` com
  `cp` e `sed`) por:

  ```yaml
      # O .dev.vars não é versionado e chave real nunca entra no CI: o build,
      # o prerender e os testes rodam com um segredo aleatório descartável.
      # `npm run setup` é o mesmo comando que o aluno roda: cria o .dev.vars,
      # gera o segredo e aplica as migrações no D1 local.
      - name: .dev.vars de mentira e banco local
        run: npm run setup
  ```

Em `.github/workflows/e2e.yml`:

- troque `          node-version: 22` por `          node-version-file: .nvmrc`;
- troque o passo ".dev.vars de mentira" inteiro por:

  ```yaml
      # Segredo aleatório: o login do teste usa o código impresso no log do
      # servidor, então nenhuma chave real é necessária. `npm run setup` cria
      # o .dev.vars, gera o segredo e aplica as migrações no D1 local.
      - name: .dev.vars de mentira e banco local
        run: npm run setup
  ```

Mantenha a indentação de 6 espaços dos outros passos. Não mexa em mais nada
(nem no comentário "O próprio Playwright aplica as migrações...", que continua
verdadeiro).

**Verifique**:

```bash
node -e "const y=require('yaml'),fs=require('fs');for(const f of ['ci','e2e']){const d=y.parse(fs.readFileSync('.github/workflows/'+f+'.yml','utf8'));const s=Object.values(d.jobs)[0].steps;console.log(f,s.length,s[1].with['node-version-file'],s.filter(x=>x.run==='npm run setup').length)}"
grep -rn "openssl\|sed -i\|node-version: 22" .github/workflows; echo "grep=$?"
```

→ `ci 11 .nvmrc 1` e `e2e 8 .nvmrc 1`; o `grep` não acha nada (`grep=1`).

### Passo 8: Atualizar README, docs, a skill `/setup` e o `AGENTS.md`

Texto em pt-BR, direto, sem travessão no meio de frase. Mantenha o resto de
cada arquivo como está. Todo texto novo abaixo é literal: as crases dentro
dele (`` `npm run setup` ``, `` `.dev.vars` `` etc.) vão para o arquivo como
estão. Quando um item da lista mostra o texto novo entre crases simples,
copie o miolo (o que está dentro do par externo de crases), incluindo as
crases internas.

**`README.md`**

- Seção "Começar em cinco comandos": troque o título para
  `## Começar em três comandos`, o bloco de comandos para

  ```bash
  git clone <url-do-seu-repositorio> meu-app && cd meu-app
  npm install
  npm run dev                           # http://localhost:3000
  ```

  e substitua o parágrafo "Para gerar o segredo ..." junto com o bloco
  `node -e ...` por este parágrafo:

  ```markdown
  Na primeira vez, o `npm run dev` prepara tudo sozinho antes de subir: cria o
  `.dev.vars` (os segredos locais, fora do git), gera o `BETTER_AUTH_SECRET` e
  cria as tabelas no banco local. Nas outras vezes ele só confere (uns 2
  segundos). Para rodar só essa preparação: `npm run setup`. Ele nunca troca um
  segredo que já existe. Funciona igual no Windows, no macOS e no Linux.
  ```

  Mantenha a linha "Avisos do `npm install` ..." logo depois. Tudo o que
  vem depois dela até o parágrafo "Com o Claude Code aberto..." (o parágrafo
  do `npm run e2e`, o "Abra http://localhost:3000/login...", o bloco
  `[auth] código de login...` e a linha "O login com senha é opcional...")
  fica intocado.
- Parágrafo "Com o Claude Code aberto na pasta, `/setup` faz tudo isso, ...":
  troque `` `/setup` faz tudo isso `` por
  `` `/setup` roda esse mesmo `npm run setup` e confere o app ``.
- Tabela "Scripts": troque a linha do `npm run dev` e acrescente uma linha
  antes dela:

  ```markdown
  | `npm run setup` | prepara o projeto: cria o `.dev.vars`, gera o `BETTER_AUTH_SECRET` se estiver vazio e aplica as migrações no D1 local. Pode repetir |
  | `npm run dev` | roda o `setup` (`predev`) e depois `vite dev --port 3000`: o app em workerd local com D1, R2 e DO simulados |
  ```

**`content/docs/comecando.mdx`**

- Substitua as duas seções "## Crie o arquivo de segredos locais" e
  "## Crie as tabelas do banco" (linhas 30-62, do título da primeira até a
  frase "Faça isso uma vez, e de novo sempre que você criar uma migration
  nova.") por UMA seção:

  ````markdown
  ## Prepare o projeto

  ```bash
  npm run setup
  ```

  Esse comando faz três coisas, e pode ser repetido sem medo:

  1. Cria o arquivo `.dev.vars`, onde ficam os segredos locais. Ele **nunca vai para o Git**.
  2. Gera o `BETTER_AUTH_SECRET`, a chave que assina as sessões. Se já existir uma, ele não troca.
  3. Cria as tabelas no banco local, um D1 simulado guardado na pasta `.wrangler/state`.

  O `npm run dev` roda essa mesma preparação antes de subir, então você pode pular este passo. Ele também aplica sozinho as migrations novas que você criar.

  As outras chaves do `.dev.vars` (Resend, Google, GitHub) são opcionais no seu computador. Sem elas o template continua funcionando: os e-mails aparecem no terminal em vez de serem enviados (isso só vale no localhost; em produção é preciso um provedor de e-mail). O login com senha é opcional e vem desligado: `PASSWORD_LOGIN_ENABLED=true` no `.dev.vars` liga.
  ````

- Na seção "Usando o Claude Code", troque a frase "O comando conversa com
  você, confere os pré-requisitos, cria o `.dev.vars`, aplica as migrations e
  sobe o servidor." por "O comando confere os pré-requisitos, roda o
  `npm run setup`, sobe o servidor e confere que o app abriu."
- Em "Se algo der errado", troque o item de tabela inexistente por:
  `- **Erro de tabela inexistente:** rode `npm run setup` (ou só `npm run db:migrate:local`). Isso acontece quando o servidor foi iniciado com `npx vite dev`, que pula a preparação.`
- Não mexa no frontmatter.

**`.claude/skills/setup/SKILL.md`**

- No frontmatter, mantenha `name` e `description` (a descrição continua
  verdadeira).
- Substitua as linhas 20 a 59 (do título "## 2. Criar o `.dev.vars`" até a
  linha em branco antes de "## 4. Subir e conferir", o que inclui a seção
  "## 3. Banco de dados local" e o bloco ` ```bash ` com `npm run cf-typegen`
  das linhas 47-49, que SOME de propósito: a frase sobre o `cf-typegen`
  passa a terminar em ponto) pelo bloco abaixo, e renumere os títulos
  seguintes (`## 4.`→`## 3.`, `## 5.`→`## 4.`, `## 6.`→`## 5.`; só o
  número, o resto do título fica igual). Deixe uma linha em branco entre o
  fim do bloco e o `## 3. Subir e conferir`.

  ````markdown
  ## 2. Preparar (`.dev.vars`, segredo e banco local)

  ```bash
  npm run setup
  ```

  O script `scripts/setup.ts` cria o `.dev.vars` a partir do
  `.dev.vars.example` (se faltar), gera o `BETTER_AUTH_SECRET` (só se estiver
  vazio; nunca troca nem mostra o valor) e aplica as migrações no D1 local, em
  `.wrangler/state/` (ignorado pelo git). Pode repetir à vontade, e o
  `npm run dev` roda o mesmo script antes de subir (`predev`).

  Não leia o `.dev.vars` em voz alta nem cole o conteúdo dele na conversa, e
  nunca `git add -f` nele. As outras chaves podem ficar vazias: sem
  `RESEND_API_KEY` o e-mail aparece no terminal, e sem as chaves do
  Google/GitHub os botões de login social simplesmente não aparecem.

  A URL do app é deduzida da requisição, em qualquer porta; `BETTER_AUTH_URL`
  é opcional (só para fixar uma URL). O login com senha é opcional e vem desligado
  (`PASSWORD_LOGIN_ENABLED=true` liga).

  Os tipos dos bindings já vêm prontos em `worker-configuration.d.ts`; só rode `npm run cf-typegen` se mudar o `wrangler.jsonc` ou o `.dev.vars.example`.
  ````

- Em "Problemas comuns", troque "Refaça o passo 2 e reinicie o dev" por
  "Rode `npm run setup` e reinicie o dev" (o " (os segredos são lidos ao
  iniciar)." que vem depois fica), e acrescente, logo depois desse item, o
  item:
  `- **Erro de tabela inexistente** ao pedir o código: o servidor subiu sem a preparação (por exemplo com `npx vite dev`). Rode `npm run setup`.`

**`AGENTS.md`** (seção "## Comandos")

- Acrescente, como PRIMEIRO item da lista:
  `- `npm run setup` — `scripts/setup.ts` (via `tsx`): cria o `.dev.vars` se faltar, gera `BETTER_AUTH_SECRET` só se estiver vazio (nunca sobrescreve nem imprime) e aplica as migrações no D1 local. Idempotente; roda sozinho antes do `npm run dev` (`predev`). Os workflows do GitHub usam o mesmo comando.`
- No item do `npm run dev`, troque o começo
  `` `npm run dev` — `vite dev --port 3000` em http://localhost:3000 ``
  por
  `` `npm run dev` — roda o `setup` (`predev`, uns 2 s) e depois `vite dev --port 3000` em http://localhost:3000 ``
  e não acrescente mais nada: o resto da linha, a partir de
  ` (outra porta: `npx vite dev --port 3001`; ...`, fica igual. (Nota só
  para você, NÃO é texto a escrever: `npx vite dev` pula o `predev`, e isso
  já está documentado na seção "Notas de manutenção" deste plano e no item
  novo do `comecando.mdx`.)
- Na seção "## Mapa", logo depois do item `scripts/generate-sitemap.ts`,
  acrescente:
  `- `scripts/setup.ts` — a preparação do primeiro uso (`npm run setup` e `predev`); a edição do texto do `.dev.vars` é a função pura `fillAuthSecret` em `scripts/dev-vars.ts` (testada em `scripts/dev-vars.test.ts`). Versão mínima do Node: `engines` no `package.json` e `.nvmrc` (o CI lê o `.nvmrc`).`

**Verifique**:

```bash
grep -c "npm run setup" README.md content/docs/comecando.mdx .claude/skills/setup/SKILL.md AGENTS.md
grep -n "cp .dev.vars.example\|randomBytes" README.md content/docs/comecando.mdx .claude/skills/setup/SKILL.md; echo "grep=$?"
grep -n "openssl" README.md content/docs/comecando.mdx .claude/skills/setup/SKILL.md; echo "grep=$?"
grep -c "^## " .claude/skills/setup/SKILL.md
```

→ primeira: cada um dos quatro arquivos com contagem ≥ 2; segunda: nada
(`grep=1`); terceira: nada (`grep=1`); quarta: `6` (eram 7 títulos `##`: seis
numerados mais "Problemas comuns"; agora cinco numerados mais "Problemas
comuns").

### Passo 9: Rodada final de verificação

```bash
T="${TMPDIR:-/tmp}"
git diff | shasum > "$T/plano004-diff-pre-fix.sha"
npm run check:fix -- scripts/dev-vars.ts scripts/dev-vars.test.ts scripts/setup.ts; echo "fix=$?"
git diff | shasum | diff - "$T/plano004-diff-pre-fix.sha" > /dev/null && echo "rastreados=iguais" || echo "rastreados=MUDARAM"
npm run check > /dev/null 2>&1; echo "check=$?"
npm run typecheck > /dev/null 2>&1; echo "typecheck=$?"
npm run test
```

O `check:fix` recebe só os três caminhos de `scripts/`, então não toca em
mais nada. A prova objetiva: os três arquivos novos não são rastreados pelo
git (não entram no `git diff`), então se o `git diff` de tudo o que é
rastreado tiver o mesmo `shasum` antes e depois, nenhum arquivo rastreado
mudou.

**Verifique**: `fix=0`; `rastreados=iguais` (se der `MUDARAM`: STOP, rode
`git diff --stat` e relate quais arquivos); `check=0`; `typecheck=0`;
`npm run test` → `Test Files 27 passed (27)` e `Tests 223 passed (223)`
(212 + 11). Se outro trabalho na árvore tiver mudado a linha de base, o que
importa é: zero falhas e `scripts/dev-vars.test.ts` aparecendo com 11 testes.

### Passo 10: Limpar os temporários

```bash
T="${TMPDIR:-/tmp}"
ls "$T/dev.vars.plano004" 2>/dev/null && echo "BACKUP_AINDA_EXISTE" || echo "sem backup pendente"
rm -f "$T"/plano004-setup.log "$T"/plano004-zero.log "$T"/plano004-dev.log \
      "$T"/plano004.sha "$T"/plano004-pids-antes.txt "$T"/plano004-check-antes.txt \
      "$T"/plano004-diff-pre-fix.sha
ls "$T"/plano004* 2>/dev/null
```

**Verifique**: `sem backup pendente` (se der `BACKUP_AINDA_EXISTE`: o
Passo 4 não devolveu o arquivo; NÃO apague, rode
`mv "${TMPDIR:-/tmp}/dev.vars.plano004" .dev.vars`, confira com
`shasum -c "${TMPDIR:-/tmp}/plano004.sha"` ANTES do `rm` e relate). O último
`ls` lista só os três arquivos que os critérios de pronto ainda usam:
`plano004-status-antes.txt`, `plano004-intocados.sha` e
`plano004-diff-antes.sha`. Apague esses três (e o `plano004-status-depois.txt`
que um critério cria) com
`rm -f "${TMPDIR:-/tmp}"/plano004-status-antes.txt "${TMPDIR:-/tmp}"/plano004-status-depois.txt "${TMPDIR:-/tmp}"/plano004-intocados.sha "${TMPDIR:-/tmp}"/plano004-diff-antes.sha`
depois de conferir os critérios de pronto.

## Plano de testes

- Arquivo novo: `scripts/dev-vars.test.ts`, 11 testes sobre `fillAuthSecret`
  (conteúdo no passo 2), no molde de `src/config/public-paths.test.ts`:
  - caminho feliz contra o `.dev.vars.example` real (só a linha da chave muda);
  - a regressão que este plano não pode ter: nunca sobrescrever (valor puro,
    valor entre aspas, segunda execução);
  - vazios disfarçados (`""`, `''`, só espaços);
  - CRLF do Windows; chave ausente (texto sem quebra no fim e texto vazio);
    linha comentada; chave de nome parecido.
- `scripts/setup.ts` não tem teste unitário (é entrada e saída: arquivo e
  processo). Ele é coberto pelos comandos dos passos 3, 4 e 6 e, depois do
  merge, por todo run do CI (que passa a depender de `npm run setup`).
- Verificação: `npm run test` → tudo passa, com 11 testes novos.

## Critérios de pronto

Todos precisam valer, conferidos por comando:

- [ ] `node -e "const p=require('./package.json');process.exit(p.engines?.node==='>=22'&&p.scripts.setup==='tsx scripts/setup.ts'&&p.scripts.predev==='tsx scripts/setup.ts'?0:1)"` sai com 0
- [ ] `cat .nvmrc` imprime `22`
- [ ] `S1=$(shasum .dev.vars); npm run setup > /dev/null 2>&1; e1=$?; npm run setup > /dev/null 2>&1; e2=$?; [ "$e1$e2" = 00 ] && [ "$(shasum .dev.vars)" = "$S1" ] && echo OK || echo FALHOU` imprime `OK` (duas execuções seguidas, as duas com exit 0, e o `.dev.vars` igual byte a byte)
- [ ] `npm run setup 2>&1 | grep -vcE '^\[setup\]|^$|^> '` imprime `0` (só linhas `[setup]`, fora o cabeçalho `> ...` do npm e linhas vazias)
- [ ] `npm run typecheck` sai com 0
- [ ] `npm run check` sai com 0
- [ ] `npm run test` sai com 0 e inclui `scripts/dev-vars.test.ts` (11 testes)
- [ ] `grep -rn "sed -i\|node-version: 22" .github/workflows` não acha nada
- [ ] `grep -c "run: npm run setup" .github/workflows/ci.yml .github/workflows/e2e.yml` imprime `1` para cada arquivo
- [ ] `grep -n "cp .dev.vars.example" README.md content/docs/comecando.mdx .claude/skills/setup/SKILL.md` não acha nada
- [ ] `shasum -c "${TMPDIR:-/tmp}/plano004-intocados.sha"` imprime `package-lock.json: OK` e `worker-configuration.d.ts: OK` (iguais ao Passo 0; o lock continua aparecendo como ` M` no `git status` por trabalho alheio, e isso é esperado)
- [ ] `git diff -- . ':(exclude)package.json' ':(exclude)README.md' ':(exclude)AGENTS.md' ':(exclude)content/docs/comecando.mdx' ':(exclude).claude/skills/setup/SKILL.md' ':(exclude).github/workflows' ':(exclude).dev.vars.example' | shasum | diff - "${TMPDIR:-/tmp}/plano004-diff-antes.sha" && echo FORA_DO_ESCOPO_INTACTO` imprime `FORA_DO_ESCOPO_INTACTO` (nenhum arquivo rastreado fora do escopo mudou desde o Passo 0)
- [ ] `git status --short | sort > "${TMPDIR:-/tmp}/plano004-status-depois.txt"; sort "${TMPDIR:-/tmp}/plano004-status-antes.txt" | comm -13 - "${TMPDIR:-/tmp}/plano004-status-depois.txt"` imprime só linhas destes arquivos do escopo (em qualquer ordem; ` M` de um arquivo que já era ` M` não aparece): `?? .nvmrc`, `?? scripts/dev-vars.test.ts`, `?? scripts/dev-vars.ts`, `?? scripts/setup.ts`, ` M .dev.vars.example`, ` M .github/workflows/ci.yml`, ` M .github/workflows/e2e.yml`. Qualquer outra linha é arquivo fora do escopo: STOP. (Apague o `plano004-status-depois.txt` junto com os outros três no fim.)
- [ ] `git status --short .dev.vars` não imprime nada (continua ignorado)
- [ ] `git diff --cached --name-only` não imprime nada e `git branch --show-current` imprime `main` (nada commitado nem adicionado, nenhuma branch nova)
- [ ] `ls "${TMPDIR:-/tmp}"/dev.vars.plano004 2>/dev/null` não imprime nada (nenhum backup do `.dev.vars` ficou para trás)
- [ ] `plans/README.md`: se `ls plans/README.md` der "No such file", marque este item como N/A (era o caso quando o plano foi escrito; não crie o arquivo). Se existir, a linha deste plano está atualizada
- [ ] No relato final, citadas como seguimento (sem corrigir): `src/content/landing.ts:35` ("roda cinco comandos") e `src/content/landing.ts:123` (bloco de terminal com `npm run db:migrate:local`)

## Condições de STOP

Pare e relate (não improvise) se:

- Algum trecho da seção "Estado atual" não bater com o arquivo em disco (por
  exemplo: já existe `engines`, `predev`, `setup` ou `.nvmrc`; os workflows
  não têm mais o passo ".dev.vars de mentira"; o README não tem mais a seção
  "Começar em cinco comandos").
- O passo 3 imprimir qualquer coisa parecida com o valor do segredo. Não cole
  a saída no relato; diga só que vazou e em qual linha do script.
- `npx tsx scripts/setup.ts` ficar parado mais de 30 s (sinal de que o
  wrangler está esperando resposta a uma pergunta: a suposição "com `stdin`
  ignorado o wrangler aplica as migrações sem perguntar" seria falsa nessa
  versão) ou pedir login na Cloudflare.
- O `mv` de volta do `.dev.vars` no passo 4 falhar, ou o `shasum -c` final do
  passo 4 não der `OK`. Relate o caminho do backup
  (`${TMPDIR:-/tmp}/dev.vars.plano004`) sem mostrar o conteúdo.
- No Passo 0, `npm run check` já sair diferente de 0 (a linha de base do
  Biome quebrou por trabalho alheio).
- O `shasum -c` de `plano004-intocados.sha` der `FAILED` em qualquer ponto
  (`worker-configuration.d.ts` ou `package-lock.json` mudaram).
- O critério `FORA_DO_ESCOPO_INTACTO` falhar, ou o `comm` dos critérios
  listar arquivo fora do escopo.
- A verificação de um passo falhar duas vezes depois de uma tentativa
  razoável de conserto.
- O conserto parecer exigir mexer em arquivo fora do escopo (em especial
  `src/`, `playwright.config.ts`, `e2e/`, `package-lock.json`).
- `node -v` na sua máquina for menor que 22 (o próprio script vai recusar).

## Notas de manutenção

- **Custo do `predev`**: cada `npm run dev` passa a gastar uns 2 s a mais
  (medido: `wrangler d1 migrations apply DB --local` sem nada a aplicar leva
  cerca de 1,8 s, mais a subida do `tsx`). Se isso incomodar, a saída é pular
  o wrangler quando a pasta `drizzle/` não mudou desde a última aplicação; não
  foi feito aqui para manter o script óbvio.
- **Efeito colateral bom**: migration nova criada com `npm run db:generate`
  passa a ser aplicada sozinha no próximo `npm run dev`. Efeito a vigiar: uma
  migração quebrada agora impede o `npm run dev` de subir (o script sai com
  erro e mostra a saída do wrangler). `npx vite dev --port 3000` sobe sem a
  preparação, para depurar.
- **Quem NÃO passa pelo `predev`**: o Playwright (`playwright.config.ts` usa
  `npx vite dev`, e migra em `e2e/global-setup.ts`) e o `test:cold`
  (`scripts/cold-start-check.ts`). Continuam como estavam. Trocar o
  `global-setup.ts` para chamar `scripts/setup.ts` é um seguimento possível,
  deixado de fora.
- **`engines` só avisa**: o npm mostra um aviso (`EBADENGINE`) em Node antigo,
  não bloqueia. Quem bloqueia de verdade, com mensagem em pt-BR, é a
  conferência no começo de `scripts/setup.ts`. O `.nvmrc` também é lido pelo
  Workers Builds (botão Deploy) e por `nvm`/`fnm`. Subir a versão mínima no
  futuro = mudar três lugares: `engines`, `.nvmrc` e o `major < 22` do script
  (README, `comecando.mdx` e a skill citam "22" em texto).
- **Chave nova obrigatória no `.dev.vars.example`** que também precise ser
  gerada: generalize `fillAuthSecret` (hoje o nome da chave é a constante
  `KEY`) e acrescente o teste.
- **O que o revisor deve olhar**: (1) que nenhum caminho de `scripts/setup.ts`
  imprime `filled.text` ou o valor gerado; (2) que `fillAuthSecret` devolve
  `changed: false` para qualquer valor não vazio; (3) que o primeiro run do CI
  depois do merge passa com `npm run setup` (é a primeira vez que o script
  roda em Linux limpo; o `setup-node` com `node-version-file: .nvmrc` também
  estreia ali); (4) o texto novo do README e do `comecando.mdx` na voz do
  template (pt-BR simples, para leigo).
- **Deixado de fora de propósito**: traduzir o erro "no such table" dentro do
  app; `engine-strict` no `.npmrc`; mudar `cloudflare.bindings` do
  `package.json` (segredo de produção continua sendo gerado à mão).
- **Seguimento sugerido (fora deste plano, porque é `src/`)**: a landing
  ainda vende "roda cinco comandos" (`src/content/landing.ts:35`) e mostra
  `npm run db:migrate:local` no terminal (`src/content/landing.ts:123`).
  Depois deste plano o certo seria "três comandos" e o terminal
  `['npm install', 'npm run dev']`. É texto de marketing com direção própria
  (`src/CLAUDE.md`), por isso fica para quem cuida da landing.
- **O que foi e o que não foi conferido antes da execução**:
  - conferido sem alterar a árvore: os trechos citados (bloco "Conferência
    dos trechos"), a linha de base de testes, tipos e Biome, e o Biome
    (lint + formato) nos três arquivos novos via `--stdin-file-path`;
  - conferido fora do repositório, numa cópia, quando o plano foi escrito:
    a migração local com a entrada fechada (`< /dev/null`) aplicando sem
    perguntar e sem login, e os 11 testes de `fillAuthSecret`;
  - só se confirma na execução: que `spawnSync` com `stdin: 'ignore'` se
    comporta como o `< /dev/null` (há STOP de 30 s para isso, no Passo 3);
  - só se confirma depois do merge: o `setup-node@v4` com
    `node-version-file: .nvmrc` (opção documentada da action; o arquivo tem
    só `22`) e o primeiro `npm run setup` num Linux limpo do CI.
