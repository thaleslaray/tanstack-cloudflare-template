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
automático, documentado pela Cloudflare). Não rode `d1 create` nem
`r2 bucket create`. Se o usuário já tem um banco, acrescente `database_id`.

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
```

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
   Replication. Ou pela API (o Wrangler não tem comando para isso), com um token
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
6. Smart Placement já vem ligado no `wrangler.jsonc` (`placement.mode: smart`):
   nada a fazer. A Cloudflare leva até 15 min, e precisa de tráfego real, para
   mover o Worker para perto do banco; o header `cf-placement` mostra
   `remote-XXX` quando moveu.

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
   acima de 500 ms? Confira: réplica ligada (`npx wrangler d1 info`),
   `cf-placement: remote-XXX` na resposta, e quantas consultas a página faz
   (rastreio `x-d1-trace: 1` no `npm run dev`, veja o AGENTS.md).
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
