---
name: deploy
description: Publica o app na Cloudflare Workers com o Wrangler — login, deixa o Wrangler criar o D1 e o R2 no primeiro deploy, aplica as migrações remotas, sobe os segredos e faz o deploy. Use quando o app estiver pronto para ir ao ar ou para publicar uma versão nova.
---

# Publicar na Cloudflare Workers

O agente roda cada comando e edita cada arquivo; o usuário faz o login no
navegador, informa os valores de produção e diz "pode publicar" antes de cada
passo que mexe na conta: o `wrangler deploy`, as migrações `--remote`, os
segredos e o teste de carga. Mostre o comando e espere o sim. A configuração vive em `wrangler.jsonc` e o deploy é com o
Wrangler. Não use o `cf` aqui (ele está em beta; veja o `AGENTS.md`).

## 0. Antes de começar

```bash
npx wrangler login     # abre o navegador; o usuário aprova
npx wrangler whoami    # confere a conta
```

Confirme com o usuário o nome do projeto (hoje `tanstack-cloudflare-template`
em `wrangler.jsonc` e `package.json`) e o domínio final, se houver.
Sem domínio próprio, o app sai em `<nome>.<conta>.workers.dev`.

**Mais de uma conta na Cloudflare?** O Wrangler pergunta qual usar a cada
comando (e trava num terminal sem pergunta). Pegue o id no `npx wrangler whoami`
e fixe com `CLOUDFLARE_ACCOUNT_ID=<id>` na frente de CADA comando do Wrangler
(`deploy`, `secret put`, `d1`, `tail`, `npm run deploy` e `db:migrate:remote`).

## 1. Banco e bucket (criados sozinhos)

O `wrangler.jsonc` não tem `database_id` nem `bucket_name` de propósito: o
Wrangler cria o D1 e o R2 no primeiro `wrangler deploy` (provisionamento
automático, documentado pela Cloudflare). Se o usuário já tem um banco,
acrescente `database_id`.

**Onde o banco fica não muda depois de criado, e decide a velocidade do app.**
Criado pelo provisionamento automático, o D1 nasce "perto de quem pediu a
criação" (doc: developers.cloudflare.com/d1/configuration/data-location/).
Pergunte ao usuário onde está o público. Se ele quer escolher o lugar (ou o
público é de uma região só), crie o banco ANTES do primeiro deploy, com o sim
dele, e ponha o id no `wrangler.jsonc`:

```bash
npx wrangler d1 create <database_name do wrangler.jsonc> --location=enam
# copie o database_id que ele imprime para o d1_databases do wrangler.jsonc
```

Dicas aceitas: `wnam`, `enam`, `weur`, `eeur`, `apac`, `oc`. Não existe dica
para América do Sul, África nem Oriente Médio (o D1 não roda lá): para o
Brasil, `enam`. A dica é "o mais perto possível", não garantia. Dado que
precisa ficar na UE, nos EUA ou em data center FedRAMP: `--jurisdiction=eu`
(ou `us`, `fedramp`), que vale mais que a dica. Fora isso, não rode
`d1 create` nem `r2 bucket create`.

Troque `url` em `src/config/app.ts` pela URL pública ANTES do build
(sitemap, canonical, og:url).

## 2. URL pública

Em produção, `BETTER_AUTH_URL` é OBRIGATÓRIO como segredo (a URL pública
final, ex.: `https://app.seudominio.com.br`). A ordem depende do endereço:

- **Domínio próprio já conhecido:** a URL vai no `.prod.vars` ANTES do
  primeiro deploy.
- **Sem domínio próprio:** o endereço `<nome>.<conta>.workers.dev` só aparece
  no FIM do primeiro deploy. Publique e, logo em seguida, grave a URL com
  `npx wrangler secret put BETTER_AUTH_URL` (com o `CLOUDFLARE_ACCOUNT_ID` se
  houver mais de uma conta), ANTES de qualquer teste ou login.

