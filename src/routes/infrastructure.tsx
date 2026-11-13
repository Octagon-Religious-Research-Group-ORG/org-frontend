import { createFileRoute } from '@tanstack/react-router'
import { ReferencePage } from '#/components/ReferencePage'
import { PageReactions } from '#/components/members/OrgPageReactions'
import { loadPublishedPage } from '#/lib/content-api'

export const Route = createFileRoute('/infrastructure')({
  loader: () => loadPublishedPage('infrastructure'),
  head: ({ loaderData }) => ({
    meta: [
      { title: `${loaderData?.content.title ?? 'Infrastructure'} - ORG` },
      { name: 'description', content: loaderData?.content.subtitle },
    ],
  }),
  component: InfrastructureRoute,
})

function InfrastructureRoute() {
  const page = Route.useLoaderData()
  return (
    <ReferencePage page={page.content} after={<PageReactions page={page} />} />
  )
}
