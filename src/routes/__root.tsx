import {
  HeadContent,
  Scripts,
  createRootRouteWithContext,
} from '@tanstack/react-router'
import type { QueryClient } from '@tanstack/react-query'
import { ThemeProvider } from 'next-themes'
import { Suspense, lazy, useEffect, useState } from 'react'

import Footer from '#/components/Footer'
import Header from '#/components/Header'
import {
  ThemeStyleProvider,
  themeStyleScript,
} from '#/components/theme-provider'
import { ErrorPage, NotFoundPage } from '#/components/error-pages'
import { appConfig } from '#/config/app'

import appCss from '../styles.css?url'

interface MyRouterContext {
  queryClient: QueryClient
}

// Devtools só em desenvolvimento: o import dinâmico fica atrás de uma
// constante de build, então a produção descarta o chunk inteiro.
const Devtools = import.meta.env.DEV
  ? lazy(() => import('#/components/devtools'))
  : () => null

// O sonner pesa uns 30 KB e só aparece quando o visitante faz algo. Entra
// depois da hidratação, fora do caminho crítico.
const Toaster = lazy(() =>
  import('#/components/ui/sonner').then((mod) => ({ default: mod.Toaster })),
)

function LazyToaster() {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  return mounted ? (
    <Suspense fallback={null}>
      <Toaster />
    </Suspense>
  ) : null
}

export const Route = createRootRouteWithContext<MyRouterContext>()({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: appConfig.name },
      { name: 'description', content: appConfig.description },
      { property: 'og:site_name', content: appConfig.name },
      { property: 'og:type', content: 'website' },
      { property: 'og:locale', content: 'pt_BR' },
    ],
    links: [{ rel: 'stylesheet', href: appCss }],
  }),
  shellComponent: RootDocument,
  notFoundComponent: NotFoundPage,
  errorComponent: ({ error }) => <ErrorPage error={error} />,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <HeadContent />
        {/* Aplica o VISUAL (data-theme) antes da primeira pintura. O
            next-themes faz o mesmo truque para claro/escuro de dentro do
            próprio bundle; o eixo do visual é nosso, então o script também.
            Precisa ficar no <head> e bloqueante. */}
        <script dangerouslySetInnerHTML={{ __html: themeStyleScript }} />
      </head>
      <body className="min-h-screen font-sans antialiased">
        {/* Claro é o padrão, seja qual for o sistema do visitante; o toggle
            grava uma escolha explícita que vence a partir daí. Este é o eixo
            do MODO; o VISUAL (qual tema) é o ThemeStyleProvider dentro. */}
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          <ThemeStyleProvider>
            <div className="flex min-h-screen flex-col">
              <Header />
              <main className="flex-1 pt-16">{children}</main>
              <Footer />
            </div>
          </ThemeStyleProvider>
          <LazyToaster />
          <Suspense fallback={null}>
            <Devtools />
          </Suspense>
        </ThemeProvider>
        <Scripts />
      </body>
    </html>
  )
}