Motivo: sem ele a URL é deduzida da requisição e cada host que chega
ao Worker vira origem confiável do login; além disso, `workers.dev` e o
domínio próprio têm cookies separados e o OAuth (callback cadastrado no
provedor) só funciona em um deles. Com a variável, o app confia só nessa
origem. No localhost continua opcional.

## 3. Segredos de produção (crie ANTES do primeiro deploy)

Crie um arquivo `.prod.vars` (já está no `.gitignore`; nunca o versione)
com os mesmos nomes do `.dev.vars.example`:

```
BETTER_AUTH_SECRET=<novo, gerado com openssl rand -base64 32>
BETTER_AUTH_URL=<obrigatório em produção: https://app.seudominio.com.br>
RESEND_API_KEY=<OBRIGATÓRIO (ou o binding EMAIL + EMAIL_FROM): sem provedor de e-mail o login não funciona>
EMAIL_FROM=Meu App <contato@seudominio.com.br>
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
PASSWORD_LOGIN_ENABLED=   # opcional; true liga o login com senha
ACCESS_ALLOWLIST=         # só com accessMode 'allowlist' em src/config/app.ts: e-mails que entram, separados por vírgula
```

**Cadastro só para e-mails liberados.** Se `accessMode` em `src/config/app.ts`
for `'allowlist'`, grave a lista como segredo (vazia = ninguém entra, nem você),
com o sim do usuário: `npx wrangler secret put ACCESS_ALLOWLIST` (cole os
e-mails separados por vírgula; ou a linha no `.prod.vars`). Nunca no
`wrangler.jsonc`. Mudar a lista é gravar o segredo de novo; quem sai dela perde
a sessão no próximo pedido. Para o teste de carga (passo 7), as contas de
carga (`load-1@exemplo.test` em diante, uma por `CONTAS`) entram na lista antes
de rodar e saem depois.

Nunca reaproveite o segredo do dev (mínimo de 32 caracteres).

**Provedor de e-mail é obrigatório antes de publicar.** Configure o Resend (ou o
Email Service da Cloudflare, veja `src/lib/email.ts`). Sem provedor, fora do
localhost, o pedido de código de login responde 503 `EMAIL_NAO_CONFIGURADO` e a
tela mostra "O envio de e-mail deste sistema ainda não foi configurado. Avise
quem administra." (antes, a tela dizia "código enviado" e o erro ficava só no
log). Um provedor social (Google/GitHub) não substitui: o login por código
continua na tela. Não publique para uso real sem isto.

## 4. Primeiro deploy

Os segredos do passo 3 já têm de estar no `.prod.vars` (sem domínio próprio,
a `BETTER_AUTH_URL` ainda não existe: grave-a logo depois, veja o passo 2).
Troque também os `namespace_id` dos rate limits no `wrangler.jsonc` (`"1001"` do
público e `"1002"` do limite por usuário) por números próprios do produto (ex.: derivado do nome, como 4 dígitos do
hash dele): ele é único na conta, e dois produtos com o mesmo número dividiriam
o limite.

Depois:

```bash
npm run build
npx wrangler deploy --dry-run
npx wrangler deploy --secrets-file .prod.vars   # cria banco e bucket e publica
npm run db:migrate:remote                       # só depois do primeiro deploy
```

## 5. Deploys seguintes

```bash
npm run deploy    # predeploy migra o banco remoto, depois build + publica
```

Confira:

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://<domínio>/          # 200
curl -s -o /dev/null -w "%{http_code}\n" https://<domínio>/app       # 307 → /login
```

## 6. Depois do deploy

1. Login social: adicione `https://<domínio>/api/auth/callback/google` (e
   `/github`) nos apps OAuth (veja `/google-oauth`).
