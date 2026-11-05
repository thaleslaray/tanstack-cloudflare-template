---
name: deploy
description: Publica o app na Cloudflare Workers — login no cf, cria o banco D1 e o bucket R2, troca o UUID placeholder do banco, aplica as migrações remotas, sobe os segredos e faz o deploy. Use quando o app estiver pronto para ir ao ar ou para publicar uma versão nova.
---

# Publicar na Cloudflare Workers

O agente roda cada comando e edita cada arquivo; o usuário só confirma o
que envolve a conta dele (login no navegador) e informa os valores de
produção. Nunca use Wrangler aqui: a configuração vive em
`cloudflare.config.ts` e o deploy é com o `cf`.

## 0. Antes de começar

```bash
npx cf auth login     # abre o navegador; o usuário aprova
```

Confirme com o usuário o nome do projeto (hoje `tanstack-cloudflare-template`
em `cloudflare.config.ts` e `package.json`) e o domínio final, se houver.
Sem domínio próprio, o app sai em `<nome>.<conta>.workers.dev`.

## 1. Banco de dados (D1)

O `cloudflare.config.ts` tem um UUID placeholder
(`11111111-1111-4111-8111-111111111111`) no binding `DB`. Ele serve para o
dev local e precisa virar o ID do banco real:

```bash
npx cf d1 create --name tanstack-cloudflare-template-db
```

Copie o `uuid` que o comando devolve e troque o placeholder nos TRÊS lugares:

1. `cloudflare.config.ts` → `DB: bindings.d1({ ..., id: "<uuid>" })`
2. `package.json` → script `db:migrate:local`
3. `package.json` → script `db:migrate:remote`

(`grep -rn 11111111-1111 cloudflare.config.ts package.json` mostra os três.)

Depois aplique as migrações no banco remoto:

```bash
npm run db:migrate:remote
```

Atenção: o D1 local é chaveado por esse ID. Depois da troca, rode
`npm run db:migrate:local` de novo para o dev continuar funcionando.

## 2. Arquivos (R2)

```bash
npx cf r2 buckets create --name tanstack-cloudflare-template-files
```

Se o nome do bucket em `cloudflare.config.ts` for outro, use o mesmo nome.
(O `cf deploy` também consegue provisionar bindings que faltam, mas criar
antes deixa claro o que existe na conta.)

## 3. URL pública

Em `cloudflare.config.ts`, troque `BETTER_AUTH_URL` de
`http://localhost:3000` para a URL pública (`https://meuapp.exemplo.com.br`
ou a URL `workers.dev`). O Better Auth usa esse valor para cookies e para os
redirects do login social.

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
npx cf deploy --dry-run                      # build + checagens, sem subir nada
npx cf deploy --secrets-file .prod.vars      # publica o Worker e os segredos
```

Confira:

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://<domínio>/          # 200
curl -s -o /dev/null -w "%{http_code}\n" https://<domínio>/conta     # 307 → /login
```

## 6. Depois do deploy

1. Login social: adicione `https://<domínio>/api/auth/callback/google` (e
   `/github`) nos apps OAuth (veja `/google-oauth`).
2. `src/config/app.ts`: ajuste `url` para a URL pública (links em e-mails e SEO).
3. Resend: verifique o domínio de envio e ajuste `EMAIL_FROM`.
4. Domínio próprio: Cloudflare → Workers → o Worker → Domains & Routes.

Deploys seguintes são só `npx cf deploy --secrets-file .prod.vars`
(e `npm run db:migrate:remote` antes, quando houver migração nova: migre
SEMPRE antes de publicar o código que depende da tabela nova).

## Lembretes

- `cf` e o Vite plugin v2 estão em beta; as versões ficam fixadas. Se um
  comando mudar de nome, `npx cf cli search "<o que você quer fazer>"` acha o novo.
- A saída do build fica em `.cloudflare/output/`. `npx cf deploy --prebuilt`
  publica sem rebuildar.
