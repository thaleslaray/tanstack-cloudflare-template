---
name: setup
description: Primeira configuração depois de clonar o template — instala as dependências, cria o .dev.vars com um segredo gerado, aplica as migrações no banco local e sobe o servidor de desenvolvimento. Use logo depois de clonar ou quando o .dev.vars não existir.
---

# Primeira configuração (do clone ao app rodando)

Objetivo: sair do clone com o app abrindo em http://localhost:3000, com o
mínimo de ações do usuário. O agente roda todos os comandos. Nada aqui
precisa de conta na Cloudflare: tudo roda no seu computador.

## 1. Instalar

```bash
npm install
```

Precisa de Node.js 22 ou mais novo (`node -v`).

## 2. Criar o `.dev.vars`

O `.dev.vars` guarda os segredos locais e NÃO vai para o git. Em um clone
novo ele não existe:

```bash
[ -f .dev.vars ] || cp .dev.vars.example .dev.vars
```

Depois gere o segredo das sessões e coloque na linha `BETTER_AUTH_SECRET=`:

```bash
openssl rand -base64 32
```

Edite o `.dev.vars` direto (nunca `git add -f` nele). As outras chaves podem
ficar vazias: sem `RESEND_API_KEY` o e-mail aparece no terminal, e sem as
chaves do Google/GitHub os botões de login social simplesmente não aparecem.

A URL do app fica no `wrangler.jsonc`, em `"vars"` → `BETTER_AUTH_URL`
(`http://localhost:3000` no dev). Não precisa mexer.

Depois de criar o `.dev.vars`, gere os tipos dos bindings (é rápido):

```bash
npm run cf-typegen
```

## 3. Banco de dados local

```bash
npm run db:migrate:local
```

Cria as tabelas no D1 local, em `.wrangler/state/` (ignorado pelo git).
Pode rodar com o servidor ligado ou desligado.

## 4. Subir e conferir

```bash
npm run dev
```

Confira de verdade, em outro terminal (não confie só no log de início):

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/        # 200
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/login   # 200
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/conta   # 307 (manda para /login)
```

## 5. Primeiro login

Abra http://localhost:3000/login, digite um e-mail qualquer e peça o
código. Sem provedor de e-mail configurado, o código de 6 dígitos aparece no
terminal do `npm run dev`, numa linha assim:

```
[auth] código de login para voce@exemplo.com: 123456
```

Digite o código na página e pronto: a conta foi criada e você está em
`/conta`.

## 6. Próximos passos

- Troque o nome e os textos em `src/config/app.ts` e `src/content/landing.ts`.
- Quer e-mail de verdade? Preencha `RESEND_API_KEY` (e `EMAIL_FROM`) no `.dev.vars` e reinicie o dev.
- Quer login com Google? Use `/google-oauth`.
- Vai publicar? Use `/deploy`.

## Problemas comuns

- **Porta 3000 ocupada**: outro servidor está rodando. Feche-o ou rode `npx vite dev --port 3001` e acrescente `BETTER_AUTH_URL=http://localhost:3001` no `.dev.vars` (o `.dev.vars` vence o `wrangler.jsonc` no dev; sem isso o login recusa a origem). Apague a linha quando voltar para a 3000.
- **Login quebra com erro de segredo**: o `.dev.vars` não existe ou `BETTER_AUTH_SECRET` está vazio. Refaça o passo 2 e reinicie o dev (os segredos são lidos ao iniciar).
- **Primeira visita dá erro 500** depois de instalar dependência nova: o Vite está reotimizando. Recarregue a página.
- **Versões fixadas**: `wrangler` e `@cloudflare/vite-plugin` ficam sem `^` no `package.json`. Não atualize por acidente.
- **Painel local**: http://localhost:3000/cdn-cgi/local/explorer mostra o D1, o R2, o Durable Object e os logs de cada requisição.
