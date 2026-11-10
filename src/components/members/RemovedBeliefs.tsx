import { useState } from 'react'
import type { RemovedTab } from '#/lib/members-api'
import { buttonStyle } from './editor-styles'
import { formatSavedAt, HistoryPanel } from './HistoryPanel'

/**
 * Beliefs taken off the page. Only the owner and the admins receive this
 * list, and only they can open these histories; ORG keeps them (D22).
 */
export function RemovedBeliefs({
  slug,
  tabs,
}: {
  slug: string
  tabs: Array<RemovedTab>
}) {
  const [open, setOpen] = useState<string>()

  return (
    <section aria-label="Removed beliefs" className="mt-12 max-w-3xl">
      <h2 className="text-lg font-light uppercase tracking-[0.06em] text-[#f6efd9]">
        Removed beliefs
      </h2>
      <p className="mt-2 text-xs leading-5 text-[#9f9676]">
        No longer on the page. ORG keeps their text and history; only you and
        the admins see this list.
      </p>
      <ul className="mt-4 flex flex-col gap-4">
        {tabs.map((tab) => (
          <li key={tab.tabId}>
            <div className="flex flex-wrap items-baseline gap-x-4">
              <span className="text-sm text-[#ece2c4] [overflow-wrap:anywhere]">
                {tab.title}
              </span>
              <span className="font-mono text-[11px] text-[#9f9676]">
                removed {formatSavedAt(tab.removedAt)}
              </span>
            </div>
            <button
              type="button"
              aria-expanded={open === tab.tabId}
              onClick={() =>
                setOpen(open === tab.tabId ? undefined : tab.tabId)
              }
              className={buttonStyle}
            >
              History
            </button>
            {open === tab.tabId && (
              <HistoryPanel
                slug={slug}
                tabId={tab.tabId}
                label={`“${tab.title}”`}
                onClose={() => setOpen(undefined)}
              />
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}
