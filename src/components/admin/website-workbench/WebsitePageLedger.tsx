import { ArrowLeft } from 'lucide-react'
import { Link } from '@tanstack/react-router'
import type { WebsitePageId, WebsitePageSummary } from '#/lib/content-types'
import { WEBSITE_PAGE_LEDGER } from './website-pages'

export function WebsitePageLedger({
  selectedPageId,
  summaries,
  onSelect,
}: {
  selectedPageId: WebsitePageId
  summaries: WebsitePageSummary[]
  onSelect: (pageId: WebsitePageId) => void
}) {
  return (
    <aside>
      <div className="sticky top-28">
        <div className="mb-3 flex items-center justify-between">
          <span className="font-mono text-[9px] uppercase tracking-[0.22em] text-[#9f9676]">
            Page ledger
          </span>
          <span className="font-mono text-[8px] text-[#6f684f]">
            {String(WEBSITE_PAGE_LEDGER.length).padStart(3, '0')}
          </span>
        </div>
        <div className="border border-[#ece2c4]/16">
          {WEBSITE_PAGE_LEDGER.map((entry, index) => {
            const summary = summaries.find((item) => item.pageId === entry.id)
            const selected = entry.id === selectedPageId
            return (
              <button
                key={entry.id}
                type="button"
                onClick={() => onSelect(entry.id)}
                className={`grid w-full grid-cols-[28px_1fr_auto] items-center gap-2 border-b border-[#ece2c4]/10 px-3 py-3 text-left last:border-b-0 ${
                  selected
                    ? 'bg-[#d4a24a]/10 text-[#f3ead0]'
                    : 'text-[#9f9676] hover:bg-[#ece2c4]/[0.025] hover:text-[#ece2c4]'
                }`}
              >
                <span className="font-mono text-[8px]">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <span className="truncate text-xs">{entry.label}</span>
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    summary?.draftRevision ? 'bg-[#d4a24a]' : 'bg-[#9dcf83]/65'
                  }`}
                  title={summary?.draftRevision ? 'Draft active' : 'Live'}
                />
              </button>
            )
          })}
        </div>
        <Link
          to="/profile"
          className="mt-4 inline-flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.18em] text-[#9f9676] no-underline hover:text-[#ece2c4]"
        >
          <ArrowLeft size={12} /> Profile
        </Link>
      </div>
    </aside>
  )
}
