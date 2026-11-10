---
name: tela
description: Cria ou refaz uma tela do app com as peças e as regras visuais do template, para sair pronta e igual ao resto — página da área logada (lista, formulário, painel, configurações), página pública ou seção da landing. Use quando pedirem "cria uma tela/página de X", "faz um CRUD de X", "adiciona uma lista de X", "monta um formulário de X", "deixa essa tela bonita" ou "refaz o visual de X".
---

# Criar uma tela

O template já tem todas as peças de uma tela prontas e no visual certo. O
trabalho aqui é MONTAR com elas, não desenhar do zero. Tela boa neste
projeto é a que parece ter nascido junto com as outras.

## 0. Antes de escrever

1. Leia `src/CLAUDE.md` (a direção visual e as sete regras). Várias são
   testadas: `npm run test` fica vermelho se uma for quebrada.
2. Leia os dois arquivos que servem de molde:
   - `src/routes/estilo.tsx`: todas as peças, uma de cada, com as classes certas;
   - `src/components/app/exemplo-lista.tsx`: a tela de lista completa (abas,
     busca, tabela, vazio, diálogo de criar), com dados de mentira;
   - `src/routes/_app/app/clientes.tsx` + `src/lib/clientes-fns.ts` +
     `src/lib/clientes.ts`: a MESMA tela ligada ao banco, com apagar. É o
     exemplo completo de tudo que a seção 3 pede.
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

| Preciso de | Peça | Arquivo |
| --- | --- | --- |
| Título da página + ações | `PageHeader` | `src/components/page-header.tsx` |
| Números em destaque | `StatStrip` + `StatCard` | `src/components/page-header.tsx` |
| Um assunto por bloco (ajustes, detalhes) | `PageSection` | `src/components/app/page-section.tsx` |
| Faixa de busca/filtros + ação | `Toolbar` | `src/components/app/data-list.tsx` |
| Tabela | `TableFrame` + `Table` | `data-list.tsx` + `src/components/ui/table.tsx` |
| Lista sem nada | `EmptyState` | `src/components/app/empty-state.tsx` |
| Campo de formulário | `Field` + `Input`/`Select`/`Textarea` | `src/components/app/field.tsx` + `ui/` |
| Liga/desliga, marcar | `Switch`, `Checkbox` | `src/components/ui/` |
| Estado de um item (ativo, pendente...) | `StatusDot` | `src/components/app/status.tsx` |
| Etiqueta | `Badge` | `src/components/ui/badge.tsx` |
| Criar/editar sem sair da tela | `Dialog` | `src/components/ui/dialog.tsx` |
| Filtro por grupo | `Tabs` | `src/components/ui/tabs.tsx` |
| Esperando dados | `Skeleton` | `src/components/ui/skeleton.tsx` |
| Aviso depois de uma ação | `toast.success` / `toast.error` | `sonner` |
| Botões | `Button` | `src/components/ui/button.tsx` |

Botões: **um** `variant="brand"` por tela, na ação principal ("Salvar",
"Novo cliente"). O resto é `outline` (secundário), `ghost` (discreto) ou
`destructive` (apaga). Dentro de um diálogo, o `brand` é o do diálogo.
Lista sem nenhum item: a `Toolbar` inteira some (não há o que filtrar) e o
único `brand` é o do `EmptyState`. Para os dois botões abrirem o mesmo
diálogo, ele fica fora da `Toolbar`, controlado por um estado `aberto`.

Falta uma peça? `npx shadcn@latest add <nome>`, e depois conserte o que o
gerador erra neste projeto:
- troque `import { cn } from "cn"` por `from "#/lib/utils"` e rode `npm uninstall cn`;
- troque `transition-all` por `transition-colors`;
- tire `rounded-md` fixo de botão e use os tokens (`--radius-btn`, `--radius-card`);
- estado ligado/selecionado usa `bg-brand` + `text-brand-foreground`;
- acrescente a peça nova em `src/routes/estilo.tsx`, na seção que fizer sentido.

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
   Confira a sessão dentro dela e filtre SEMPRE pelo `user.id` (modelo:
   `src/lib/clientes-fns.ts`). A rota chama no `loader`.
