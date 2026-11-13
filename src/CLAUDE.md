# Linguagem visual (src/)

Vale para tudo em `src/`: componentes, rotas, estilos. O `CLAUDE.md` da raiz
diz como o app funciona; este diz como ele parece. Quando um pedido de design
chegar, leia este arquivo antes de abrir qualquer componente.

## Direção atual (decidida em 2026-11-08)

**Chão neutro, uma cor de marca, e ela só em preenchimento.** A base é
branco, cinza e tinta, sem matiz nenhum. O laranja `#ff4d00` é a marca e
aparece em exatamente três lugares: o botão principal, o anel de foco e o
estado selecionado. Nunca como cor de letra. A página não tem cor própria;
o contraste faz o trabalho.

O que isso inverteu, e por quê: o tema padrão nasceu bege (`#f5f2ed`) com
rótulos laranja.
Comparado lado a lado com interfaces que lemos como "bonitas" (o painel do
ShipKit foi a referência), a diferença estava toda em duas coisas: o fundo
tinha tom, e o texto tinha cor. Numa página de quatro telas, qualquer tom
deixa de ser detalhe e vira a página; e rótulo colorido é a marca registrada
de interface feita por quem programa. O laranja ficou, porque é a marca.
O bege e o rótulo laranja saíram.

## Este documento descreve UM tema

Tudo abaixo é o visual **autonomia**, o padrão, escrito em `:root` e `.dark`
em `src/styles.css`. Os outros três (`neutro`, `editorial`, `brutal`) estão
no mesmo arquivo e podem quebrar as regras de cor e forma de propósito: o
editorial usa serifa e papel quente, o brutal usa borda preta e sombra sólida.

O que vale para TODOS, sem exceção, é o mecanismo: **tema é token, nunca um
`if` em componente.** Nenhum componente lê `data-theme`. Se um visual precisa
que algo mude de forma, nasce um token para a forma (`--radius-btn`,
`--radius-card`, `--display-font`, `--shadow-btn`) e cada tema dá o valor.
Dois eixos, separados: `data-theme` é o estilo, a classe `dark` é o modo, e
todo tema deve as duas faces.

## As sete regras

1. **Texto nunca tem cor.** Só `text-foreground`, `text-muted-foreground` e
   `text-brand-foreground` (este último só em cima de `bg-brand`). Cor de
   estado (sucesso, alerta, erro) vai em preenchimento ou ícone, com texto
   neutro ao lado. **(teste)** `text-brand` sozinho falha em `src/rules.test.ts`.
2. **O chão é neutro, ponto.** Fundo, cartão, borda e preenchimento secundário
   sem matiz (`#fff`, `#f4f4f4`, `#f7f7f7`, `rgba(0,0,0,.1)`). Superfície
   elevada é MAIS CLARA que a página no escuro e igual ou mais clara no claro.
   Se for tingir, tinja o bastante para ver; "cinza meio bege" é o pior dos
   dois mundos.
3. **Uma marca, em preenchimento.** `bg-brand` + `text-brand-foreground` no
   botão principal (`error-pages.tsx`, `section.tsx`, formulários de login),
   `--ring` no foco, item ativo. Sobre o laranja o texto é **tinta**
   (`--brand-foreground: #171717`, 5,4:1), não branco (3,33:1, reprovado no
   AA). A cor da marca não muda para caber o texto; o texto é que muda. O botão padrão do shadcn (`bg-primary`) é
   tinta, não laranja: a marca é a exceção, não o padrão. Borda colorida só
   onde significa "selecionado"; destaque de cartão é `border-foreground`.
4. **Pílula, borda fina, sombra zero.** `--radius-btn: 100px`, `--border` a 10%
   de preto, `--shadow-btn` e `--shadow-card` em `none`. Profundidade vem de
   borda e de contraste de superfície, não de sombra.
5. **Rótulos pequenos em cinza, em caixa normal.** `.kicker` é 13px, peso 500,
   tracking zero, cor `--muted-foreground`. Nada de CAIXA ALTA COM TRACKING,
   nada de cor de marca, nenhum emoji como ícone. Ícones só do `lucide-react`,
   16 ou 18px, traço 1.5, na cor do texto ao lado.
6. **Peso até 600.** Títulos em `--display-weight: 600` (brutal: 700, de
   propósito). Em componente, `font-medium` ou `font-semibold`; hierarquia
   vem de tamanho e cor. **(teste)** `font-bold`, `font-extrabold` e
   `font-black` falham. Tamanhos na escala do Tailwind, sem `text-[15px]`.
7. **Movimento com propósito.** Hover troca cor ou superfície, nunca sobe
   nem cresce. Transição nomeada (`transition-colors`), nunca
   `transition-all`. Uma única entrada na página, o `rise-in` do hero
   (500ms, `cubic-bezier(0.22, 1, 0.36, 1)`, 8px), em escada de 50ms.
   **(teste)** `hover:-translate-y-*`, `hover:scale-*`, `transition-all` e
   `animate-bounce` falham.

## Peças de tela (2026-11-10)

Tela nova se MONTA, não se desenha. As peças já estão no visual certo:

- **Primitivas** em `components/ui/` (shadcn): `Button`, `Input`, `Select`,
  `Textarea`, `Checkbox`, `Switch`, `Tabs`, `Table`, `Dialog`, `Badge`,
  `Skeleton` e as demais.