2. `src/config/app.ts`: confirme que `url` é a URL pública (links em e-mails e SEO).
3. Resend: verifique o domínio de envio e ajuste `EMAIL_FROM`.
4. Domínio próprio: Cloudflare → Workers → o Worker → Domains & Routes. Com
   domínio próprio, recomende desligar `workers_dev` e `preview_urls` (campos
   do `wrangler.jsonc`): senão o app continua acessível também em
   `*.workers.dev` e nas URLs de preview, com cookies separados e uma
   segunda porta de entrada para o mesmo app. Só documentação: o template
   NÃO traz esses campos no `wrangler.jsonc`. Quando o usuário tiver o
   domínio no ar e disser sim, o ajuste é:

   ```jsonc
   "workers_dev": false,
   "preview_urls": false
   ```

   (confira os nomes em `node_modules/wrangler/config-schema.json` antes de
   escrever, e rode `npx wrangler deploy --dry-run`).
5. Réplica de leitura do D1 (deixa as páginas logadas mais rápidas longe do
   banco; sem custo extra). O código já usa a Sessions API; falta ligar no banco,
   uma vez por app. Pelo painel: D1 → o banco → Settings → Enable Read
   Replication (limite: as réplicas ficam em ENAM, WNAM, WEUR, EEUR, APAC e OC;
   não há na América do Sul). Ou pela API (o Wrangler não tem comando para isso), com um token
   que tenha `D1:Edit`. Peça para o usuário rodar `export CLOUDFLARE_API_TOKEN=...`
   no terminal dele; não cole o token no chat.

   ```bash
   npx wrangler d1 info <nome-do-banco>   # mostra o id e "read_replication.mode"
   curl -X PUT "https://api.cloudflare.com/client/v4/accounts/<account_id>/d1/database/<database_id>" \
     -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" -H "Content-Type: application/json" \
     -d '{"read_replication": {"mode": "auto"}}'
   ```

   Confira com `npx wrangler d1 info <nome-do-banco>`: `read_replication.mode`
   deve aparecer `auto`.
6. **Onde o Worker roda** (a conferência que mais pesa na velocidade; faça logo
   depois do deploy e de novo uns 15 min depois, tempo do Smart Placement).
   O D1 tem um primário numa região só; se o Worker roda longe dele, cada
   consulta em fila atravessa o continente. O template vem com
   `placement.mode: smart` (a Cloudflare move o Worker para perto do banco se
   compensar), mas ele só considera locais onde o Worker já rodou: com público de
   uma região só ele não move nada (medido: `local-GIG` por 56 min, D1 em ENAM).
   Confira, nesta ordem:

   a. O cabeçalho de resposta (`remote-XXX` = o Worker foi movido; `local-XXX` =
      rodou perto de quem pediu; XXX é o código de aeroporto do data center):

      ```bash
      curl -sI https://<domínio>/login | grep -i cf-placement
      ```

   b. Onde o Worker rodou e de onde o D1 respondeu, de verdade. Com o sim do
      usuário, ligue o registro de desempenho só para esta conferência, pegue uns
      pedidos logados e desligue:

      ```bash
      npx wrangler secret put PERF_LOG        # digite 1
      npx wrangler tail --format json         # em outro terminal: abra /app e /app/clientes logado
      npx wrangler secret delete PERF_LOG     # ao terminar (o registro gera uma linha por pedido)
      ```

      Em cada linha `{"perf":1,...}` compare `colo` (onde o Worker rodou) com
      `d1_regioes` / `d1[].r` (de onde o D1 respondeu, ex.: `ENAM`) e olhe `fila`
      (idas em fila) e `ms`. Worker no Rio (`GIG`) e D1 em `ENAM` = cada ida paga
      a viagem; com `fila` 2 ou mais, a página sente.
   c. Longe e `ms` alto? Fixe a dica no `wrangler.jsonc`, com o sim do usuário
      (as estratégias `mode`, `region`, `host` e `hostname` se excluem: troque a
      linha, não some): `"placement": { "region": "aws:us-east-1" }` para D1 em
      ENAM (formato `provedor:região`; outras: `gcp:us-east4`, `azure:eastus`;
      lista em developers.cloudflare.com/workers/configuration/placement/).
      Rode `npm run test` (confere o formato), publique e repita a, b e a medição
      do passo 7. Custo da dica: a página pública SSR também roda lá (no
      staging, `/login` foi de 70 para 235 ms); pré-renderizadas e `/assets/`
      saem do ponto mais perto do visitante. Se o ganho logado não compensar,
      volte a `smart` (comando de reverter: o mesmo, com a linha antiga).
   d. Réplica de leitura ligada (item 5)? Em `d1[].p`, `false` = uma réplica
      respondeu. Lembrete: não há réplica na América do Sul (ENAM, WNAM, WEUR,
      EEUR, APAC, OC), então para público só do Brasil a réplica não aproxima o
      dado.

