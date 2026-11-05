import { createFileRoute, notFound } from '@tanstack/react-router'
import { LegalPage } from '#/components/legal-page'
import { appConfig } from '#/config/app'
import { legal } from '#/lib/content/collections'

export const Route = createFileRoute('/termos')({
  loader: async () => {
    const entry = legal.find((e) => e.slug === 'termos')
    if (!entry) throw notFound()
    await entry.load()
    return { title: entry.title }
  },
  head: ({ loaderData }) => ({
    meta: loaderData
      ? [{ title: `${loaderData.title} — ${appConfig.name}` }]
      : [],
  }),
  component: Page,
})

function Page() {
  const entry = legal.find((e) => e.slug === 'termos')
  if (!entry) return null
  return <LegalPage entry={entry} />
}
