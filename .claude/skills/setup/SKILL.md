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

A URL do app NÃO fica no `.dev.vars`: é o `BETTER_AUTH_URL` em
`cloudflare.config.ts` (`http://localhost:3000` no dev).

## 3. Banco de dados local

```bash
npm run db:migrate:local
```

Cria as tabelas no D1 local, em `.cloudflare/state/` (ignorado pelo git).
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

- **Porta 3000 ocupada**: outro servidor está rodando. Feche-o ou rode `PORT=3001 npm run dev` (e ajuste `BETTER_AUTH_URL` em `cloudflare.config.ts` temporariamente, senão o login recusa a origem).
- **Aviso "Missing required secrets"** no início do `cf dev`: alguma chave do `.dev.vars.example` não está no seu `.dev.vars`. Copie a linha (pode ficar vazia).
- **Primeira visita dá erro 500** depois de instalar dependência nova: o Vite está reotimizando. Recarregue a página.
- **`cf` e o Vite plugin estão em beta**: as versões ficam fixadas no `package.json`. Não atualize por acidente.
