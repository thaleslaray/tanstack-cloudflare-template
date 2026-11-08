import { createFileRoute } from '@tanstack/react-router'
import { LandingBlocks } from '#/components/landing/render'
import { appConfig } from '#/config/app'
import { landing } from '#/content/landing'
import { seo } from '#/lib/seo'

// A landing não tem texto nem layout aqui: ela renderiza a lista de blocos de
// `src/content/landing.ts`. Edite a página LÁ.
export const Route = createFileRoute('/')({
  head: () => ({
    meta: seo({ title: appConfig.name, description: appConfig.description }),
  }),
  component: Home,
})

function Home() {
  return <LandingBlocks blocks={landing} />
}
