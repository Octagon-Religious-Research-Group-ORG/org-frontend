import { createFileRoute } from '@tanstack/react-router'
import { MemberPage } from '#/components/members/MemberPage'
import { loadMemberPage } from '#/lib/members-api'

/**
 * A member's page at the site root (owner, Q01). File routes with a fixed name
 * outrank this one, and joining refuses their addresses, so it never shadows a
 * page of the website.
 */
export const Route = createFileRoute('/$slug')({
  loader: ({ params }) => loadMemberPage(params.slug),
  head: ({ loaderData }) => ({
    meta: [
      {
        title: loaderData?.profile
          ? `${loaderData.profile.displayName} - ORG`
          : 'Member page - ORG',
      },
    ],
  }),
  component: MemberRoute,
  notFoundComponent: MissingMemberRoute,
})

function MemberRoute() {
  const { slug } = Route.useParams()
  const { profile } = Route.useLoaderData()
  return <MemberPage slug={slug} initial={profile} />
}

function MissingMemberRoute() {
  const { slug } = Route.useParams()
  return <MemberPage slug={slug} missing />
}
