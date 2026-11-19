---
name: tela
description: Cria ou refaz uma tela do app com as peças e as regras visuais do template, para sair pronta e igual ao resto — página da área logada (lista, formulário, painel, configurações), página pública ou seção da landing. Use quando pedirem "cria uma tela/página de X", "faz um CRUD de X", "adiciona uma lista de X", "monta um formulário de X", "deixa essa tela bonita" ou "refaz o visual de X".
---

# Criar uma tela

O template já tem todas as peças de uma tela prontas e no visual certo. O
trabalho aqui é MONTAR com elas, não desenhar do zero. Tela boa neste
projeto é a que parece ter nascido junto com as outras.

## 0. Antes de escrever

1. Leia o `DESIGN.md` da raiz inteiro: é a fonte única da aparência
   (direção, tokens, peças, texto e o que não entra). Várias regras são
   testadas: `npm run test` fica vermelho se uma for quebrada
   (`src/CLAUDE.md` lista quais).
2. Leia os moldes que a seção Components do `DESIGN.md` aponta: o arquivo de
   cada peça que for usar e a tela pronta mais parecida com a que vai criar.
   No template são três: `src/routes/estilo.tsx` (todas as peças),
   `src/components/app/exemplo-lista.tsx` (a lista completa, com dados de
   mentira) e `src/routes/_app/app/clientes.tsx` + `src/lib/clientes-fns.ts` +
   `src/lib/clientes.ts` (a MESMA lista ligada ao banco, com apagar: o exemplo
   completo de tudo que a seção 3 pede). Num produto, eles costumam estar
   apagados: valem as telas que o `DESIGN.md` do produto aponta.
3. Se o pedido estiver vago ("uma tela de clientes"), decida o mínimo que
   resolve e diga o que assumiu: quais campos, o que a lista mostra, qual é a
   ação principal. Não pergunte o que dá para decidir.

## 1. Que tipo de tela é

| O pedido | Onde vai | O que mais muda |
| --- | --- | --- |
| Algo que só quem entrou vê (lista, cadastro, painel, ajustes) | `src/routes/_app/app/<nome>.tsx` | uma linha em `mainNav` (`src/components/app-sidebar.tsx`) |
| Página pública de texto (sobre, preços, contato) | `src/routes/<nome>.tsx` | `PUBLIC_PATTERNS` e `SITEMAP_STATIC_PATHS` em `src/config/public-paths.ts`, `head` com `seo()` |
| Artigo, doc, termos | arquivo `.mdx` em `content/` | nada: a rota já existe |
| Seção da página inicial | um objeto em `src/content/landing.ts` | nada: veja os 13 formatos em `/blocos` |

Página da área logada herda o login do `_app.tsx`: não escreva guard.
Página pública que lê sessão ou banco NÃO entra em `PUBLIC_PATTERNS`.

## 2. Monte com as peças

As peças, o arquivo de cada uma e as regras de uso (um botão da marca por
tela, lista vazia, ajustes) estão na seção Components do `DESIGN.md`. Use só
as de lá; não escreva à mão uma peça que já existe.

Lista sem nenhum item: a `Toolbar` inteira some (não há o que filtrar) e o
único `brand` é o do `EmptyState`. Para os dois botões abrirem o mesmo
diálogo, ele fica fora da `Toolbar`. O molde é `src/routes/_app/app/clientes.tsx`:
o estado do diálogo é UM valor (`Dialogo`, união com `k: 'nenhum' | 'criar' |
'apagar'`) num `useReducer`, e `salvando`/`apagando` e os erros de campo moram
dentro dele. Fechar (Esc, clique fora, Cancelar) é ignorado enquanto salva ou
apaga; se falhar, o diálogo continua aberto com o erro.

Falta uma peça? `npx shadcn@latest add <nome>`, e depois conserte o que o
gerador erra neste projeto:
- troque `import { cn } from "cn"` por `from "#/lib/utils"` e rode `npm uninstall cn`;
- troque `transition-all` por `transition-colors`;
- tire `rounded-md` fixo de botão e use os tokens (`--radius-btn`, `--radius-card`);
- estado ligado/selecionado usa `bg-brand` + `text-brand-foreground`;
- acrescente a peça nova em `src/routes/estilo.tsx`, na seção que fizer sentido,
  e na tabela da seção Components do `DESIGN.md`.

