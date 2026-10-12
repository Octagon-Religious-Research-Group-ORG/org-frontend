import { createFileRoute } from '@tanstack/react-router'
import { ReferencePage } from '#/components/ReferencePage'
import { MembersEntry } from '#/components/members/MembersEntry'
import { loadPublishedPage } from '#/lib/content-api'

export const Route = createFileRoute('/community')({
  loader: () => loadPublishedPage('community'),
  head: ({ loaderData }) => ({
    meta: [
      { title: 'Members Community - ORG' },
      { name: 'description', content: loaderData?.content.subtitle },
    ],
  }),
  component: CommunityRoute,
})

/**
 * The Members Community (Tripp, D09): the community page's content opens
 * after the visitor logs in, signs up, or enters as a guest.
 */
function CommunityRoute() {
  const content = Route.useLoaderData().content
  return (
    <ReferencePage
      page={{ ...content, title: 'Members Community' }}
      wrapContent={(body) => <MembersEntry>{body}</MembersEntry>}
    />
  )
}
