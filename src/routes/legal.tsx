import { createFileRoute } from '@tanstack/react-router'
import { ReferencePage } from '#/components/ReferencePage'
import { PageReactions } from '#/components/members/OrgPageReactions'
import { loadPublishedPage } from '#/lib/content-api'

export const Route = createFileRoute('/legal')({
  loader: () => loadPublishedPage('legal'),
  head: ({ loaderData }) => ({
    meta: [
      { title: `${loaderData?.content.title ?? 'Legal'} - ORG` },
      { name: 'description', content: loaderData?.content.subtitle },
    ],
  }),
  component: LegalRoute,
})

function LegalRoute() {
  const page = Route.useLoaderData()
  return (
    <ReferencePage page={page.content} after={<PageReactions page={page} />} />
  )
}
