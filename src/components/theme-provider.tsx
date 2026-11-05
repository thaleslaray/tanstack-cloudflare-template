import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react'
import {
  defaultTheme,
  isThemeId,
  THEME_STORAGE_KEY,
  type ThemeId,
  themeIds,
} from '#/config/themes'

/**
 * A metade VISUAL do tema. A outra metade (claro/escuro/sistema) é do
 * `next-themes`, que cuida da classe `dark` no <html>; nada aqui mexe nela.
 * Este provider cuida do `data-theme`, que escolhe um dos blocos de tokens em
 * `src/styles.css`.
 *
 * O atributo é escrito de forma imperativa, e não renderizado, porque o
 * servidor não conhece a escolha do visitante (ela vive no localStorage). O
 * script inline abaixo aplica antes da primeira pintura; o provider só mantém
 * a cópia do React em dia para o seletor mostrar o check.
 */

type ThemeStyleContext = {
  theme: ThemeId
  setTheme: (theme: ThemeId) => void
}

const Context = createContext<ThemeStyleContext>({
  theme: defaultTheme,
  setTheme: () => {},
})

/**
 * Roda ANTES da primeira pintura, inline no <head>. Sem ele a página pintaria
 * no visual padrão por um quadro e depois pularia para o escolhido.
 * É montado a partir do registro, então adicionar um tema não exige editar
 * aqui. Não pode importar nada (é uma string no documento).
 */
export const themeStyleScript = `!function(){try{var v=localStorage.getItem(${JSON.stringify(
  THEME_STORAGE_KEY,
)});document.documentElement.dataset.theme=${JSON.stringify(
  themeIds,
)}.indexOf(v)>-1?v:${JSON.stringify(
  defaultTheme,
)}}catch(e){document.documentElement.dataset.theme=${JSON.stringify(
  defaultTheme,
)}}}()`

export function ThemeStyleProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const [theme, setThemeState] = useState<ThemeId>(defaultTheme)

  // Lê de volta o que o script inline já aplicou, direto do elemento, para os
  // dois nunca discordarem.
  useEffect(() => {
    const applied = document.documentElement.dataset.theme
    if (isThemeId(applied)) setThemeState(applied)
  }, [])

  const setTheme = useCallback((next: ThemeId) => {
    setThemeState(next)
    document.documentElement.dataset.theme = next
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next)
    } catch {
      // Modo privado / storage bloqueado: a escolha vale só para esta página.
    }
  }, [])

  return (
    <Context.Provider value={{ theme, setTheme }}>{children}</Context.Provider>
  )
}

export function useThemeStyle() {
  return useContext(Context)
}
