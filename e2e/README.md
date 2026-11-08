# Testes ponta a ponta

`npm run e2e` (ou `npm run e2e:ui` para o inspetor). O Playwright controla um Chromium
contra o **servidor de desenvolvimento real** (`vite dev` com o plugin da Cloudflare: workerd + D1 local).
Primeira vez: `npx playwright install chromium`.

## Como funciona

- O Playwright sobe DOIS servidores sozinho: o `vite dev` (porta 3000, o app de verdade) e o
  `npm run preview` (porta 4173 ou `E2E_PREVIEW_PORT`: faz o build e serve a saída de produção,
  onde o `public/_headers` vale para os arquivos estáticos; o `vite dev` não aplica esse arquivo).
- O `vite dev` sobe na porta 3000 (`--strictPort`: falha se ela
  estiver ocupada) e **não reaproveita** servidor já aberto (`reuseExistingServer: false`).
  Pare o seu `npm run dev` antes de rodar, ou use outra porta:
  `E2E_PORT=3001 npm run e2e`, com `BETTER_AUTH_URL=http://localhost:3001` no `.dev.vars`
  (senão o login recusa a origem).
- A saída do servidor vai para `e2e/.dev.log`. Sem provedor de e-mail, o servidor imprime
  `[auth] código de login para <email>: <6 dígitos>`; o teste de login lê esse arquivo.
- `e2e/global-setup.ts` roda `npm run db:migrate:local` para garantir as tabelas no D1 local.

## Arquivos

- `marketing.spec.ts`: home em pt-BR, links do header, redirecionamento de `/docs`, 404.
- `helpers.ts`: portas, leitura do código no log e `loginWithCode()` (usado pelos specs de login).
- `login.spec.ts`: o produto logado de ponta a ponta com UM login (o rate limit é 5/min por IP): entra por código e chega em `/app`, navega pela barra lateral, troca a foto (R2), baixa os dados em JSON e encerra a conta.
- `guards.spec.ts`: `/app` anônimo redireciona para `/login?redirect=...`, `/conta` responde 301 para `/app/configuracoes` e, depois do login, volta para a página pedida.
- `security-headers.spec.ts`: cabeçalhos de segurança nas respostas do Worker (dev) e nos estáticos (preview: página pré-renderizada, `public/`, `/assets/`).

## Convenções

- Prefira localizadores por papel, rótulo ou placeholder, com os textos em pt-BR.
- `e2e/.dev.log` e `e2e/.auth` não são versionados.