## 3. Dados (tela que lê ou grava)

Siga a ordem; cada passo tem um exemplo no projeto.

1. **Tabela**: em `src/db/schema.ts`. Dado de uma pessoa leva `userId` com
   `references(() => user.id, { onDelete: 'cascade' })` e um índice por
   `userId`; `id` em texto, gerado com `crypto.randomUUID()`. Depois
   `npm run db:generate` e `npm run db:migrate:local`.
2. **Regras sem banco**: limites e a função que valida o formulário ficam em
   `src/lib/<area>.ts`, sem bindings, para a tela e o servidor usarem a mesma
   (modelo: `src/lib/clientes.ts`). O erro de validação diz de qual campo é.
3. **Ler**: `createServerFn({ method: 'GET' })` em `src/lib/<area>-fns.ts`.
   Confira a sessão dentro dela e filtre SEMPRE pelo `user.id`; o miolo (sessão
   + consulta) fica numa função comum em `src/lib/<area>-server.ts`, que a server
   function só chama e que um teste chama direto (modelo: `clientes-fns.ts` e
   `clientes-server.ts`). Meta: no máximo 2 consultas em fila por rota de leitura
   (`Promise.all` ou `db.batch` para o que é independente; sem N+1) e um teste
   que prova, copiado de `src/lib/clientes-fila.test.ts`.
   **O dado da tela vem pelo TanStack Query, com uma `queryOptions` só**
   (`src/lib/<area>-queries.ts`, modelo `clientes-queries.ts`): a chave leva tudo
   o que muda o resultado (a conta, os filtros, a página; nunca o texto da
   função) e há um `staleTime` escolhido (30 s para lista da própria pessoa).
   A rota busca no `loader` com `context.queryClient.ensureQueryData(<area>Query(...))`
   e a tela lê com `useSuspenseQuery(<area>Query(...))`, a MESMA definição:
   assim passar o mouse no link já traz o dado (`defaultPreload: 'intent'`) e o
   clique abre a tela com ele, sem pedir de novo dentro do `staleTime`. Com
   chaves diferentes no `loader` e na tela são dois pedidos. Não use
   `Route.useLoaderData()` para dado de servidor nem `router.invalidate()`.
   Não pré-carregue (não ponha no `loader`) leitura que chama serviço externo
   (tem custo ou efeito colateral) nem o que o papel da pessoa não pode ler; e
   não mude a ordem das checagens: o guard do `_app` e a sessão da server
   function continuam barrando antes do dado.
4. **Gravar e apagar**: `createServerFn({ method: 'POST' })` com
   `.validator(...)`. Valide no servidor, confira a sessão de novo e ponha o
   `userId` no `where` de todo update e delete: é o que impede mexer no dado
   de outra pessoa. Mensagem de erro em pt-BR dizendo o que fazer.
5. **Limite**: escrita de quem está logado NÃO usa `isRateLimited` (aquele
   limite, 5 por minuto por IP, é para endpoint sem login e travaria o sexto
   cadastro seguido). O que protege é a sessão e um teto por pessoa
   (`CLIENTES_MAX`). Endpoint público de escrita, esse sim, usa `isRateLimited`.
6. **Atualizar a tela**: toda escrita descarta o cache do que ela muda, num
   lugar só (`invalidarClientes(queryClient)` em `<area>-queries.ts`, que a tela
   aguarda com `await`), e depois um `toast.success('...')`. Esqueceu? A lista
   fica velha até o `staleTime` passar. Prove com contraprova: tire o descarte e
   veja o teste de criar falhar.
7. **Erros**: cada campo tem o seu estado de erro e a mensagem aparece no
   `Field` daquele campo. Erro que não é de campo (limite atingido, sessão
   vencida, rede) vira `toast.error(...)`, nunca a linha de erro de um campo
   qualquer.
