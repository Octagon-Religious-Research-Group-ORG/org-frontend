import { useEffect, useState } from 'react'
import { TabPerforations } from '#/components/BlotterPerforations'
import { editorText } from '#/lib/members-api'
import type { BeliefTab, Revisions } from '#/lib/members-api'
import { BeliefOwnerTools } from './BeliefOwnerTools'
import { CommentThread } from './CommentThread'
import { buttonStyle } from './editor-styles'
import { HistoryPanel } from './HistoryPanel'
import { Paragraphs } from './Paragraphs'
import { VoteButtons } from './VoteButtons'
import type { CommentAccess } from './VoteButtons'
import type { TabVotes, VoteValue } from '#/lib/votes-api'

/** `#belief-<tabId>`: the Beliefs page links straight to one belief. */
export const BELIEF_ANCHOR = 'belief-'

const REVIEW_NOTE = 'Imported, please review'

/**
 * Where a belief sits among the beliefs of its own category: moving swaps it
 * with a neighbour in that category, as the server does.
 */
function placeInGroup(tabs: Array<BeliefTab>, index: number) {
  const group = tabs[index].group ?? ''
  const same = tabs.filter((tab) => (tab.group ?? '') === group)
  const at = same.indexOf(tabs[index])
  if (same.length === 1) return 'only'
  if (at === 0) return 'first'
  return at === same.length - 1 ? 'last' : 'middle'
}

/** "1 comment", "3 comments"; nothing for none or an older server. */
export function commentCountLabel(count: number | undefined) {
  if (!count) return undefined
  return count === 1 ? '1 comment' : `${count.toLocaleString('en-US')} comments`
}

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
  onChanged,
}: {
  slug: string
  tabs: Array<BeliefTab>
  /** Only on the owner's own page: what each edit starts from. */
  owner?: { revisions: Revisions; onChanged: () => void }
  /** Reload the page, e.g. after a suggestion was accepted. */
  onChanged: () => void
}) {
  const [chosen, setOpen] = useState(tabs.at(0)?.tabId)
  // A removed or reloaded-away belief falls back to the first one, so a
  // panel is always open.
  const open = tabs.some((tab) => tab.tabId === chosen)
    ? chosen
    : tabs.at(0)?.tabId
  const [history, setHistory] = useState<{
    tabId: string
    field: 'text' | 'title'
  }>()
  // Votes after this reader's own writes, until the page is read again.
  const [voted, setVoted] = useState<Record<string, TabVotes>>({})
  const [access, setAccess] = useState<Record<string, CommentAccess>>({})
  const [compose, setCompose] = useState<{
    tabId: string
    stance?: VoteValue
    nonce: number
  }>()

  // A page read again is the truth again.
  useEffect(() => {
    setVoted((shown) => (Object.keys(shown).length === 0 ? shown : {}))
  }, [tabs])

  // Opened from a link to one belief (only in the browser: the hash never
  // reaches the server). The panel is scrolled to once it is shown: a
  // hidden panel has no place to scroll to (fix round 1, LOW 1).
  const [scrollTo, setScrollTo] = useState<string>()
  useEffect(() => {
    const wanted = window.location.hash.slice(1)
    if (!wanted.startsWith(BELIEF_ANCHOR)) return
    const tabId = wanted.slice(BELIEF_ANCHOR.length)
    if (tabs.some((tab) => tab.tabId === tabId)) {
      setOpen(tabId)
      setScrollTo(tabId)
    }
  }, [])
  useEffect(() => {
    if (scrollTo === undefined || open !== scrollTo) return
    document.getElementById(`panel-${scrollTo}`)?.scrollIntoView()
    setScrollTo(undefined)
  }, [open, scrollTo])

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
                {commentCountLabel(tab.commentCount) && (
                  <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.14em] text-[#9f9676]">
                    {commentCountLabel(tab.commentCount)}
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
          {tab.votes && (
            <VoteButtons
              slug={slug}
              tabId={tab.tabId}
              title={tab.title}
              textSeq={tab.textSeq ?? 0}
              votes={voted[tab.tabId] ?? tab.votes}
              comment={access[tab.tabId]}
              onVotes={(answer) => {
                setVoted((all) => ({ ...all, [tab.tabId]: answer.votes }))
                // An open "…and comment" form follows the vote as it is now
                // (fix round 1, LOW 5): no badge once there is no vote.
                setCompose((last) =>
                  last?.tabId === tab.tabId && last.stance
                    ? {
                        tabId: last.tabId,
                        nonce: last.nonce,
                        ...(answer.votes.myVote
                          ? { stance: answer.votes.myVote }
                          : {}),
                      }
                    : last,
                )
                // Reworded meanwhile: read the page again for the new text.
                if (answer.textSeq !== (tab.textSeq ?? 0)) onChanged()
              }}
              onCompose={(stance) => {
                setOpen(tab.tabId)
                setCompose((last) => ({
                  tabId: tab.tabId,
                  ...(stance ? { stance } : {}),
                  nonce: (last?.nonce ?? 0) + 1,
                }))
              }}
            />
          )}
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
              key={`owner-${tab.tabId}`}
              tab={tab}
              revision={
                owner.revisions.tabs[tab.tabId] ?? { text: 0, title: 0 }
              }
              isFirst={['first', 'only'].includes(placeInGroup(tabs, index))}
              isLast={['last', 'only'].includes(placeInGroup(tabs, index))}
              isOnly={tabs.length === 1}
              onChanged={owner.onChanged}
            />
          )}
          {/* Only the open belief loads its thread. */}
          {open === tab.tabId && (
            <CommentThread
              key={`thread-${tab.tabId}`}
              slug={slug}
              title="Comments"
              tabId={tab.tabId}
              belief={{
                text: editorText(tab.paragraphs),
                textSeq: tab.textSeq ?? 0,
              }}
              onPageChanged={onChanged}
              {...(compose?.tabId === tab.tabId ? { compose } : {})}
              onAccess={(next) =>
                setAccess((all) => ({ ...all, [tab.tabId]: next }))
              }
            />
          )}
        </article>
      ))}
    </section>
  )
}
