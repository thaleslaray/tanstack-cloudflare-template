---
version: alpha
name: Autonomia
description: Tema padrão do template tanstack-cloudflare. Chão neutro, uma cor de marca usada só como preenchimento, botão em pílula, borda fina e sombra zero.
---

# Autonomia

Este arquivo descreve UM tema, o padrão (`:root` e `.dark` em `src/styles.css`).
Os nomes dos tokens são os mesmos das variáveis CSS: `colors.light.background`
é o `--background` do `:root`, `colors.dark.background` é o do `.dark`, e um
token fora dos grupos vale igual nos dois modos.

## Overview

Um painel de trabalho no registro do painel do ShipKit, a referência: branco,
cinza e tinta, sem matiz nenhum, e um único laranja que marca a ação principal
da tela. Quem usa é uma pessoa que entra para resolver uma tarefa (cadastrar,
conferir, ajustar) e sai. A interface não se apresenta: a tela parece ter
nascido junto com as outras, e o contraste faz o trabalho que em outros
sistemas é da cor.

Tela nova se monta com as peças da seção Components, não se desenha do zero.

## Colors

```yaml
colors:
  brand: "#ff4d00"
  brand-hover: "#eb4800"
  brand-foreground: "#171717"
  ring: "#ff4d00"
  success: "#00b464"
  warning: "#f5a623"
  destructive-foreground: "#ffffff"
  terminal-muted: "#8a8a8a"
  chart-1: "#ff4d00"
  chart-2: "#00b464"
  chart-3: "#f5a623"
  chart-5: "#8a8a8a"
  light:
    background: "#ffffff"
    foreground: "#171717"
    card: "#ffffff"
    card-foreground: "#171717"
    popover: "#ffffff"
    popover-foreground: "#171717"
    primary: "#171717"
    primary-foreground: "#ffffff"
    secondary: "#f4f4f4"
    secondary-foreground: "#171717"
    muted: "#f4f4f4"
    muted-foreground: "#6b6b6b"
    accent: "#f4f4f4"
    accent-foreground: "#171717"
    destructive: "#c62828"
    border: "rgba(0, 0, 0, 0.1)"
    input: "rgba(0, 0, 0, 0.16)"
    surface: "#f7f7f7"
    terminal: "#171717"
    terminal-foreground: "#fafafa"
    chart-4: "#171717"
    sidebar: "#fafafa"
    sidebar-foreground: "#171717"
    sidebar-primary: "#171717"
    sidebar-accent: "#f0f0f0"
    sidebar-border: "rgba(0, 0, 0, 0.08)"
  dark:
    background: "#121212"
    foreground: "#f5f5f5"
    card: "#1a1a1a"
    card-foreground: "#f5f5f5"
    popover: "#1a1a1a"
    popover-foreground: "#f5f5f5"
    primary: "#f5f5f5"
    primary-foreground: "#121212"
    secondary: "#262626"
    secondary-foreground: "#f5f5f5"
    muted: "#262626"
    muted-foreground: "#a3a3a3"
    accent: "#262626"
    accent-foreground: "#f5f5f5"
    destructive: "#ef5350"
    border: "rgba(255, 255, 255, 0.12)"
    input: "rgba(255, 255, 255, 0.18)"
    surface: "#1a1a1a"
    terminal: "#1f1f1f"
    terminal-foreground: "#f5f5f5"
    chart-4: "#f5f5f5"
    sidebar: "#171717"
    sidebar-foreground: "#f5f5f5"
    sidebar-primary: "#f5f5f5"
    sidebar-accent: "#262626"
    sidebar-border: "rgba(255, 255, 255, 0.1)"
```

Chão neutro, uma marca, e ela só em preenchimento.

- **Marca** {colors.brand}: aparece em exatamente três lugares: o botão
  principal, o anel de foco e o estado ligado ou selecionado (`Checkbox`,
  `Switch`). Nunca como cor de letra.
- **Texto sobre a marca** {colors.brand-foreground}: tinta, não branco. Branco
  sobre o laranja dá 3,33:1 e reprova no AA; a tinta dá 5,4:1. A cor da marca
  não muda para caber o texto; o texto é que muda.
