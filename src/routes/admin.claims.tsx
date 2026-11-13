import { createFileRoute } from '@tanstack/react-router'
import { AdminClaims } from '#/components/admin/claims/AdminClaims'
import { MemberGate } from '#/components/shop/MemberGate'
import { ShopShell } from '#/components/shop/ShopShell'

export const Route = createFileRoute('/admin/claims')({
  head: () => ({
    meta: [
      { title: 'Page claims — ORG' },
      {
        name: 'description',
        content: 'Review requests to claim imported member pages.',
      },
    ],
  }),
  component: AdminClaimsPage,
})

function AdminClaimsPage() {
  return (
    <ShopShell>
      <main className="relative z-[1] mx-auto max-w-[1120px] px-[clamp(16px,4vw,40px)] pb-24 pt-[clamp(132px,16vh,176px)]">
        <MemberGate returnTo="/admin/claims">
          <AdminClaims />
        </MemberGate>
      </main>
    </ShopShell>
  )
}
