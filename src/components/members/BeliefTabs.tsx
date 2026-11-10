import { useState } from 'react'
import { TabPerforations } from '#/components/BlotterPerforations'
import type { BeliefTab, Revisions } from '#/lib/members-api'
import { BeliefOwnerTools } from './BeliefOwnerTools'
import { buttonStyle } from './editor-styles'
import { HistoryPanel } from './HistoryPanel'
import { Paragraphs } from './Paragraphs'

const REVIEW_NOTE = 'Imported, please review'

function groupTabs(tabs: Array<BeliefTab>) {
  const groups = new Map<string, Array<BeliefTab>>()
  for (const tab of tabs) {
    const name = tab.group ?? ''
    groups.set(name, [...(groups.get(name) ?? []), tab])
  }
  return [...groups.entries()]
}

/**
 * One perforated tab per belief (owner, plan §2c), grouped by the member's own
 * categories where a tab has one. Every belief's text is in the page from the
 * start, so a server render or a reader without scripts still has it.
 */
export function BeliefTabs({
  slug,
  tabs,
  owner,
}: {
  slug: string
  tabs: Array<BeliefTab>
  /** Only on the owner's own page: what each edit starts from. */
  owner?: { revisions: Revisions; onChanged: () => void }
}) {
  const [open, setOpen] = useState(tabs.at(0)?.tabId)
  const [history, setHistory] = useState<{
    tabId: string
    field: 'text' | 'title'
  }>()

  if (tabs.length === 0) return null

  return (
    <section aria-label="Beliefs" className="mt-12">
      <h2 className="text-2xl font-light uppercase tracking-[0.06em] text-[#f6efd9]">
        Beliefs
      </h2>
      {groupTabs(tabs).map(([group, groupedTabs]) => (
        <div key={group} className="mt-6">
          {group && (
            <h3 className="font-mono text-[11px] uppercase tracking-[0.24em] text-[#78aea2]">
              {group}
            </h3>
          )}
          <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {groupedTabs.map((tab) => (
              <button
                key={tab.tabId}
                type="button"
                aria-expanded={open === tab.tabId}
                aria-controls={`panel-${tab.tabId}`}
                onClick={() => setOpen(tab.tabId)}
                className="group min-w-0 text-left"
              >
                <div
                  className={`octagon relative aspect-square w-full ${
                    open === tab.tabId ? 'bg-[#78aea2]' : 'bg-[#1a2230]'
                  }`}
                >
                  <TabPerforations tabs={4} />
                </div>
                <div className="mt-2 [overflow-wrap:anywhere] text-sm text-[#ece2c4] group-hover:underline">
                  {tab.title}
                </div>
                {tab.needsReview && (
                  <div className="mt-1 text-[11px] text-[#f1d78a]">
                    {REVIEW_NOTE}
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      ))}
      {tabs.map((tab, index) => (
        <article
          key={tab.tabId}
          id={`panel-${tab.tabId}`}
          hidden={open !== tab.tabId}
          className="mt-8 border-t border-[rgba(236,226,196,0.16)] pt-6"
        >
          <h3 className="text-xl font-light text-[#f6efd9] [overflow-wrap:anywhere]">
            {tab.title}
          </h3>
          {tab.needsReview && (
            <p className="mt-2 text-xs text-[#f1d78a]">{REVIEW_NOTE}</p>
          )}
          <div className="mt-4">
            <Paragraphs paragraphs={tab.paragraphs} />
          </div>
          <div className="flex flex-wrap gap-3">
            {(['text', 'title'] as const).map((field) => (
              <button
                key={field}
                type="button"
                aria-expanded={
                  history?.tabId === tab.tabId && history.field === field
                }
                onClick={() =>
                  setHistory(
                    history?.tabId === tab.tabId && history.field === field
                      ? undefined
                      : { tabId: tab.tabId, field },
                  )
                }
                className={buttonStyle}
              >
                {field === 'text' ? 'History' : 'Title history'}
              </button>
            ))}
          </div>
          {history?.tabId === tab.tabId && (
            <HistoryPanel
              key={`${tab.tabId}-${history.field}`}
              slug={slug}
              tabId={tab.tabId}
              field={history.field}
              label={
                history.field === 'title'
                  ? `the title of “${tab.title}”`
                  : `“${tab.title}”`
              }
              onClose={() => setHistory(undefined)}
            />
          )}
          {owner && (
            <BeliefOwnerTools
              key={tab.tabId}
              tab={tab}
              revision={
                owner.revisions.tabs[tab.tabId] ?? { text: 0, title: 0 }
              }
              isFirst={index === 0}
              isLast={index === tabs.length - 1}
              isOnly={tabs.length === 1}
              onChanged={owner.onChanged}
            />
          )}
        </article>
      ))}
    </section>
  )
}