- **Primária** {colors.light.primary}: tinta. É o botão padrão. Na navegação,
  o item ativo ganha uma linha de 2px em tinta à esquerda e peso 600, sem
  preenchimento. A marca é a exceção, não o padrão.
- **Chão** {colors.light.background}, {colors.light.secondary},
  {colors.light.surface}: sem matiz. Superfície elevada é mais clara que a
  página no escuro, e igual ou mais clara no claro.
- **Texto**: só duas cores, {colors.light.foreground} e
  {colors.light.muted-foreground}.
- **Estado** {colors.success}, {colors.warning}, {colors.light.destructive}:
  vai na bolinha do `StatusDot` ou num preenchimento, com texto neutro ao lado.
- **Gráficos** `chart-1` a `chart-5`: a única série de cores além da marca.

## Typography

```yaml
typography:
  title-lg:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: 600
    lineHeight: 1.33
    letterSpacing: -0.025em
  title-sm:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: 600
    lineHeight: 1.43
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.43
  label-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: 500
    lineHeight: 1.43
  label-sm:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: 500
    letterSpacing: 0em
  caption:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: 500
    lineHeight: 1.33
  mono:
    fontFamily: JetBrains Mono
    fontWeight: 400
  display-sm:
    fontFamily: Inter
    fontSize: 36px
    fontWeight: 600
    lineHeight: 1.02
    letterSpacing: -0.025em
  display-lg:
    fontFamily: Inter
    fontSize: 60px
    fontWeight: 600
    lineHeight: 1.02
    letterSpacing: -0.025em
```

Uma família só, a Inter, e a JetBrains Mono para código e caminhos de arquivo.

- **Título de página** `title-lg`: o nome da coisa ("Clientes"), com uma linha
  de apoio em `body-md` cinza.
- **Título de bloco** `title-sm`: mesmo tamanho do corpo; o peso faz a diferença.
- **Rótulo pequeno** `label-sm` (a classe `.kicker`): 13px, cinza, em caixa
  normal e sem tracking.
- **Display** `display-sm` e `display-lg`: só nas páginas públicas, 36px no
  celular e 60px no desktop.
- Peso até 600. Hierarquia vem de tamanho e de cor, não de negrito.
- Tamanhos sempre na escala do Tailwind, nunca um valor solto como `text-[15px]`.
- Campo de formulário usa 16px no celular, para o navegador não dar zoom.

## Layout

```yaml
spacing:
  unit: 4px
  control-gap: 8px
  block-gap: 16px
  section: 24px
  page-compact: 16px
  page: 32px
```

Escala de 4px do Tailwind. Controles vizinhos ficam a 8px, a faixa de filtros
fica a 16px da tabela, e o cabeçalho da página e cada bloco de ajustes ficam
a 24px do que vem depois.

- A área logada tem barra lateral fixa no desktop; abaixo de `lg` ela vira
  gaveta, aberta por um botão no topo.
- O conteúdo ocupa a largura toda, alinhado à esquerda, com 16px de margem no
  celular e 32px a partir de `sm`. Nada de coluna centralizada com largura
  máxima.
- Ajustes e detalhes usam um bloco por assunto (`PageSection`): título e
  explicação à esquerda, controles à direita, separados por uma linha no topo.
- No celular, a tabela não rola de lado para alcançar uma ação: colunas
  secundárias somem e o dado que importa desce para baixo do nome.

## Elevation & Depth

```yaml
shadows:
  btn: none
  card: none
```

Sombra zero. A profundidade vem da borda fina ({colors.light.border}, 10% de
preto) e do contraste entre superfícies. Sem gradiente, brilho ou vidro fosco.

## Shapes

```yaml
rounded:
  sm: 8px
  md: 10px
  lg: 12px
  xl: 16px
  btn: 100px
  card: 16px
  full: 9999px
```

Botão é pílula ({rounded.btn}) em todos os tamanhos: o tamanho do botão não
define o canto. Cartões e molduras de tabela usam {rounded.card}; campos usam
{rounded.md}. Ícones só do `lucide-react`, com 16 ou 18px, traço 1.5, na cor
do texto ao lado.

## Motion & Micro-interaction

