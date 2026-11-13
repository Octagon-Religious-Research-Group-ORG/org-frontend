import { createFileRoute } from '@tanstack/react-router'
import { ReferencePage } from '#/components/ReferencePage'
import { PageReactions } from '#/components/members/OrgPageReactions'
import { loadPublishedPage } from '#/lib/content-api'

export const Route = createFileRoute('/gifts-contributions')({
  loader: () => loadPublishedPage('donations'),
  head: ({ loaderData }) => ({
    meta: [
      { title: `${loaderData?.content.title ?? 'Offerings'} - ORG` },
      { name: 'description', content: loaderData?.content.subtitle },
    ],
  }),
  component: GiftsContributionsRoute,
})

function GiftsContributionsRoute() {
  const page = Route.useLoaderData()
  return (
    <ReferencePage page={page.content} after={<PageReactions page={page} />} />
  )
}
