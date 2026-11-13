---
name: setup
description: Primeira configuração depois de clonar o template — instala as dependências, cria o .dev.vars com um segredo gerado, aplica as migrações no banco local e sobe o servidor de desenvolvimento. Use logo depois de clonar ou quando o .dev.vars não existir. Use também quando pedirem "como rodo o projeto", "não abre no localhost", ou aparecer erro de BETTER_AUTH_SECRET.
---

# Primeira configuração (do clone ao app rodando)

Objetivo: sair do clone com o app abrindo em http://localhost:3000, com o
mínimo de ações do usuário. O agente roda todos os comandos. Nada aqui
precisa de conta na Cloudflare: tudo roda no seu computador.

## 1. Instalar

```bash
npm install
```

Precisa de Node.js 22 ou mais novo (`node -v`), npm e git. Avisos de `peer dependency` do npm podem ser ignorados; só erro importa.

## 2. Criar o `.dev.vars`

O `.dev.vars` guarda os segredos locais e NÃO vai para o git. Em um clone
novo ele não existe:

```bash
[ -f .dev.vars ] || cp .dev.vars.example .dev.vars
```

Depois gere o segredo das sessões (mínimo de 32 caracteres) e coloque na linha `BETTER_AUTH_SECRET=`:

```bash
openssl rand -base64 32
# Windows, sem openssl:
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Edite o `.dev.vars` direto (nunca `git add -f` nele). As outras chaves podem
ficar vazias: sem `RESEND_API_KEY` o e-mail aparece no terminal, e sem as
chaves do Google/GitHub os botões de login social simplesmente não aparecem.

A URL do app é deduzida da requisição, em qualquer porta; `BETTER_AUTH_URL`
é opcional (só para fixar uma URL). O login com senha é opcional e vem desligado
(`PASSWORD_LOGIN_ENABLED=true` liga).

Os tipos dos bindings já vêm prontos em `worker-configuration.d.ts`; só rode `npm run cf-typegen` se mudar o `wrangler.jsonc` ou o `.dev.vars.example`:

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
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/app     # 307 (manda para /login)
```

## 5. Primeiro login

Abra http://localhost:3000/login, digite um e-mail qualquer e peça o
código. Sem provedor de e-mail configurado, o código de 6 dígitos aparece no
terminal do `npm run dev`, numa linha assim:

```
[auth] código de login para voce@exemplo.com: 123456
```

Digite o código na página e pronto: a conta foi criada e você está no
painel, em `/app` (as configurações da conta ficam em `/app/configuracoes`).

## 6. Próximos passos

- Troque o nome e os textos em `src/config/app.ts` e `src/content/landing.ts`.
- Quer e-mail de verdade? Preencha `RESEND_API_KEY` (e `EMAIL_FROM`) no `.dev.vars` e reinicie o dev.
- Quer login com Google? Use `/google-oauth`.
- Vai publicar? Use `/deploy`.

## Problemas comuns

- **Porta 3000 ocupada**: outro servidor está rodando. Feche-o ou rode `npx vite dev --port 3001` e a URL do app vem da requisição, então nada muda no `.dev.vars` (só se ele tiver `BETTER_AUTH_URL` preenchido: aí ajuste a porta nele).
- **Login quebra com erro de segredo**: o `.dev.vars` não existe ou `BETTER_AUTH_SECRET` está vazio. Refaça o passo 2 e reinicie o dev (os segredos são lidos ao iniciar).
- **Primeira visita dá erro 500** depois de instalar dependência nova: o Vite está reotimizando. Recarregue a página.
- **Dependências**: usam `^` e o `package-lock.json` é versionado; quem clona recebe o lock.
- **`npm run e2e`** precisa da porta 3000 livre (não rode junto com o dev) e de `npx playwright install chromium` na primeira vez.
- **Painel local**: http://localhost:3000/cdn-cgi/local/explorer mostra o D1, o R2, o Durable Object e os logs de cada requisição.
