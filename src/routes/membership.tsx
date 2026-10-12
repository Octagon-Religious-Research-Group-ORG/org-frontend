import { createFileRoute } from '@tanstack/react-router'
import { ReferencePage } from '#/components/ReferencePage'
import { loadPublishedPage } from '#/lib/content-api'

/** Tripp's Membership guide (plan §2d): editable in the website workbench. */
export const Route = createFileRoute('/membership')({
  loader: () => loadPublishedPage('membership'),
  head: ({ loaderData }) => ({
    meta: [
      { title: `${loaderData?.content.title ?? 'Membership'} - ORG` },
      { name: 'description', content: loaderData?.content.subtitle },
    ],
  }),
  component: MembershipRoute,
})

function MembershipRoute() {
  return <ReferencePage page={Route.useLoaderData().content} />
}
