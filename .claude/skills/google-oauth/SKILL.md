---
name: google-oauth
description: Liga o login com Google — guia o usuário na criação das credenciais OAuth no Google Cloud, grava GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET no .dev.vars (ou nos segredos de produção) e verifica que o botão apareceu. Opcional; o login por código no e-mail já funciona sem isso.
---

# Login com Google

O Google é um dos três jeitos de entrar (os outros: código por e-mail, que
sempre funciona, e GitHub). Quando `GOOGLE_CLIENT_ID` e
`GOOGLE_CLIENT_SECRET` estão preenchidos, o botão "Continuar com Google"
aparece sozinho em `/login`. O agente faz as edições e a verificação; só os
cliques no console do Google precisam do usuário.

## O que o usuário faz no navegador

Mande esta lista com os valores preenchidos (URL do app =
`http://localhost:3000` no dev, a URL pública em produção):

1. Abra https://console.cloud.google.com/apis/credentials (crie ou escolha um projeto).
2. Se for a primeira vez: configure a "Tela de consentimento OAuth" (Externo,
   nome do app, e-mail de suporte). Os escopos padrão (openid, email, profile) bastam.
3. Criar credenciais → ID do cliente OAuth → **Aplicativo da Web**:
   - Origens JavaScript autorizadas: `<URL do app>` (no dev, adicione também `http://localhost`, sem porta).
   - URIs de redirecionamento autorizados: `<URL do app>/api/auth/callback/google`
4. Copie o ID do cliente e a chave secreta e cole aqui.

Para produção, não crie um segundo cliente: adicione a origem e o redirect de
produção no MESMO cliente.

## O que o agente faz com os valores

- Dev: escreve `GOOGLE_CLIENT_ID=...` e `GOOGLE_CLIENT_SECRET=...` no
  `.dev.vars` e reinicia o `npm run dev` (os segredos são lidos ao iniciar).
- Produção: coloca as duas chaves no `.prod.vars` e publica com
  `npm run deploy -- --secrets-file .prod.vars`, ou sobe só elas com
  `npx wrangler secret put GOOGLE_CLIENT_ID` e `... GOOGLE_CLIENT_SECRET` (veja `/deploy`).

## Verificar sem abrir o navegador

```bash
curl -s -X POST http://localhost:3000/api/auth/sign-in/social \
  -H "Content-Type: application/json" -H "Origin: http://localhost:3000" \
  -d '{"provider":"google","callbackURL":"/app"}'
```

Esperado: um JSON com `url` apontando para `accounts.google.com` com o ID do
cliente dentro. Se vier erro, as credenciais não carregaram: confira o
`.dev.vars` e se o servidor foi reiniciado. A volta completa (tela de
consentimento → de volta logado) precisa de um clique do usuário no botão.

## Erros comuns

- `redirect_uri_mismatch`: o redirect no console não bate exatamente com
  `<URL do app>/api/auth/callback/google` (esquema, porta, sem barra final).
- `invalid_client`: chave errada ou ID e chave trocados.
- Funciona no dev e falha em produção: faltou adicionar a origem/redirect de
  produção no cliente, ou `BETTER_AUTH_URL` (se você a fixou como segredo)
  ainda aponta para localhost.
- Botão não aparece: uma das duas variáveis está vazia. O par precisa estar completo.

## GitHub (mesma ideia)

Crie um OAuth App em https://github.com/settings/developers com o callback
`<URL do app>/api/auth/callback/github` e preencha `GITHUB_CLIENT_ID` e
`GITHUB_CLIENT_SECRET`.