4. **Gravar e apagar**: `createServerFn({ method: 'POST' })` com
   `.validator(...)`. Valide no servidor, confira a sessão de novo e ponha o
   `userId` no `where` de todo update e delete: é o que impede mexer no dado
   de outra pessoa. Mensagem de erro em pt-BR dizendo o que fazer.
5. **Limite**: escrita de quem está logado NÃO usa `isRateLimited` (aquele
   limite, 5 por minuto por IP, é para endpoint sem login e travaria o sexto
   cadastro seguido). O que protege é a sessão e um teto por pessoa
   (`CLIENTES_MAX`). Endpoint público de escrita, esse sim, usa `isRateLimited`.
6. **Atualizar a tela**: depois de gravar, `await router.invalidate()` e um
   `toast.success('...')`.
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

Na tela, troque o `useState` do exemplo de lista por `Route.useLoaderData()`
e as funções locais pelas server functions. O resto do JSX fica igual.

## 4. Todo estado tem tela

Antes de dizer que terminou, a tela precisa ter resposta para:

- **Vazio**: `EmptyState` com a frase do que vai aparecer ali e o botão que
  cria o primeiro item. Filtro sem resultado é outro vazio: oferece "Limpar filtros".
- **Carregando**: botão desligado com o verbo no gerúndio ("Salvando...");
  conteúdo que demora ganha `Skeleton`.
- **Erro**: frase que diz o que fazer ("Digite um e-mail válido, como..."),
  nunca só "Erro".
- **Sucesso**: `toast.success` curto, no passado ("Cliente adicionado").
- **Apagar**: confirmação num `Dialog` dizendo o que some e se dá para desfazer.
- **Celular**: tabela não pode precisar rolar de lado para alcançar uma ação.
  Colunas secundárias levam `hidden md:table-cell` e o dado que importa desce
  para baixo do nome, num `<span className="block ... md:hidden">`.

## 5. Texto

pt-BR, direto, do jeito que se fala. Botão é verbo ("Salvar", "Adicionar
cliente"), não "OK" nem "Enviar". Título de página é o nome da coisa
("Clientes"), com uma linha de apoio que diz para que serve. Sem ponto de
exclamação, sem emoji, sem CAIXA ALTA.

## 6. O que não entra

Estas saídas são as que denunciam tela gerada. Várias quebram teste.

- cor escrita no componente (`#ff0000`, `rgb(...)`): só classes de token;
- texto colorido (`text-brand`, verde, vermelho): cor de estado vai na
  bolinha do `StatusDot` ou num preenchimento;
- gradiente, brilho, sombra, vidro fosco;
- `font-bold` ou mais pesado; tamanho fora da escala (`text-[15px]`);
- elemento que sobe ou cresce no hover, `transition-all`, animação de entrada
  nova (a única da casa é o `rise-in` do hero);
- cartão dentro de cartão; cartão em volta de uma seção de ajustes (use `PageSection`);
- página logada com `mx-auto max-w-*` no conteúdo: ela ocupa a largura toda,
  alinhada à esquerda;
- dado inventado numa tela de verdade (nomes, números de exemplo): lista sem
  dado mostra o `EmptyState`.

## 7. Confira antes de entregar

```bash
npx tsr generate      # rota nova: atualiza src/routeTree.gen.ts (sem isso o typecheck falha)
npm run check:fix
npm run typecheck
npm run test
npm run e2e           # com o `npm run dev` desligado: ele usa a mesma porta
```

Tela com dados ganha um teste em `e2e/login.spec.ts`, dentro do fluxo que já
está logado (um login por teste estoura o limite de login): criar, ver na
lista, apagar.

Depois abra a tela no navegador (`npm run dev`) e olhe de verdade:

- no celular (375px): nada vaza para o lado, a faixa de filtros empilha;
- no modo escuro (botão da lua) e em pelo menos mais um tema (botão da paleta);
- com a lista vazia, com um item e com um erro de formulário;
- navegando só com o teclado: o foco aparece e a ordem faz sentido.

Entregue dizendo o que criou, o que assumiu no passo 0 e o que não conferiu.