8. **Conta da pessoa**: dado novo de usuário entra no "baixar meus dados" com
   `onAccountExport('<area>', ...)` em `src/lib/account-handlers.ts`. Com a
   chave estrangeira em cascata, apagar a conta já leva as linhas junto; só
   dado fora do D1 (arquivo no R2) precisa de `onBeforeAccountDelete`.
9. **Painel**: área nova ganha um `StatCard` em `src/routes/_app/app/index.tsx`
   (e o mesmo número em `src/components/landing/app-preview.tsx`, que espelha
   o painel na landing).
10. **Auditoria** (opcional): `audit({ action: '<area>.<verbo>', ... })` nas
    escritas que alguém pode querer rastrear.
11. **D1 não tem transação**: duas escritas que precisam andar juntas vão num
    `db.batch([...])`.

A tela precisa de algo da plataforma que o projeto ainda não usa (um binding
novo, fila, outro bucket, um campo do `wrangler.jsonc`)? Pare e siga "Antes
de mexer na plataforma" no `AGENTS.md`: consulte a skill da Cloudflare ou a
doc viva antes de escrever. Tabela, server function e tela no padrão acima
não precisam disso.

Na tela, troque o `useState` do exemplo de lista por `useSuspenseQuery(<area>Query(...))`
e as funções locais pelas server functions. O resto do JSX fica igual.

## 4. Todo estado tem tela

Antes de dizer que terminou:

A tela precisa ter resposta para vazio, filtro sem resultado, carregando,
erro, sucesso e apagar. O texto de cada um está na seção Voice & Content
Strategy do `DESIGN.md` e a peça de cada um, na seção Components
(`EmptyState`, `Skeleton`, `toast`, `Dialog`).

- **Celular**: tabela não pode precisar rolar de lado para alcançar uma ação.
  Colunas secundárias levam `hidden md:table-cell` e o dado que importa desce
  para baixo do nome, num `<span className="block truncate ... md:hidden">`.
  A célula do nome leva `w-full max-w-0 truncate md:w-auto md:max-w-none`:
  fica com a largura que sobra e corta texto longo com reticências. Teste com
  um nome e um e-mail COMPRIDOS, não só com o dado curto que você digitou.

## 5. Texto

Seção Voice & Content Strategy do `DESIGN.md`.

## 6. O que não entra

Seção Do's and Don'ts do `DESIGN.md`: são as saídas que denunciam tela
gerada, e várias quebram teste. Mais três, de código:

- tamanho fora da escala (`text-[15px]`) e animação de entrada nova (a única
  da casa é o `rise-in` do hero);
- cartão em volta de uma seção de ajustes (use `PageSection`);
- página logada com `mx-auto max-w-*` no conteúdo: ela ocupa a largura toda,
  alinhada à esquerda.

## 7. Confira antes de entregar

```bash
# rota nova: deixe o `npm run dev` rodando (o plugin regera o `routeTree.gen.ts`) ou rode `npm run build`
npm run check:fix
npm run typecheck
npm run test
npm run e2e           # com o `npm run dev` desligado: ele usa a mesma porta
```

Tela com dados ganha um teste em `e2e/login.spec.ts`, dentro do fluxo que já
está logado (um login só deixa a rodada curta; o limite de login fica desligado no e2e): criar, ver na
lista, apagar. E, se ela tem link no menu, o teste do pré-carregamento (modelo:
"passar o mouse em Clientes já busca a lista"): o hover dispara o pedido e o
clique logo depois não o repete.

Depois abra a tela no navegador (`npm run dev`) e olhe de verdade:

- no celular (375px): nada vaza para o lado, a faixa de filtros empilha;
- no modo escuro (botão da lua) e em pelo menos mais um tema (botão da paleta);
- com a lista vazia, com um item e com um erro de formulário;
- navegando só com o teclado: o foco aparece e a ordem faz sentido.

Entregue dizendo o que criou, o que assumiu no passo 0 e o que não conferiu.
