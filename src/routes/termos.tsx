import { createFileRoute, notFound } from '@tanstack/react-router'
import { LegalPage } from '#/components/legal-page'
import { legal } from '#/lib/content/collections'
import { seo } from '#/lib/seo'

export const Route = createFileRoute('/termos')({
  loader: async () => {
    const entry = legal.find((e) => e.slug === 'termos')
    if (!entry) throw notFound()
    await entry.load()
    return { title: entry.title }
  },
  head: ({ loaderData }) => ({
    meta: loaderData ? seo({ title: loaderData.title }) : [],
  }),
  component: Page,
})

function Page() {
  const entry = legal.find((e) => e.slug === 'termos')
  if (!entry) return null
  return <LegalPage entry={entry} />
}
