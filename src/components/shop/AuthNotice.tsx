import { useOrgAuth } from '#/lib/auth'

export function AuthNotice() {
  const auth = useOrgAuth()
  if (auth.configured) return null
  return (
    <div className="border border-[#c98b63]/60 bg-[#c98b63]/10 px-4 py-3 text-sm text-[#e7c3a9]">
      Sign-in is not configured yet. Add the
      <span className="font-mono"> VITE_CLERK_PUBLISHABLE_KEY </span>
      value from <span className="font-mono">.env.example</span> to enable
      member sign-in and checkout.
    </div>
  )
}
