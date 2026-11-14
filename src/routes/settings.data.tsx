import { createFileRoute } from '@tanstack/react-router'
import { YourData } from '#/components/members/YourData'
import { MemberGate } from '#/components/shop/MemberGate'
import { ShopShell } from '#/components/shop/ShopShell'

export const Route = createFileRoute('/settings/data')({
  head: () => ({
    meta: [
      { title: 'Your data — ORG' },
      {
        name: 'description',
        content: 'Download your ORG data, or delete your member page.',
      },
    ],
  }),
  component: YourDataPage,
})

/** Signed-out visitors get the sign-in prompt and no data call at all. */
function YourDataPage() {
  return (
    <ShopShell>
      <main className="relative z-[1] mx-auto max-w-[880px] px-[clamp(16px,4vw,40px)] pb-24 pt-[clamp(132px,16vh,176px)]">
        <MemberGate returnTo="/settings/data">
          <h1 className="font-display text-5xl uppercase tracking-[0.03em] text-[#f6efd9]">
            Your data
          </h1>
          <YourData />
        </MemberGate>
      </main>
    </ShopShell>
  )
}
