import { createFileRoute } from '@tanstack/react-router'
import { AdminDashboard } from '#/components/admin/dashboard/AdminDashboard'
import { MemberGate } from '#/components/shop/MemberGate'
import { ShopShell } from '#/components/shop/ShopShell'

export const Route = createFileRoute('/admin/')({
  head: () => ({
    meta: [
      { title: 'Admin dashboard — ORG' },
      {
        name: 'description',
        content: 'Members, roles, claims, settings and the moderation log.',
      },
    ],
  }),
  component: AdminDashboardPage,
})

/** Signed-out visitors get the sign-in prompt and no admin call at all. */
function AdminDashboardPage() {
  return (
    <ShopShell>
      <main className="relative z-[1] mx-auto max-w-[1120px] px-[clamp(16px,4vw,40px)] pb-24 pt-[clamp(132px,16vh,176px)]">
        <MemberGate returnTo="/admin">
          <AdminDashboard />
        </MemberGate>
      </main>
    </ShopShell>
  )
}
