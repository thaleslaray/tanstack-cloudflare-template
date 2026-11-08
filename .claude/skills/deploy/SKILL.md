---
name: deploy
description: Publica o app na Cloudflare Workers com o Wrangler — login, cria o banco D1 e cola o ID no wrangler.jsonc, cria o bucket R2, aplica as migrações remotas, sobe os segredos e faz o deploy. Use quando o app estiver pronto para ir ao ar ou para publicar uma versão nova.
---

# Publicar na Cloudflare Workers

O agente roda cada comando e edita cada arquivo; o usuário só confirma o
que envolve a conta dele (login no navegador) e informa os valores de
produção. A configuração vive em `wrangler.jsonc` e o deploy é com o
Wrangler. Não use o `cf` aqui (ele está em beta; veja o `CLAUDE.md`).

## 0. Antes de começar

```bash
npx wrangler login     # abre o navegador; o usuário aprova
npx wrangler whoami    # confere a conta
```

Confirme com o usuário o nome do projeto (hoje `tanstack-cloudflare-template`
em `wrangler.jsonc` e `package.json`) e o domínio final, se houver.
Sem domínio próprio, o app sai em `<nome>.<conta>.workers.dev`.

## 1. Banco de dados (D1)

O `wrangler.jsonc` tem `"database_id": "REPLACE_ME"` no binding `DB`. Ele
serve para o dev local e precisa virar o ID do banco real:

```bash
npx wrangler d1 create tanstack-cloudflare-template-db
```

O comando mostra um trecho de config com `database_id`. Copie esse valor
para o `wrangler.jsonc`, no lugar de `REPLACE_ME`. É o único lugar: os
scripts `db:migrate:*` usam o nome do binding (`DB`).

Depois aplique as migrações no banco remoto:

```bash
npm run db:migrate:remote
```

Atenção: o D1 local é chaveado por esse ID. Depois da troca, rode
`npm run db:migrate:local` de novo para o dev continuar funcionando.

## 2. Arquivos (R2)

```bash
npx wrangler r2 bucket create tanstack-cloudflare-template-files
```

Se o `bucket_name` no `wrangler.jsonc` for outro, use o mesmo nome.

## 3. URL pública

No `wrangler.jsonc`, em `"vars"`, troque `BETTER_AUTH_URL` de
`http://localhost:3000` para a URL pública (`https://meuapp.exemplo.com.br`
ou a URL `workers.dev`). O Better Auth usa esse valor para cookies e para os
redirects do login social. Rode `npm run cf-typegen` depois (o tipo do
`env` guarda o valor literal).

## 4. Segredos de produção

Crie um arquivo `.prod.vars` (já está no `.gitignore`; nunca o versione)
com os mesmos nomes do `.dev.vars.example`:

```
BETTER_AUTH_SECRET=<novo, gerado com openssl rand -base64 32>
RESEND_API_KEY=<obrigatório para o código de login chegar por e-mail>
EMAIL_FROM=Meu App <contato@seudominio.com.br>
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
```

Nunca reaproveite o segredo do dev. Sem provedor de e-mail em produção o
código de login vai só para o log, e ninguém consegue entrar: configure o
Resend (ou o Email Service da Cloudflare, veja `src/lib/email.ts`) ou um
provedor social.

## 5. Validar e publicar

```bash
npm run build && npx wrangler deploy --dry-run   # checa config e bindings, sem subir nada
npm run deploy -- --secrets-file .prod.vars      # build + publica o Worker com os segredos
```

O `--dry-run` deve listar `COUNTER`, `DB`, `BUCKET`, `PUBLIC_RATE_LIMIT` e
`BETTER_AUTH_URL`. Prefere subir os segredos à parte? Use
`npx wrangler secret bulk .prod.vars` (todos) ou
`npx wrangler secret put BETTER_AUTH_SECRET` (um por vez, pede o valor).

Confira:

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://<domínio>/          # 200
curl -s -o /dev/null -w "%{http_code}\n" https://<domínio>/app       # 307 → /login
```

## 6. Depois do deploy

1. Login social: adicione `https://<domínio>/api/auth/callback/google` (e
   `/github`) nos apps OAuth (veja `/google-oauth`).
2. `src/config/app.ts`: ajuste `url` para a URL pública (links em e-mails e SEO).
3. Resend: verifique o domínio de envio e ajuste `EMAIL_FROM`.
4. Domínio próprio: Cloudflare → Workers → o Worker → Domains & Routes.

Deploys seguintes são só `npm run deploy` (segredos já ficam no Worker;
use `-- --secrets-file .prod.vars` só quando mudar algum). Quando houver
migração nova, `npm run db:migrate:remote` ANTES: migre sempre antes de
publicar o código que depende da tabela nova.

## Lembretes

- Versões fixadas: `wrangler@4.158.0` e `@cloudflare/vite-plugin@1.67.0`.
- A saída do build fica em `dist/` (`dist/server/wrangler.json` é a config
  que o Wrangler publica, gerada pelo plugin a partir do `wrangler.jsonc`).
- Logs ao vivo: `npx wrangler tail`.
