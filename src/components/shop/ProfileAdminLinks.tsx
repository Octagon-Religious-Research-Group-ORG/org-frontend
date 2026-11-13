import { Link } from '@tanstack/react-router'
import { FilePenLine, LayoutDashboard } from 'lucide-react'
import type { WebsiteCapabilities } from '#/lib/content-types'

export function ProfileAdminLinks({
  capabilities,
}: {
  capabilities: WebsiteCapabilities | null
}) {
  return (
    <>
      {capabilities?.canEditWebsite ? (
        <Link
          to="/admin"
          className="flex items-center justify-center gap-2 border border-[#9dcf83] px-4 py-3 text-center font-mono text-[9px] uppercase tracking-[0.18em] text-[#9dcf83] no-underline hover:bg-[#9dcf83] hover:text-[#0b0d12]"
        >
          <LayoutDashboard size={13} /> Admin dashboard
        </Link>
      ) : null}

      {capabilities?.canEditWebsite ? (
        <Link
          to="/admin/website"
          className="flex items-center justify-center gap-2 border border-[#d4a24a] bg-[#d4a24a]/8 px-4 py-3 text-center font-mono text-[9px] uppercase tracking-[0.18em] text-[#d4a24a] no-underline hover:bg-[#d4a24a] hover:text-[#0b0d12]"
        >
          <FilePenLine size={13} /> Edit Website
        </Link>
      ) : null}

      {capabilities?.canManageOrders ? (
        <Link
          to="/admin/orders"
          className="block border border-[#ece2c4]/18 px-4 py-3 text-center font-mono text-[9px] uppercase tracking-[0.18em] text-[#9f9676] no-underline hover:border-[#9dcf83] hover:text-[#9dcf83]"
        >
          Admin order queue
        </Link>
      ) : null}
    </>
  )
}
