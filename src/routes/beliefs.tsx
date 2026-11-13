import { createFileRoute } from '@tanstack/react-router'
import { ReferencePage } from '#/components/ReferencePage'
import { AgreedBeliefs } from '#/components/members/AgreedBeliefs'
import { PageReactions } from '#/components/members/OrgPageReactions'
import { loadPublishedPage } from '#/lib/content-api'

export const Route = createFileRoute('/beliefs')({
  loader: () => loadPublishedPage('beliefs'),
  head: ({ loaderData }) => ({
    meta: [
      { title: `${loaderData?.content.title ?? 'Beliefs'} - ORG` },
      { name: 'description', content: loaderData?.content.subtitle },
    ],
  }),
  component: BeliefsRoute,
})

function BeliefsRoute() {
  // The CMS text stays as it is; the reactions to it (Chunk 10b), then
  // the members' agreed beliefs, follow it.
  const page = Route.useLoaderData()
  return (
    <ReferencePage
      page={page.content}
      wrapContent={(body) => (
        <>
          {body}
          <PageReactions page={page} />
          <AgreedBeliefs />
        </>
      )}
    />
  )
}
