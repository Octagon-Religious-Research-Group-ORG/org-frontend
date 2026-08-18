import { createFileRoute, Link } from '@tanstack/react-router'
import { ArrowLeft, LogOut } from 'lucide-react'
import { ShopShell } from '#/components/shop/ShopShell'
import { useOrgAuth } from '#/lib/auth'

export const Route = createFileRoute('/logout')({
  head: () => ({
    meta: [
      { title: 'Signed out — ORG' },
      {
        name: 'description',
        content: 'ORG member sign-out confirmation.',
      },
    ],
  }),
  component: LogoutPage,
})

function LogoutPage() {
  const auth = useOrgAuth()

  return (
    <ShopShell>
      <main className="relative z-[1] mx-auto grid min-h-screen max-w-[760px] place-items-center px-[clamp(16px,4vw,40px)] py-32">
        <section className="w-full border border-[#ece2c4]/18 bg-[#0b0d12] p-7 sm:p-10">
          <div className="font-mono text-[10px] uppercase tracking-[0.28em] text-[#9dcf83]">
            Member session
          </div>
          <h1 className="font-display mt-2 text-5xl uppercase tracking-[0.03em] text-[#f6efd9]">
            {auth.isLoading
              ? 'Confirming sign out.'
              : auth.isAuthenticated
                ? 'Ready to sign out.'
                : 'You are signed out.'}
          </h1>
          <p className="mt-4 max-w-lg text-sm leading-7 text-[#b8ad8d]">
            {auth.isAuthenticated
              ? 'End your session on this browser.'
              : 'Your ORG member session has ended safely.'}
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            {auth.isAuthenticated ? (
              <button
                type="button"
                onClick={() => void auth.logout()}
                className="inline-flex items-center gap-2 border border-[#c98b63] px-4 py-3 font-mono text-[10px] uppercase tracking-[0.2em] text-[#c98b63] hover:bg-[#c98b63] hover:text-[#0b0d12]"
              >
                <LogOut size={14} /> Sign out
              </button>
            ) : null}
            <Link
              to="/"
              className="inline-flex items-center gap-2 border border-[#9dcf83] px-4 py-3 font-mono text-[10px] uppercase tracking-[0.2em] text-[#9dcf83] no-underline hover:bg-[#9dcf83] hover:text-[#0b0d12]"
            >
              <ArrowLeft size={14} /> Return home
            </Link>
          </div>
        </section>
      </main>
    </ShopShell>
  )
}