```yaml
motion:
  surface-enter:
    duration: 500ms
    delay: 0ms
    timingFunction: cubic-bezier(0.22, 1, 0.36, 1)
```

Movimento com propósito. O hover troca cor ou superfície, nunca sobe nem
cresce. Transição sempre nomeada (`transition-colors`). A única entrada
animada é a do hero da página inicial (`rise-in`: sobe 8px, com os filhos em
escada de 50ms); telas da área logada não têm animação de entrada.
`prefers-reduced-motion` desliga tudo.

## Voice & Content Strategy

- **Tom:** pt-BR, direto, do jeito que se fala. Sem ponto de exclamação, sem
  emoji e sem CAIXA ALTA.
- **Botões:** um verbo que diz o resultado ("Salvar", "Adicionar cliente"),
  nunca "OK" nem "Enviar".
- **Título de página:** o nome da coisa, com uma linha de apoio que diz para
  que ela serve.
- **Vazio:** uma frase sobre o que vai aparecer ali e o botão que cria o
  primeiro item. Filtro sem resultado é outro vazio e oferece "Limpar filtros".
- **Carregando:** botão desligado com o verbo no gerúndio ("Salvando...").
- **Erro:** diz o que fazer ("Digite um e-mail válido, como..."), nunca só
  "Erro". Erro de campo aparece no campo; o resto vira aviso.
- **Sucesso:** aviso curto, no passado ("Cliente adicionado").
- **Apagar:** a confirmação diz o que some e se dá para desfazer.
- **Dados:** tela de verdade não mostra dado inventado; lista sem dado mostra
  o estado vazio.

## Components