## 7. Passo final: medir a performance

Rode depois que o app estiver no ar, com a réplica ligada e uns 15 min depois
do deploy (tempo do Smart Placement). Use o k6 (`brew install k6` no Mac).

**Antes de rodar, ajuste `load/rotas.json` às telas do produto.** O padrão mede
a tela de clientes de exemplo (no template; num produto, use as telas do próprio produto) e cria/apaga um cliente; se o produto trocou ou
removeu essa tela, aponte as rotas públicas, as logadas e (opcional) a escrita
para o que existe de verdade, ou use `"escrita": null`. Se uma rota configurada
responder 404, o roteiro para antes de medir, com a mensagem dizendo qual.
Detalhes em `load/README.md`.

1. Entre no app pelo navegador. Nas ferramentas do navegador (Application →
   Cookies), copie o valor do cookie `__Secure-better-auth.session_token`.
   É a SUA sessão: não compartilhe e não versione.
2. Rode a escada sem a rajada no login (`SEM_RAJADA=1`: contra um app de
   verdade ela mandaria e-mails reais pelo Resend):

   ```bash
   SEM_RAJADA=1 PROFILE=escada BASE_URL=https://<seu-app> \
   SESSOES_JSON='[{"email":"voce@seudominio.com","cookie":"__Secure-better-auth.session_token=<valor>"}]' \
   npm run load
   ```

   Leva uns 8 min e faz perto de 10 mil pedidos (cerca de 10% da cota
   diária do plano Free de Workers). Se a escrita estiver ligada em
   `load/rotas.json`, cada rodada cria e apaga um registro de teste na sua conta.
3. O resumo mostra o p95 de cada cenário contra a meta: estático < 100 ms,
   SSR público < 300 ms, SSR logado < 500 ms, escrita < 600 ms, e erro < 1%.
4. O CPU por pedido não sai no k6: veja em Cloudflare → Workers → o Worker →
   Observability (campo `cpuTime`, p99 abaixo de 10 ms no plano Free).
5. Compare com os números de referência em `load/README.md`. SSR logado bem
   acima de 500 ms? Confira, nesta ordem: onde o Worker roda (seção 6, item 6: `colo`
   contra `d1[].r`, `cf-placement`), as consultas em fila (`fila` no `PERF_LOG`,
   ou o rastreio `x-d1-trace: 1` no `npm run dev`; veja o AGENTS.md) e a réplica
   ligada (`npx wrangler d1 info`).
6. Anote a data e a tabela em `load/README.md`, para comparar no próximo deploy.

Botão Deploy to Cloudflare (Workers Builds): publica a cada push na `main`.
Build command `npm run build`; deploy command
`npx wrangler deploy && npx wrangler d1 migrations apply DB --remote` (a migração
vai depois porque o banco só existe depois do primeiro deploy).

## Lembretes

- Dependências com `^` e `package-lock.json` versionado; quem clona recebe o lock.
- A saída do build fica em `dist/` (`dist/server/wrangler.json` é a config
  que o Wrangler publica, gerada pelo plugin a partir do `wrangler.jsonc`).
- Logs ao vivo: `npx wrangler tail` (com `CLOUDFLARE_ACCOUNT_ID` se houver mais de uma conta). No macOS não existe `timeout`: para parar, Ctrl+C, ou rode em segundo plano e encerre o processo.
