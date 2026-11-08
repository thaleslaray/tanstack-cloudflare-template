/**
 * Os quatro visuais do template.
 *
 * Um tema aqui NÃO é só uma troca de cor: é um visual inteiro — paleta, raio
 * dos cantos, peso da borda, fonte. Tudo isso é variável CSS, então um tema é
 * um bloco de tokens em `src/styles.css` e nada mais. Nenhum componente lê
 * `data-theme`; se um visual novo precisa que um componente mude de forma,
 * crie um token para a forma (ex.: `--radius-btn`) e deixe o tema definir.
 *
 * Cada tema tem a face clara E a escura. O modo (claro/escuro/sistema) é do
 * `next-themes`, na classe `dark` do <html>; o tema vai em `data-theme`,
 * escrito por `src/components/theme-provider.tsx`. Os dois eixos são
 * independentes: 4 temas x 2 modos = 8 blocos de tokens.
 */
export type ThemeId = 'autonomia' | 'neutro' | 'editorial' | 'brutal'

export type ThemeDef = {
  id: ThemeId
  /** Nome mostrado no seletor. */
  label: string
  /** Uma linha abaixo do nome: para que serve o visual. */
  hint: string
  /**
   * Três cores da amostra no seletor (face clara), na ordem: fundo da página,
   * cor da marca, tinta do texto. São literais de propósito: o seletor mostra
   * um tema que NÃO está aplicado, então não dá para ler os tokens do documento.
   */
  swatch: [string, string, string]
}

export const themes: ThemeDef[] = [
  {
    id: 'autonomia',
    label: 'Autonomia',
    hint: 'Branco, cinza e um laranja. O visual padrão.',
    swatch: ['#ffffff', '#ff4d00', '#171717'],
  },
  {
    id: 'neutro',
    label: 'Neutro',
    hint: 'Preto, branco e um azul. Sóbrio para apps.',
    swatch: ['#ffffff', 'oklch(0.54 0.17 255)', 'oklch(0.18 0 0)'],
  },
  {
    id: 'editorial',
    label: 'Editorial',
    hint: 'Papel, serifa e terracota. Para conteúdo.',
    swatch: [
      'oklch(0.975 0.009 85)',
      'oklch(0.47 0.15 32)',
      'oklch(0.2 0.012 60)',
    ],
  },
  {
    id: 'brutal',
    label: 'Brutal',
    hint: 'Bordas grossas, amarelo e canto reto.',
    swatch: ['#ffffff', 'oklch(0.86 0.17 95)', '#111111'],
  },
]

export const themeIds = themes.map((t) => t.id)

/**
 * O tema de quem nunca mexeu no seletor. Troque esta linha e o app inteiro
 * passa a abrir nesse visual, com ou sem seletor.
 */
export const defaultTheme: ThemeId = 'autonomia'

export function isThemeId(value: unknown): value is ThemeId {
  return typeof value === 'string' && (themeIds as string[]).includes(value)
}

/** Chave no localStorage com a escolha do visitante. Também lida pelo script
 *  inline em `__root.tsx`, que não consegue importar daqui. */
export const THEME_STORAGE_KEY = 'app-theme'
