import { createFileRoute } from '@tanstack/react-router'
import { NotificationSettings } from '#/components/members/NotificationSettings'
import { MemberGate } from '#/components/shop/MemberGate'
import { ShopShell } from '#/components/shop/ShopShell'

export const Route = createFileRoute('/settings/notifications')({
  head: () => ({
    meta: [
      { title: 'Email settings — ORG' },
      {
        name: 'description',
        content: 'Choose which ORG emails you get, and how often.',
      },
    ],
  }),
  component: NotificationSettingsPage,
})

/** Signed-out visitors get the sign-in prompt and no settings call at all. */
function NotificationSettingsPage() {
  return (
    <ShopShell>
      <main className="relative z-[1] mx-auto max-w-[880px] px-[clamp(16px,4vw,40px)] pb-24 pt-[clamp(132px,16vh,176px)]">
        <MemberGate returnTo="/settings/notifications">
          <h1 className="font-display text-5xl uppercase tracking-[0.03em] text-[#f6efd9]">
            Email settings
          </h1>
          <NotificationSettings />
        </MemberGate>
      </main>
    </ShopShell>
  )
}
