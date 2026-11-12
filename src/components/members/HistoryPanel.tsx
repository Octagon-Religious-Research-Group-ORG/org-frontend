import { useEffect, useState } from 'react'
import { useOrgAuth } from '#/lib/auth'
import { fetchHistory } from '#/lib/members-api'
import type { HistoryEntry, HistoryPage } from '#/lib/members-api'
import type { CommentAuthor } from '#/lib/comments-api'
import { MemberText } from './MemberText'

const SESSION_UNCONFIRMED =
  "We couldn't confirm that you're signed in. Please try again."

/** Server time, the same for every reader: what the record itself says. */
export function formatSavedAt(iso: string) {
  return `${new Date(iso).toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'UTC',
  })} UTC`
}

function formatDay(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    dateStyle: 'medium',
    timeZone: 'UTC',
  })
}

function suggesterName(author: CommentAuthor) {
  if (author.kind === 'admin') return 'an ORG admin'
  if (author.kind === 'imported') return author.name
  return author.displayName ?? 'a member'
}

/** What a version is, in words; an imported one never claims an older date. */
function entryNote(entry: HistoryEntry) {
  const notes: Array<string> = []
  if (entry.source === 'imported') {
    notes.push(
      `Imported from Apple Pages; originally written before ${formatDay(entry.savedAt)}.`,
    )
  }
  if (entry.source === 'title-before-history') {
    notes.push('The title before its first edit here.')
  }
  if (entry.beforeFirstEdit) {
    notes.push('The text before its first edit here.')
  }
  if (entry.fromSuggestion) {
    notes.push(
      `Accepted from a rewording suggested by ${suggesterName(entry.fromSuggestion.author)}.`,
    )
  }
  return notes.join(' ')
}

const pager =
  'border border-[#78aea2] px-3 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-[#78aea2] disabled:opacity-35'

/**
 * Every saved version of one field, newest first, twenty at a time. The
 * server decides who may read it, exactly as it does for the page.
 */
export function HistoryPanel({
  slug,
  tabId,
  field = 'text',
  label,
  onClose,
}: {
  slug: string
  /** A belief's history; without it, the bio's. */
  tabId?: string
  field?: 'text' | 'title'
  /** What this is the history of, e.g. "Bio" or a belief's title. */
  label: string
  onClose: () => void
}) {
  const auth = useOrgAuth()
  const [page, setPage] = useState(1)
  const [loaded, setLoaded] = useState<HistoryPage>()
  const [problem, setProblem] = useState<string>()

  useEffect(() => {
    if (auth.isLoading) return
    const closed = new AbortController()
    void (async () => {
      try {
        const token = auth.isAuthenticated ? await auth.getToken() : undefined
        if (auth.isAuthenticated && !token) throw new Error(SESSION_UNCONFIRMED)
        const result = await fetchHistory(
          slug,
          tabId === undefined ? { kind: 'bio' } : { kind: 'tab', tabId, field },
          { page, token },
        )
        if (!closed.signal.aborted) {
          setLoaded(result)
          setProblem(undefined)
        }
      } catch (err) {
        if (closed.signal.aborted) return
        setProblem(
          err instanceof Error ? err.message : 'This history is unavailable.',
        )
      }
    })()
    return () => closed.abort()
  }, [auth, slug, tabId, field, page])

  return (
    <section
      aria-label={`History of ${label}`}
      className="mt-6 border border-[rgba(236,226,196,0.16)] bg-[rgba(11,13,18,0.85)] p-4 sm:p-6"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h4 className="text-sm uppercase tracking-[0.14em] text-[#ece2c4] [overflow-wrap:anywhere]">
          History of {label}
        </h4>
        <button type="button" onClick={onClose} className={pager}>
          Close history
        </button>
      </div>
      <p className="mt-2 text-xs leading-5 text-[#9f9676]">
        Every save is kept, with the time ORG&apos;s server recorded it and the
        start of its fingerprint (hash).
      </p>
      {problem ? (
        <p role="alert" className="mt-4 text-sm text-[#f1a07a]">
          {problem}
        </p>
      ) : !loaded ? (
        <p role="status" className="mt-4 text-sm text-[#b8ad8d]">
          Opening the history…
        </p>
      ) : loaded.entries.length === 0 ? (
        <p className="mt-4 text-sm text-[#b8ad8d]">No saved versions yet.</p>
      ) : (
        <ol className="mt-4 flex flex-col gap-5">
          {loaded.entries.map((entry) => (
            <li
              key={`${entry.hash}-${entry.seq}`}
              className="border-t border-[rgba(236,226,196,0.12)] pt-3"
            >
              <div className="flex flex-wrap gap-x-4 font-mono text-[11px] text-[#78aea2]">
                <time dateTime={entry.savedAt}>
                  {formatSavedAt(entry.savedAt)}
                </time>
                {entry.partHashes && entry.partHashes.length > 1 ? (
                  <span title="The start of each paragraph's SHA-256 hash, in order">
                    {entry.partHashes.join(' · ')}
                  </span>
                ) : (
                  <span title="The start of this version's SHA-256 hash">
                    {entry.hash}
                  </span>
                )}
              </div>
              {entryNote(entry) && (
                <p className="mt-1 text-xs text-[#f1d78a]">
                  {entryNote(entry)}
                </p>
              )}
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[#d8ceb0] [overflow-wrap:anywhere]">
                <MemberText text={entry.text} />
              </p>
            </li>
          ))}
        </ol>
      )}
      {loaded && (page > 1 || loaded.hasMore) && (
        <div className="mt-4 flex gap-3">
          <button
            type="button"
            disabled={page === 1}
            onClick={() => setPage((current) => current - 1)}
            className={pager}
          >
            Newer
          </button>
          <button
            type="button"
            disabled={!loaded.hasMore}
            onClick={() => setPage((current) => current + 1)}
            className={pager}
          >
            Older
          </button>
        </div>
      )}
    </section>
  )
}