```yaml
components:
  page:
    backgroundColor: "{colors.light.background}"
    textColor: "{colors.light.foreground}"
    typography: "{typography.body-md}"
  page-dark:
    backgroundColor: "{colors.dark.background}"
    textColor: "{colors.dark.foreground}"
  page-support-text:
    backgroundColor: "{colors.light.background}"
    textColor: "{colors.light.muted-foreground}"
  page-support-text-dark:
    backgroundColor: "{colors.dark.background}"
    textColor: "{colors.dark.muted-foreground}"
  page-title:
    typography: "{typography.title-lg}"
  section-title:
    typography: "{typography.title-sm}"
  kicker:
    typography: "{typography.label-sm}"
  display:
    typography: "{typography.display-lg}"
  display-compact:
    typography: "{typography.display-sm}"
  code:
    typography: "{typography.mono}"
  button-brand:
    backgroundColor: "{colors.brand}"
    textColor: "{colors.brand-foreground}"
    typography: "{typography.label-md}"
    rounded: "{rounded.btn}"
    height: 36px
    padding: 16px
  button-brand-hover:
    backgroundColor: "{colors.brand-hover}"
    textColor: "{colors.brand-foreground}"
  button-default:
    backgroundColor: "{colors.light.primary}"
    textColor: "{colors.light.primary-foreground}"
    rounded: "{rounded.btn}"
  button-default-dark:
    backgroundColor: "{colors.dark.primary}"
    textColor: "{colors.dark.primary-foreground}"
  button-secondary:
    backgroundColor: "{colors.light.secondary}"
    textColor: "{colors.light.secondary-foreground}"
    rounded: "{rounded.btn}"
  button-secondary-dark:
    backgroundColor: "{colors.dark.secondary}"
    textColor: "{colors.dark.secondary-foreground}"
  button-ghost-hover:
    backgroundColor: "{colors.light.accent}"
    textColor: "{colors.light.accent-foreground}"
  button-ghost-hover-dark:
    backgroundColor: "{colors.dark.accent}"
    textColor: "{colors.dark.accent-foreground}"
  button-destructive:
    backgroundColor: "{colors.light.destructive}"
    textColor: "{colors.destructive-foreground}"
    rounded: "{rounded.btn}"
  toggle-on:
    backgroundColor: "{colors.brand}"
    textColor: "{colors.brand-foreground}"
  focus-ring:
    backgroundColor: "{colors.ring}"
    size: 3px
  input:
    typography: "{typography.body-md}"
    rounded: "{rounded.md}"
    height: 36px
    padding: 12px
  input-border:
    backgroundColor: "{colors.light.input}"
    height: 1px
  input-border-dark:
    backgroundColor: "{colors.dark.input}"
    height: 1px
  border:
    backgroundColor: "{colors.light.border}"
    height: 1px
  border-dark:
    backgroundColor: "{colors.dark.border}"
    height: 1px
  card:
    backgroundColor: "{colors.light.card}"
    textColor: "{colors.light.card-foreground}"
    rounded: "{rounded.card}"
  card-dark:
    backgroundColor: "{colors.dark.card}"
    textColor: "{colors.dark.card-foreground}"
  popover:
    backgroundColor: "{colors.light.popover}"
    textColor: "{colors.light.popover-foreground}"
    rounded: "{rounded.md}"
  popover-dark:
    backgroundColor: "{colors.dark.popover}"
    textColor: "{colors.dark.popover-foreground}"
  stat-card-hover:
    backgroundColor: "{colors.light.surface}"
    textColor: "{colors.light.foreground}"
  stat-card-hover-dark:
    backgroundColor: "{colors.dark.surface}"
    textColor: "{colors.dark.foreground}"
  tabs-list:
    backgroundColor: "{colors.light.muted}"
    textColor: "{colors.light.muted-foreground}"
    rounded: "{rounded.lg}"
  tabs-list-dark:
    backgroundColor: "{colors.dark.muted}"
    textColor: "{colors.dark.muted-foreground}"
  badge:
    typography: "{typography.caption}"
    rounded: "{rounded.full}"
  status-dot-success:
    backgroundColor: "{colors.success}"
    size: 8px
    rounded: "{rounded.full}"
  status-dot-warning:
    backgroundColor: "{colors.warning}"
    size: 8px
  status-dot-danger:
    backgroundColor: "{colors.light.destructive}"
    size: 8px
  status-dot-danger-dark:
    backgroundColor: "{colors.dark.destructive}"
    size: 8px
  sidebar:
    backgroundColor: "{colors.light.sidebar}"
    textColor: "{colors.light.sidebar-foreground}"
  sidebar-dark:
    backgroundColor: "{colors.dark.sidebar}"
    textColor: "{colors.dark.sidebar-foreground}"
  sidebar-item-active-marker:
    backgroundColor: "{colors.light.sidebar-primary}"
    width: 2px
  sidebar-item-active-marker-dark:
    backgroundColor: "{colors.dark.sidebar-primary}"
    width: 2px
  sidebar-item-hover:
    backgroundColor: "{colors.light.sidebar-accent}"
    textColor: "{colors.light.sidebar-foreground}"
  sidebar-item-hover-dark:
    backgroundColor: "{colors.dark.sidebar-accent}"
    textColor: "{colors.dark.sidebar-foreground}"
  sidebar-border:
    backgroundColor: "{colors.light.sidebar-border}"
    height: 1px
  sidebar-border-dark:
    backgroundColor: "{colors.dark.sidebar-border}"
    height: 1px
  terminal:
    backgroundColor: "{colors.light.terminal}"
    textColor: "{colors.light.terminal-foreground}"
    typography: "{typography.mono}"
  terminal-dark:
    backgroundColor: "{colors.dark.terminal}"
    textColor: "{colors.dark.terminal-foreground}"
  terminal-comment:
    backgroundColor: "{colors.light.terminal}"
    textColor: "{colors.terminal-muted}"
  terminal-comment-dark:
    backgroundColor: "{colors.dark.terminal}"
    textColor: "{colors.terminal-muted}"
  chart-series-1:
    backgroundColor: "{colors.chart-1}"
  chart-series-2:
    backgroundColor: "{colors.chart-2}"
  chart-series-3:
    backgroundColor: "{colors.chart-3}"
  chart-series-4:
    backgroundColor: "{colors.light.chart-4}"
  chart-series-4-dark:
    backgroundColor: "{colors.dark.chart-4}"
  chart-series-5:
    backgroundColor: "{colors.chart-5}"
```

O formato não tem propriedade de borda: as linhas (`border`, `input-border`,
`sidebar-border`) e o anel de foco estão descritos acima pela cor de
preenchimento.

Cada peça já está no visual certo. Leia o arquivo antes de usar.

