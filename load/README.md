# Teste de carga (k6) com metas de p95

Mede o tempo de resposta do app em cinco situações e falha se alguma meta de
p95 estourar. Precisa do [k6](https://k6.io) instalado (`k6 version`).

| Cenário          | O que faz                                               | Meta                                |
| ---------------- | ------------------------------------------------------- | ----------------------------------- |
| `estatico`       | GET `/` e `/blog` (páginas pré-renderizadas)            | p95 < 100 ms                        |
| `ssr_publico`    | GET `/login` (renderizada no Worker)                    | p95 < 300 ms                        |
| `ssr_logado`     | GET `/app` e `/app/clientes` com cookie de sessão       | p95 < 500 ms                        |
| `escrita_logada` | cria um cliente (server function) e o apaga em seguida  | p95 < 600 ms (só o pedido de criar) |
| `rajada_login`   | 8 POSTs seguidos de "pedir código de login" do mesmo IP | do 6º em diante recebe `429`        |

Além disso, `http_req_failed` tem de ficar abaixo de 1%. O `429` da rajada é um
status esperado e não conta como falha (cada pedido declara os status que
espera).

## Perfis

Escolha com `PROFILE`. A taxa é o total de requisições por segundo, repartido
entre os cenários (35% estático, 20% login, 30% área logada, 15% escrita).

- `smoke` (padrão): cerca de 1 req/s por 15 s. Só prova que o script funciona;
  não use os números como meta.
- `escada`: 30 s de aquecimento a 2 req/s, depois 5, 20 e 50 req/s, 2 min em
  cada degrau.

### Orçamento de pedidos

Escada: 2 x 30 + 5 x 120 + 20 x 120 + 50 x 120 = 9.060 pedidos, mais a
limpeza da escrita (um DELETE por cliente criado, uns 15% do total, tag
`escrita_logada_limpeza`) e a rajada (8 pedidos a cada 10 s, uns 360). Conte
**cerca de 10 mil pedidos** por execução. Isso importa em staging: confira que
a cota do plano (Workers: pedidos por dia; D1: leituras e escritas) aguenta
antes de rodar. O smoke gasta umas 30 requisições.

## Rodar local

1. Suba o app e deixe a saída em um arquivo, para o script ler o código de login:

   ```bash
   npm run db:migrate:local
   npx vite dev --port 3000 > /tmp/dev.log 2>&1 &
   ```

2. Gere as sessões de teste (5 contas `load-<n>@exemplo.test`):

   ```bash
   LOG_FILE=/tmp/dev.log npm run load:sessoes
   ```

   O script pede o código de cada conta, lê a linha
   `[auth] código de login para <email>: <código>` do log (como o
   `e2e/helpers.ts`), confirma o código e grava os cookies em
   `load/.sessoes.json` (não versionado). `LOG_FILE` padrão: `e2e/.dev.log`.
   `CONTAS=10` muda o número de contas. Cada conta usa um `cf-connecting-ip`
   diferente, por causa do limite de 5 por minuto por IP e por e-mail no login.

3. Rode:

   ```bash
   npm run load                       # smoke
   PROFILE=escada npm run load        # escada
   BASE_URL=http://localhost:3005 npm run load
   ```

   O resultado completo também vai para `load/resultado-<perfil>.json`
   (`RESULTADO=arquivo.json` muda o nome; está no `.gitignore`).

O `vite dev` não pré-renderiza nem minifica: o p95 do `estatico` em dev fica
bem acima do de produção. Para números mais próximos do real, rode contra
`npm run preview` (ele faz o build, sobe na porta 4173) e use
`BASE_URL=http://localhost:4173`.

O `vite dev` escuta só em `::1`; por isso o script usa DNS `preferIPv6` quando
o alvo é localhost (senão o k6 tentaria `127.0.0.1` e receberia "connection
refused").

## Rodar contra staging

Em staging o código de login não sai em log local, então `load:sessoes` recusa
rodar. Dois caminhos:

- **Com provedor de e-mail** (`RESEND_API_KEY` ou o binding `EMAIL`): entre
  nas contas de teste à mão (ou com o Playwright), copie os cookies de sessão
  e monte o `load/.sessoes.json`.
- **Cookies prontos**: passe-os direto ao k6 em `SESSOES_JSON`, como texto JSON
  ou caminho de arquivo:

  ```bash
  SESSOES_JSON='[{"email":"a@exemplo.test","cookie":"better-auth.session_token=..."}]' \
  BASE_URL=https://staging.exemplo.com PROFILE=escada k6 run load/p95.js
  ```

  Formato: lista de `{ "email": "...", "cookie": "nome=valor; outro=valor" }`.
  Use pelo menos 3 ou 4 sessões (cada VU usa uma delas).

Só rode contra um ambiente seu e de teste, nunca contra produção com usuários
de verdade: o teste cria e apaga clientes e dispara tentativas de login.

## Medir um app publicado (passo final do deploy)

Contra o app de verdade, use a SUA sessão (cookie
`__Secure-better-auth.session_token`, copiado das ferramentas do navegador) e
tire a rajada no login com `SEM_RAJADA=1`, que senão manda e-mails reais:

```bash
SEM_RAJADA=1 PROFILE=escada BASE_URL=https://<seu-app> \
SESSOES_JSON='[{"email":"voce@seudominio.com","cookie":"__Secure-better-auth.session_token=<valor>"}]' \
npm run load
```

Use a escada, não o smoke: o smoke tem poucos pedidos e pega o Worker frio, e
o p95 dele oscila muito. O passo a passo completo está na skill `/deploy`
(seção 7).

## Como a escrita funciona

O navegador chama `createClienteFn` (`src/lib/clientes-fns.ts`) com um POST em
`/_serverFn/<id>`, cabeçalho `x-tsr-serverFn: true` e corpo JSON no formato do
seroval (o serializador do TanStack Start). O `p95.js` monta o mesmo corpo e
descobre o `<id>` no `setup()`:

- em `vite dev`, o id é um base64 legível em `/src/lib/clientes-fns.ts`;
- em build (preview, staging), o id é um hash. O script acha no JS da tela de
  clientes a chamada `await X({data:{nome:...`, segue o `import` de `X` até o
  arquivo que define a função e lê o `.handler(...("<hash>"))`;
- se nada disso funcionar (o build mudou de formato), passe `CRIAR_FN_ID` e
  `APAGAR_FN_ID`. Sem os ids, o cenário avisa e faz `GET /app/clientes` com
  sessão no lugar (a meta de p95 continua valendo, mas deixa de medir escrita).

Cada rodada cria um cliente e logo apaga o mesmo cliente, para ficar longe do
teto `CLIENTES_MAX` (500 por pessoa). Se o teste for interrompido no meio,
sobra no máximo um cliente "Cliente k6 ..." por VU; apague na tela de clientes
da conta de teste.

## A rajada de login e o IP

A rajada manda 8 POSTs com e-mails novos em `/api/auth/email-otp/send-verification-otp`
e confere que do 6º em diante vem `429` (o limite é 5 por minuto por IP). Em
localhost o script envia um `cf-connecting-ip` fixo por rodada, então o IP é
nosso e os 5 primeiros também são conferidos (têm de passar). **Fora de
localhost o cabeçalho não é enviado**: a borda da Cloudflare escreve o IP real
de quem roda o k6, e todas as rodadas saem do mesmo IP. Por isso, na borda só
se confere o `429` do 6º ao 8º pedido, e a primeira rodada pode já pegar o IP
bloqueado por outra. Sem provedor de e-mail em staging, o envio do código falha
(500) e a rajada acusa o check; configure o e-mail antes.

## CPU p99 não vem do k6

O k6 mede o tempo que o cliente espera, não o tempo de CPU gasto pelo Worker.
O p99 de CPU vem do **Workers Observability** (painel da Cloudflare, ou a API
de consulta de logs/métricas), no campo `cpuTime` dos eventos de invocação.
Rode a escada e, no mesmo intervalo de tempo, leia lá o `cpuTime` p99 do
Worker. O plano gratuito limita a CPU por requisição (10 ms), então esse número
é o que mais importa para quem está nele.

## Resultados

### Rodada de 2026-11-11, staging, ANTES das correções

Worker no Rio, D1 primário em ENAM (costa leste dos EUA), perfil `escada`:
9.735 pedidos, 0% de erro.

| Cenário          | p95 medido | Meta     |
| ---------------- | ---------- | -------- |
| `estatico`       | 32 ms      | < 100 ms |
| `ssr_publico`    | 70 ms      | < 300 ms |
| `ssr_logado`     | 1.064 ms   | < 500 ms |
| `escrita_logada` | 915 ms     | < 600 ms |

Causa: várias consultas seguidas ao D1 por página, cada uma atravessando o
continente. Correções aplicadas depois: Smart Placement, cache da sessão em
cookie (60 s) e Sessions API do D1 por pedido (veja "Decisões registradas" no
`AGENTS.md`).

### Rodada DEPOIS das correções (2026-11-11)

Mesmo staging (conta Teste, Worker pedido no Rio, D1 em `ENAM`), mesma escada
(9.734 pedidos, 7 min 40 s, 0% de erro HTTP). Read replication DESLIGADA.
Cache da sessão (60 s) e Sessions API do D1 ligados.

O Smart Placement (`mode: "smart"`) ficou em `cf-placement: local-GIG` depois
de 15 min de aquecimento: todo o tráfego do teste sai do Rio, e o modo
automático só decide com tráfego de vários lugares. Para medir o ganho de rodar
perto do banco, esta rodada usou a dica explícita `placement.region:
"aws:us-east-1"` SÓ no staging (`cf-placement: remote-IAD`). O template segue
com `mode: "smart"`: cada aluno terá o banco numa região diferente.

| Cenário          | p95 antes | p95 depois | Mediana depois | Meta     |
| ---------------- | --------- | ---------- | -------------- | -------- |
| `estatico`       | 32 ms     | 31 ms      | 17 ms          | < 100 ms |
| `ssr_publico`    | 70 ms     | 235 ms     | 161 ms         | < 300 ms |
| `ssr_logado`     | 1.064 ms  | 546 ms     | 294 ms         | < 500 ms |
| `escrita_logada` | 915 ms    | 448 ms     | 268 ms         | < 600 ms |

Leitura:

- Página logada e escrita caíram pela metade: as consultas ao D1 agora são
  locais, só a resposta viaja Rio-EUA uma vez.
- A página pública piorou (70 para 235 ms): com a dica de região, até a página
  que não consulta o banco vai aos EUA. O modo `smart` evita isso em produção,
  porque decide por rota de tráfego real; a dica fixa não.
- `ssr_logado` ainda passa da meta no p95 (546 ms). Próximos passos: ligar a
  Read Replication (réplica perto do usuário) e conferir quantas consultas uma
  página logada faz em sequência.
- A rajada no login falha de propósito no staging: sem provedor de e-mail, o
  envio do código dá erro; o 429 continua aparecendo no 6º pedido.

### Rodada 3: réplica de leitura + menos consultas por página (2026-11-11)

Mesmo staging e mesma escada, com `placement.region: "aws:us-east-1"` (igual à
rodada 2, para comparar igual com igual), Read Replication LIGADA no D1
(`read_replication.mode: auto`) e as páginas logadas fazendo 2 idas em fila ao
banco em vez de 5 (sessão e usuário num JOIN, sessão lida uma vez por pedido).
0% de erro HTTP.

| Cenário          | Antes    | Rodada 2 | Rodada 3 | Mediana 3 | Meta     |
| ---------------- | -------- | -------- | -------- | --------- | -------- |
| `estatico`       | 32 ms    | 31 ms    | 33 ms    | 17 ms     | < 100 ms |
| `ssr_publico`    | 70 ms    | 235 ms   | 229 ms   | 161 ms    | < 300 ms |
| `ssr_logado`     | 1.064 ms | 546 ms   | 385 ms   | 221 ms    | < 500 ms |
| `escrita_logada` | 915 ms   | 448 ms   | 419 ms   | 247 ms    | < 600 ms |

Todas as metas de p95 passam. O `ssr_publico` maior que na primeira rodada é
efeito da região forçada no staging (até a página sem banco vai aos EUA); em
produção o template usa `mode: "smart"`.
