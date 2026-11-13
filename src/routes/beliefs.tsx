import { createFileRoute } from '@tanstack/react-router'
import { ReferencePage } from '#/components/ReferencePage'
import { AgreedBeliefs } from '#/components/members/AgreedBeliefs'
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
  // The CMS text stays as it is; the members' agreed beliefs follow it.
  return (
    <ReferencePage
      page={Route.useLoaderData().content}
      wrapContent={(body) => (
        <>
          {body}
          <AgreedBeliefs />
        </>
      )}
    />
  )
}
