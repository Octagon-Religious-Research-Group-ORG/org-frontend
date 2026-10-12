import { createFileRoute, useLocation } from '@tanstack/react-router'
import { MembershipJoinForm } from '#/components/members/MembershipJoinForm'
import { MemberGate } from '#/components/shop/MemberGate'
import { ShopShell } from '#/components/shop/ShopShell'

export const Route = createFileRoute('/membership_/join')({
  head: () => ({
    meta: [
      { title: 'Join the Members Community - ORG' },
      {
        name: 'description',
        content:
          'Create your ORG member page: bio, beliefs and who can see it.',
      },
    ],
  }),
  component: JoinRoute,
})

function JoinRoute() {
  // ?nickname=1 comes from "Join anonymously" on the Members Community page.
  const nickname =
    new URLSearchParams(useLocation().searchStr).get('nickname') === '1'
  return (
    <ShopShell>
      <main className="relative z-[1] mx-auto max-w-[860px] px-[clamp(16px,4vw,40px)] pb-24 pt-[clamp(132px,16vh,176px)]">
        <MemberGate
          returnTo={
            nickname ? '/membership/join?nickname=1' : '/membership/join'
          }
        >
          <MembershipJoinForm nickname={nickname} />
        </MemberGate>
      </main>
    </ShopShell>
  )
}