- **Kit da área logada** em `components/app/`: `PageSection` (um assunto por
  bloco, sem cartão), `Toolbar` e `TableFrame` (tela de lista), `EmptyState`
  (lista vazia), `Field` (rótulo + controle + ajuda ou erro) e `StatusDot`
  (estado com a cor na bolinha e o texto neutro). `page-header.tsx` tem
  `PageHeader`, `StatStrip` e `StatCard`.
- **A bancada `/estilo`** (`routes/estilo.tsx`) mostra todas, uma de cada, e a
  **tela de lista de referência** (`components/app/exemplo-lista.tsx`) mostra
  como elas se juntam. São os moldes: copie de lá.
- **A skill `/tela`** (`.claude/skills/tela/SKILL.md`) é o passo a passo:
  tipo de tela, peças, dados, estados, texto e conferência.
- **`/app/clientes`** (`routes/_app/app/clientes.tsx`) é a lista de referência
  ligada ao banco. Foi criada por um agente só com a skill e o pedido "cria
  uma tela de clientes"; o que ele errou virou regra na skill.

Cinco decisões que as peças carregam:

- **`<Button variant="brand">` é a ação principal, uma por tela.** A receita
  (`bg-brand` + `text-brand-foreground` + `hover:bg-brand-hover`) mora na
  variante. **(teste)** Escrevê-la à mão num componente falha.
- **Ligado e marcado usam a marca.** `Checkbox` e `Switch` no estado ligado
  são `bg-brand`: é o "estado selecionado" da regra 3. Item ativo de
  navegação continua em tinta.
- **Lista vazia tem um botão só.** Sem itens, a faixa de filtros some e o
  botão da marca é o do `EmptyState`. Dois botões da marca na mesma tela é o
  erro que o primeiro teste da skill produziu.
- **No celular a ação fica à vista.** Colunas secundárias somem
  (`hidden md:table-cell`) e o dado desce para baixo do nome; tabela não rola
  de lado para alcançar o botão de apagar.
- **O tamanho do botão não define o canto.** Os tamanhos `xs`, `sm` e `lg`
  perderam o `rounded-md` que vem do shadcn: o canto é sempre
  `--radius-btn`, senão um botão pequeno deixava de ser pílula.

Peça nova entra pelo `npx shadcn@latest add`, é ajustada às regras (a lista
do que consertar está na skill `/tela`) e ganha um exemplo em `/estilo`.

## O hero (2026-11-08, passe unslop)

A primeira tela é dividida: texto à esquerda, alinhado à esquerda, e o
**painel do app desenhado em código** (`src/components/landing/app-preview.tsx`)
à direita, subindo da borda de baixo e cortado por ela, para convidar a
rolar. É o "momento" da landing: a única coisa rica na tela, e ela mostra o
produto de verdade, não uma ilustração. A grade de pontos atrás do título
saiu. A **assinatura** do template é a etiqueta mono com o caminho do arquivo
(`src/lib/auth.ts`) em cada cartão de recurso: só este produto diz onde cada
coisa mora. Ela aparece ali e em mais lugar nenhum.

Depoimentos de exemplo ("Nome da pessoa") não ficam na landing real: dado
falso visível é slop. O bloco `testimonials` continua no catálogo `/blocos`
para quem tiver depoimento de verdade.

## Exceções nomeadas

- O logo do Google em `components/auth/social-buttons.tsx` usa as cores
  oficiais da marca Google. É a única cor fixa permitida em `.tsx`.
- Gráficos usam `--chart-1..5`; são a única série de cores além da marca.

## Como mudar a direção

Troque os valores em `:root`/`.dark` de `src/styles.css`, atualize este
arquivo com a data e o motivo, e rode `npm run test`: as regras marcadas com
(teste) vão acusar o que ficou fora da linha. Uma direção abandonada fica
registrada aqui em uma linha, para ninguém refazer o caminho:

- 2026-11-10: proposta de tokens de "polimento" no estilo dos geradores de
  app (gradiente, brilho, `--shadow-elegant`, cartão de vidro, hover que
  levanta, animação de entrada em toda seção). Recusada antes de entrar:
  contraria as regras 4 e 7. O que deixa uma tela gerada com cara de pronta
  aqui é montar com as peças acima, não enfeitar.
- 2026-11-05 → 2026-11-08: bege `#f5f2ed` + rótulos laranja + sombra laranja
  no botão (do DESIGN.md). Substituída pela direção acima.
- 2026-11-08 (noite): texto branco sobre o laranja (3,33:1) reprovava no
  WCAG AA; passou a tinta `#171717` (5,4:1), hover `#eb4800` (4,66:1). O azul
  do tema neutro no escuro desceu de L 0.6 para 0.52 pelo mesmo motivo. As
  fontes saíram do `@import` (bloqueava a renderização) para `<link>` com
  `preconnect` no `__root.tsx`, e os pesos 800/900 da Inter, que a regra 6
  proíbe, deixaram de ser baixados.
- 2026-11-08 (manhã → tarde): títulos a 800/900, rótulos em caixa alta com
  tracking, grade de pontos no hero, hero centralizado sem visual, passos
  numerados em laranja, botões que sobem no hover, depoimentos de exemplo
  na landing. Tudo saiu no passe unslop. Crédito do método: unslop, de
  Damir Sokolovsky (@heydamir), CC BY 4.0.
