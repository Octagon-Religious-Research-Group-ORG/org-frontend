import { createFileRoute } from '@tanstack/react-router'
import { ConnectionsSettings } from '#/components/members/ConnectionsSettings'
import { MemberGate } from '#/components/shop/MemberGate'
import { ShopShell } from '#/components/shop/ShopShell'

export const Route = createFileRoute('/settings/connections')({
  head: () => ({
    meta: [
      { title: 'Connections — ORG' },
      {
        name: 'description',
        content:
          'Your connection requests, your connections, and who may send you requests.',
      },
    ],
  }),
  component: ConnectionsPage,
})

/** Signed-out visitors get the sign-in prompt and no connections call. */
function ConnectionsPage() {
  return (
    <ShopShell>
      <main className="relative z-[1] mx-auto max-w-[880px] px-[clamp(16px,4vw,40px)] pb-24 pt-[clamp(132px,16vh,176px)]">
        <MemberGate returnTo="/settings/connections">
          <h1 className="font-display text-5xl uppercase tracking-[0.03em] text-[#f6efd9]">
            Connections
          </h1>
          <ConnectionsSettings />
        </MemberGate>
      </main>
    </ShopShell>
  )
}
