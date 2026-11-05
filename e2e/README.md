# Testes ponta a ponta

`npm run e2e` (ou `npm run e2e:ui` para o inspetor). O Playwright controla um Chromium
contra o **servidor de desenvolvimento real** (`npm run dev` = `cf dev`: workerd + D1 local).
Primeira vez: `npx playwright install chromium`.

## Como funciona

- O Playwright sobe o `cf dev` sozinho na porta 3000 e **não reaproveita** servidor já
  aberto (`reuseExistingServer: false`). Pare o seu `npm run dev` antes de rodar.
- A saída do servidor vai para `e2e/.dev.log`. Sem provedor de e-mail, o `cf dev` imprime
  `[auth] código de login para <email>: <6 dígitos>`; o teste de login lê esse arquivo.
- `e2e/global-setup.ts` roda `npm run db:migrate:local` para garantir as tabelas no D1 local.

## Arquivos

- `marketing.spec.ts`: home em pt-BR, links do header, redirecionamento de `/docs`, 404.
- `login.spec.ts`: login por código de ponta a ponta, até `/conta`.
- `guards.spec.ts`: `/conta` anônimo redireciona para `/login`; cabeçalhos de segurança.

## Convenções

- Prefira localizadores por papel, rótulo ou placeholder, com os textos em pt-BR.
- `e2e/.dev.log` e `e2e/.auth` não são versionados.
