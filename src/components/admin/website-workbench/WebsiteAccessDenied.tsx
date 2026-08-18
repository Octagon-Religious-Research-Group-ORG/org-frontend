import { ArrowLeft, LockKeyhole } from 'lucide-react'
import { Link } from '@tanstack/react-router'

export function WebsiteAccessDenied() {
  return (
    <section className="mx-auto max-w-2xl border border-[#c98b63]/50 p-8 text-center">
      <LockKeyhole size={28} className="mx-auto text-[#c98b63]" />
      <h1 className="font-display mt-5 text-5xl uppercase tracking-[0.03em]">
        Website admin required.
      </h1>
      <p className="mt-4 text-sm leading-7 text-[#b8ad8d]">
        Ask an ORG administrator to add your email to the website admin
        allowlist, then sign in again.
      </p>
      <Link
        to="/profile"
        className="mt-6 inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-[#9dcf83] no-underline"
      >
        <ArrowLeft size={13} /> Return to profile
      </Link>
    </section>
  )
}
