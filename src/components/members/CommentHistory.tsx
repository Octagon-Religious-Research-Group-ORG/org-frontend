import { useEffect, useState } from 'react'
import { useOrgAuth } from '#/lib/auth'
import {
  fetchCommentHistory,
  fetchOrgPageCommentHistory,
} from '#/lib/comments-api'
import type { CommentHistoryPage } from '#/lib/comments-api'
import { formatSavedAt } from './HistoryPanel'
import { MemberText } from './MemberText'

const SESSION_UNCONFIRMED =
  "We couldn't confirm that you're signed in. Please try again."

const pager =
  'border border-[#78aea2] px-3 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-[#78aea2] disabled:opacity-35'

/**
 * Every saved version of one comment, newest first, with the server's time
 * and the start of each version's hash. Readable by whoever can read the
 * thread; the server decides.
 */
export function CommentHistory({
  slug,
  orgPageId,
  commentId,
  onClose,
}: (
  | { slug: string; orgPageId?: never }
  /** A comment on one of ORG's own pages (Chunk 10b). */
  | { orgPageId: string; slug?: never }
) & {
  commentId: string
  onClose: () => void
}) {
  const auth = useOrgAuth()
  const [page, setPage] = useState(1)
  const [loaded, setLoaded] = useState<CommentHistoryPage>()
  const [problem, setProblem] = useState<string>()

  useEffect(() => {
    if (auth.isLoading) return
    const closed = new AbortController()
    void (async () => {
      try {
        const token = auth.isAuthenticated ? await auth.getToken() : undefined
        if (auth.isAuthenticated && !token) throw new Error(SESSION_UNCONFIRMED)
        const result = await (orgPageId === undefined
          ? fetchCommentHistory(slug, commentId, { page, token })
          : fetchOrgPageCommentHistory(orgPageId, commentId, { page, token }))
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
  }, [auth, slug, orgPageId, commentId, page])

  return (
    <section
      aria-label="Edit history of this comment"
      className="mt-3 border border-[rgba(236,226,196,0.16)] p-3"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h5 className="text-xs uppercase tracking-[0.14em] text-[#ece2c4]">
          Edit history
        </h5>
        <button type="button" onClick={onClose} className={pager}>
          Close history
        </button>
      </div>
      {problem ? (
        <p role="alert" className="mt-3 text-sm text-[#f1a07a]">
          {problem}
        </p>
      ) : !loaded ? (
        <p role="status" className="mt-3 text-sm text-[#b8ad8d]">
          Opening the history…
        </p>
      ) : (
        <ol className="mt-3 flex flex-col gap-4">
          {loaded.entries.map((entry) => (
            <li
              key={`${entry.seq}-${entry.savedAt}`}
              className="border-t border-[rgba(236,226,196,0.12)] pt-2"
            >
              <div className="flex flex-wrap gap-x-4 font-mono text-[11px] text-[#78aea2]">
                <time dateTime={entry.savedAt}>
                  {formatSavedAt(entry.savedAt)}
                </time>
                {entry.hash && (
                  <span title="The start of this version's SHA-256 hash">
                    {entry.hash}
                  </span>
                )}
              </div>
              <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-[#d8ceb0] [overflow-wrap:anywhere]">
                <MemberText text={entry.text} />
              </p>
            </li>
          ))}
        </ol>
      )}
      {loaded && (page > 1 || loaded.hasMore) && (
        <div className="mt-3 flex gap-3">
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
