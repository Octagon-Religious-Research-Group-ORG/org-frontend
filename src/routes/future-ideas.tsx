import { createFileRoute } from '@tanstack/react-router'
import { ReferencePage } from '#/components/ReferencePage'
import { PageReactions } from '#/components/members/OrgPageReactions'
import { loadPublishedPage } from '#/lib/content-api'

export const Route = createFileRoute('/future-ideas')({
  loader: () => loadPublishedPage('future'),
  head: ({ loaderData }) => ({
    meta: [
      { title: `${loaderData?.content.title ?? 'Future Ideas'} - ORG` },
      { name: 'description', content: loaderData?.content.subtitle },
    ],
  }),
  component: FutureIdeasRoute,
})

function FutureIdeasRoute() {
  const page = Route.useLoaderData()
  return (
    <ReferencePage page={page.content} after={<PageReactions page={page} />} />
  )
}
