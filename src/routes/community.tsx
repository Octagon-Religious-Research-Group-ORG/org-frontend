import { createFileRoute } from '@tanstack/react-router'
import { ReferencePage } from '#/components/ReferencePage'
import { CommunityPanels } from '#/components/members/CommunityPanels'
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
 * The Members Community (owner, D09): the community page's content opens
 * after the visitor logs in, signs up, or enters as a guest.
 */
function CommunityRoute() {
  const content = Route.useLoaderData().content
  return (
    <ReferencePage
      page={{ ...content, title: 'Members Community' }}
      // Not an access control: this content goes to everyone and the gate only
      // hides it. The directory inside asks the server, which decides.
      wrapContent={(body) => (
        <MembersEntry>
          {body}
          <CommunityPanels />
        </MembersEntry>
      )}
    />
  )
}
