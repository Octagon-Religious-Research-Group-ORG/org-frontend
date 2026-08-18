import { createFileRoute, Link } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import { ShopShell } from '#/components/shop/ShopShell'
import { useOrgAuth } from '#/lib/auth'

export const Route = createFileRoute('/callback')({
  head: () => ({
    meta: [
      { title: 'Completing sign in — ORG' },
      {
        name: 'description',
        content: 'Complete secure ORG member sign-in.',
      },
    ],
  }),
  component: CallbackPage,
})

function CallbackPage() {
  const auth = useOrgAuth()

  return (
    <ShopShell>
      <main className="relative z-[1] mx-auto grid min-h-screen max-w-[760px] place-items-center px-[clamp(16px,4vw,40px)] py-32">
        <section className="w-full border border-[#ece2c4]/18 bg-[#0b0d12] p-7 sm:p-10">
          <div className="font-mono text-[10px] uppercase tracking-[0.28em] text-[#9dcf83]">
            Secure member access
          </div>
          <h1 className="font-display mt-2 text-5xl uppercase tracking-[0.03em] text-[#f6efd9]">
            {auth.isLoading ? 'Completing sign in.' : 'Sign-in incomplete.'}
          </h1>
          <p className="mt-4 max-w-lg text-sm leading-7 text-[#b8ad8d]">
            {auth.isLoading
              ? 'Confirming your identity. You will continue automatically.'
              : 'No completed sign-in was found. Return to the member entrance and try again.'}
          </p>
          {!auth.isLoading ? (
            <Link
              to="/join"
              className="mt-7 inline-flex items-center gap-2 border border-[#9dcf83] px-4 py-3 font-mono text-[10px] uppercase tracking-[0.2em] text-[#9dcf83] no-underline hover:bg-[#9dcf83] hover:text-[#0b0d12]"
            >
              <ArrowLeft size={14} /> Return to member entrance
            </Link>
          ) : null}
        </section>
      </main>
    </ShopShell>
  )
}
