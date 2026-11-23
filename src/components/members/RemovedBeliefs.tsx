import { useState } from 'react'
import { useOrgAuth } from '#/lib/auth'
import { restoreBeliefTab } from '#/lib/members-api'
import type { RemovedTab } from '#/lib/members-api'
import { buttonStyle } from './editor-styles'
import { formatSavedAt, HistoryPanel } from './HistoryPanel'

/**
 * Beliefs taken off the page. Only the owner and the admins receive this
 * list, and only they can open these histories; ORG keeps them (D22). The
 * owner can bring one back (plan §2e); its history then shows both dates.
 */
export function RemovedBeliefs({
  slug,
  tabs,
  owner,
}: {
  slug: string
  tabs: Array<RemovedTab>
  /** Present when the reader is the page's owner. */
  owner?: { onChanged: () => void }
}) {
  const auth = useOrgAuth()
  const [open, setOpen] = useState<string>()
  const [busy, setBusy] = useState<string>()
  const [problem, setProblem] = useState<{ tabId: string; text: string }>()

  const bringBack = async (tabId: string) => {
    setBusy(tabId)
    setProblem(undefined)
    try {
      const token = await auth.getToken()
      if (!token) throw new Error('Please sign in again.')
      await restoreBeliefTab(token, tabId)
      owner?.onChanged()
    } catch (err) {
      setProblem({
        tabId,
        text: err instanceof Error ? err.message : 'Something went wrong.',
      })
    } finally {
      setBusy(undefined)
    }
  }

  return (
    <section aria-label="Removed beliefs" className="mt-12 max-w-3xl">
      <h2 className="text-lg font-light uppercase tracking-[0.06em] text-[#f6efd9]">
        Removed beliefs
      </h2>
      <p className="mt-2 text-xs leading-5 text-[#9f9676]">
        No longer on the page. ORG keeps their text and history; only you and
        the admins see this list.
        {owner && ' You can bring one back at any time.'}
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
            {owner && (
              <button
                type="button"
                aria-label={`Bring back “${tab.title}”`}
                disabled={busy !== undefined}
                onClick={() => void bringBack(tab.tabId)}
                className={`${buttonStyle} ml-3`}
              >
                Bring back
              </button>
            )}
            {problem?.tabId === tab.tabId && (
              <p role="alert" className="mt-2 text-sm text-[#f1a07a]">
                {problem.text}
              </p>
            )}
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
