import { createFileRoute, Navigate } from '@tanstack/react-router'
import { LogIn, UserPlus } from 'lucide-react'
import { useOrgAuth } from '#/lib/auth'
import { ShopShell } from '#/components/shop/ShopShell'
import { AuthNotice } from '#/components/shop/AuthNotice'

export const Route = createFileRoute('/join')({
  head: () => ({
    meta: [
      { title: 'Join the ORG — Membership' },
      {
        name: 'description',
        content:
          'Create an ORG member identity or sign in securely.',
      },
    ],
  }),
  component: JoinPage,
})

function JoinPage() {
  const auth = useOrgAuth()

  if (auth.isAuthenticated) {
    return <Navigate to="/profile" replace />
  }

  return (
    <ShopShell>
      <main className="relative z-[1] mx-auto max-w-[980px] px-[clamp(16px,4vw,40px)] pb-24 pt-[clamp(132px,16vh,176px)]">
        <AuthNotice />
        <div className="mt-5 grid overflow-hidden border border-[#ece2c4]/18 lg:grid-cols-[1.05fr_0.95fr]">
          <section className="relative min-h-[520px] overflow-hidden bg-[#9dcf83] p-8 text-[#0b0d12] sm:p-12">
            <div
              aria-hidden
              className="absolute -right-36 -top-36 h-[430px] w-[430px] rounded-full border border-[#0b0d12]/25"
            />
            <div
              aria-hidden
              className="absolute -right-20 -top-20 h-[310px] w-[310px] rotate-45 border border-[#0b0d12]/20"
            />
            <div className="relative flex h-full flex-col justify-between">
              <div className="font-mono text-[10px] uppercase tracking-[0.3em]">
                Living covenant · Secure sign-in
              </div>
              <div>
                <h1 className="font-display max-w-lg text-[clamp(62px,9vw,104px)] uppercase leading-[0.78] tracking-[-0.01em]">
                  One identity. Your member record.
                </h1>
                <p className="mt-6 max-w-md text-sm leading-7">
                  A dedicated identity service handles the account and password.
                  ORG stores only the profile, contact, shipping, cart, and order
                  information needed for membership and requested offerings.
                </p>
              </div>
            </div>
          </section>

          <section className="flex min-h-[520px] flex-col justify-center bg-[#0b0d12] p-8 sm:p-12">
            {auth.isLoading ? (
              <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#9f9676]">
                Checking membership…
              </div>
            ) : (
              <>
                <div className="font-mono text-[9px] uppercase tracking-[0.24em] text-[#9dcf83]">
                  Member access
                </div>
                <h2 className="font-display mt-2 text-5xl uppercase tracking-[0.03em] text-[#f6efd9]">
                  Enter the member area.
                </h2>
                <p className="mt-4 text-sm leading-7 text-[#b8ad8d]">
                  New members create an account first, then add their ORG profile
                  details. Existing members return through the same secure login.
                </p>
                <div className="mt-7 grid gap-3">
                  <button
                    type="button"
                    disabled={!auth.configured}
                    onClick={() => void auth.login('/profile', true)}
                    className="flex items-center justify-center gap-2 bg-[#9dcf83] px-4 py-3 font-mono text-[10px] uppercase tracking-[0.18em] text-[#0b0d12] disabled:opacity-35"
                  >
                    <UserPlus size={15} /> Create member account
                  </button>
                  <button
                    type="button"
                    disabled={!auth.configured}
                    onClick={() => void auth.login('/profile')}
                    className="flex items-center justify-center gap-2 border border-[#9dcf83] px-4 py-3 font-mono text-[10px] uppercase tracking-[0.18em] text-[#9dcf83] disabled:opacity-35"
                  >
                    <LogIn size={15} /> Sign in
                  </button>
                </div>
              </>
            )}
            <div className="mt-8 border-t border-dashed border-[#ece2c4]/18 pt-5 text-[10px] leading-5 text-[#7f775f]">
              Passwords and authentication credentials stay with the identity
              service. ORG never receives them.
            </div>
          </section>
        </div>
      </main>
    </ShopShell>
  )
}
