# Planos de melhoria

Planos escritos pela skill `/improve` em 2026-11-13. Base de todos: o commit
`bb7333e` mais as mudanças da leva de auditoria que ainda não foram commitadas
quando os planos foram escritos. Cada plano é autocontido: quem executa não
precisa ter visto a conversa que gerou os planos.

## Ordem recomendada e status

| # | Plano | Depende de | Status |
| --- | --- | --- | --- |
| 001 | [Testar os jobs que lembram e apagam contas encerradas, com SQLite de verdade](001-testes-jobs-expurgo-com-sqlite-real.md) | nenhum | TODO |
| 002 | [Testar o isolamento por usuário em clientes e os guards de encerrar conta](002-testes-isolamento-clientes-e-encerramento.md) | 001 (reaproveita o `src/test/sqlite-d1.ts`) | TODO |
| 003 | [E2E dos caminhos de recusa do avatar, do cache privado logado e do botão Sair](003-e2e-avatar-negativos-cache-privado-e-sair.md) | nenhum (mas veja "arquivos em comum") | TODO |
| 005 | [CI que acusa arquivo gerado desatualizado, e migração antes do código no Workers Builds](005-ci-arquivos-gerados-e-ordem-do-deploy.md) | nenhum | TODO |
| 004 | [Primeiro uso sem tropeço para quem não usa o Claude Code](004-dx-primeiro-uso-sem-claude.md) | nenhum (mas veja "arquivos em comum") | TODO |

Status possíveis: `TODO`, `IN PROGRESS`, `DONE`, `BLOCKED` (com o motivo),
`REJECTED` (com o motivo), `STALE` (o código mudou e o plano precisa ser
revisto com `/improve review-plan <arquivo>`).

Por que esta ordem: primeiro as redes de proteção (testes do que apaga dados
de gente de verdade e do isolamento entre contas), depois o CI que pega arquivo
gerado esquecido, por último a mudança de experiência do primeiro uso, que mexe
em mais arquivos de documentação.

## Arquivos em comum: execute um plano por vez

Os planos foram escritos em paralelo contra a mesma árvore, e vários mexem nos
mesmos arquivos:

| Arquivo | Planos |
| --- | --- |
| `AGENTS.md` | 001, 002, 003, 004, 005 |
| `e2e/helpers.ts`, `e2e/login.spec.ts`, `e2e/README.md` | 002, 003 |
| `.github/workflows/ci.yml`, `package.json`, `README.md` | 004, 005 |
| `README.md` | 003, 004, 005 |

A conferência de drift de cada plano (trechos citados e, em alguns, `shasum`)
vai acusar diferença nesses arquivos depois que o plano anterior for
executado. Isso é esperado. Antes de executar o plano seguinte, rode
`/improve review-plan plans/<arquivo>` para atualizar os trechos, ou, se for
executar à mão, confira que a diferença vem só do plano anterior.

Commitar a leva de auditoria antes de executar não atrapalha: o conteúdo dos
arquivos não muda, só o `git diff bb7333e` passa a mostrar esses arquivos
como alterados.

## Avaliado e deixado de fora (não planejar de novo sem fato novo)

- **XState ou biblioteca de máquina de estados.** As máquinas do app (login por
  código, login com senha, diálogos de clientes, fases da conta) ficaram
  explícitas com união discriminada e `useReducer`, sem dependência nova.
- **`@cloudflare/vitest-pool-workers` agora.** Fica como o próximo passo
  registrado no `AGENTS.md`. O plano 001 usa `node:sqlite` para testar o SQL de
  verdade sem dependência nova.
- **`better-sqlite3` ou `@libsql/client` para os testes.** Dependência nova,
  e a do `better-sqlite3` é nativa. Descartadas no plano 001.
- **i18n (Paraglide).** Decisão registrada no `AGENTS.md`: só pt-BR.
- **CSP.** Fica sem, de propósito, por causa dos scripts inline do TanStack
  (registrado no `AGENTS.md`).

## Fica com quem mantém o template, não com um executor

Decisões de produto e de configuração levantadas na auditoria (permissões do
`.claude/settings.json`, o bloco do TanStack Intent no `AGENTS.md`, manter
`load/`, demos e o DO `Counter`, temas, `/estilo` e `/blocos` só em dev,
licença, entre outras). Não viraram plano porque dependem de uma escolha, não
de execução.