| Preciso de | Peça | Arquivo |
| --- | --- | --- |
| Título da página e ações | `PageHeader` | `@src/components/page-header.tsx` |
| Números em destaque | `StatStrip`, `StatCard` | `@src/components/page-header.tsx` |
| Um assunto por bloco (ajustes, detalhes) | `PageSection` | `@src/components/app/page-section.tsx` |
| Faixa de busca, filtros e ação | `Toolbar` | `@src/components/app/data-list.tsx` |
| Tabela | `TableFrame`, `Table` | `@src/components/app/data-list.tsx`, `@src/components/ui/table.tsx` |
| Lista sem nada | `EmptyState` | `@src/components/app/empty-state.tsx` |
| Campo de formulário | `Field` | `@src/components/app/field.tsx` |
| Controles do campo | `Input`, `Select`, `Textarea` | `@src/components/ui/input.tsx`, `@src/components/ui/select.tsx`, `@src/components/ui/textarea.tsx` |
| Liga e desliga, marcar | `Switch`, `Checkbox` | `@src/components/ui/switch.tsx`, `@src/components/ui/checkbox.tsx` |
| Estado de um item | `StatusDot` | `@src/components/app/status.tsx` |
| Etiqueta | `Badge` | `@src/components/ui/badge.tsx` |
| Criar ou editar sem sair da tela | `Dialog` | `@src/components/ui/dialog.tsx` |
| Confirmar antes de apagar | `Dialog` com `Button variant="destructive"` | `@src/components/ui/dialog.tsx`; o molde é `@src/routes/_app/app/clientes.tsx` |
| Busca ou filtro sem resultado | `EmptyState` com "Limpar filtros" | `@src/components/app/empty-state.tsx`; o molde é `@src/components/app/exemplo-lista.tsx` |
| Filtro por grupo | `Tabs` | `@src/components/ui/tabs.tsx` |
| Esperando dados | `Skeleton` | `@src/components/ui/skeleton.tsx` |
| Aviso depois de uma ação | `toast` | `@src/components/ui/sonner.tsx` |
| Botões | `Button` | `@src/components/ui/button.tsx` |
| Navegação da área logada | `AppSidebar` | `@src/components/app-sidebar.tsx` |

Os moldes de tela inteira: `@src/routes/estilo.tsx` mostra todas as peças, uma
de cada; `@src/components/app/exemplo-lista.tsx` mostra uma lista completa com
dados de mentira; `@src/routes/_app/app/clientes.tsx` é a mesma lista ligada
ao banco.

- **Botão:** `variant="brand"` é a ação principal, uma por tela; dentro de um
  diálogo, a do diálogo. O resto é `outline`, `ghost` ou `destructive`.
- **Lista vazia:** a faixa de filtros some e o único botão da marca é o do
  `EmptyState`.
- **Ajustes:** `PageSection`, sem cartão em volta.
- **Peça nova:** entra pelo `npx shadcn@latest add`, é ajustada a estas regras
  e ganha um exemplo em `/estilo`.

## Do's and Don'ts

- **Do** montar a tela com as peças acima; ela deve parecer irmã das outras.
- **Do** usar um único botão da marca por tela.
- **Do** escrever cor só por classe de token (`bg-brand`, `text-muted-foreground`).
- **Do** dar resposta a todo estado: vazio, carregando, erro, sucesso e apagar.
- **Don't** colorir texto. Só `text-foreground`, `text-muted-foreground` e,
  sobre a marca, `text-brand-foreground`.
- **Don't** usar gradiente, brilho, sombra ou vidro fosco.
- **Don't** usar `font-bold` ou mais pesado.
- **Don't** fazer elemento subir ou crescer no hover, nem usar `transition-all`.
- **Don't** pôr cartão dentro de cartão.
- **Don't** escrever rótulo em caixa alta com tracking, nem usar emoji como ícone.
- **Don't** ler `data-theme` num componente: tema é token. Se um visual
  precisa mudar a forma de algo, nasce um token para a forma.

Duas exceções nomeadas: o logo do Google em
`@src/components/auth/social-buttons.tsx` usa as cores oficiais da marca
Google, e é a única cor fixa permitida num componente; e os gráficos usam a
série `chart-1` a `chart-5`.
