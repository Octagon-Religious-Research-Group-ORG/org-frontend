import type { ReactNode } from 'react'
import { LogIn, UserPlus } from 'lucide-react'
import { useOrgAuth } from '#/lib/auth'
import { AuthNotice } from './AuthNotice'

export function MemberGate({
  returnTo,
  children,
}: {
  returnTo: string
  children: ReactNode
}) {
  const auth = useOrgAuth()
  if (auth.isLoading) {
    return (
      <div className="grid min-h-72 place-items-center font-mono text-[10px] uppercase tracking-[0.2em] text-[#9f9676]">
        Checking membership…
      </div>
    )
  }
  if (!auth.isAuthenticated) {
    return (
      <div className="mx-auto max-w-2xl border border-[#ece2c4]/18 bg-[#0b0d12] p-7 sm:p-10">
        <AuthNotice />
        <div className="font-mono mt-5 text-[10px] uppercase tracking-[0.28em] text-[#9dcf83]">
          Member identity required
        </div>
        <h1 className="font-display mt-2 text-5xl uppercase tracking-[0.03em] text-[#f6efd9]">
          Sign in to continue.
        </h1>
        <p className="mt-4 max-w-lg text-sm leading-7 text-[#b8ad8d]">
          Sign-in and account creation are handled securely by a dedicated
          identity service. ORG never receives or stores your password.
        </p>
        <div className="mt-7 grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            disabled={!auth.configured}
            onClick={() => void auth.login(returnTo)}
            className="flex items-center justify-center gap-2 border border-[#9dcf83] px-4 py-3 font-mono text-[10px] uppercase tracking-[0.2em] text-[#9dcf83] hover:bg-[#9dcf83] hover:text-[#0b0d12] disabled:opacity-35"
          >
            <LogIn size={15} /> Sign in
          </button>
          <button
            type="button"
            disabled={!auth.configured}
            onClick={() => void auth.login(returnTo, true)}
            className="flex items-center justify-center gap-2 bg-[#9dcf83] px-4 py-3 font-mono text-[10px] uppercase tracking-[0.2em] text-[#0b0d12] hover:bg-[#b8e7a0] disabled:opacity-35"
          >
            <UserPlus size={15} /> Create account
          </button>
        </div>
      </div>
    )
  }
  return children
}
