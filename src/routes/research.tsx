import { createFileRoute } from '@tanstack/react-router'
import { ReferencePage } from '#/components/ReferencePage'
import { PageReactions } from '#/components/members/OrgPageReactions'
import { loadPublishedPage } from '#/lib/content-api'

export const Route = createFileRoute('/research')({
  loader: () => loadPublishedPage('research'),
  head: ({ loaderData }) => ({
    meta: [
      { title: `${loaderData?.content.title ?? 'Research'} - ORG` },
      { name: 'description', content: loaderData?.content.subtitle },
    ],
  }),
  component: ResearchRoute,
})

function ResearchRoute() {
  const page = Route.useLoaderData()
  return (
    <ReferencePage page={page.content} after={<PageReactions page={page} />} />
  )
}
