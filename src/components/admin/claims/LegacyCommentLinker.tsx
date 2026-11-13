import { useEffect, useState } from 'react'
import { useOrgAuth } from '#/lib/auth'
import {
  claimDay,
  fetchLegacyComments,
  linkLegacyComments,
} from '#/lib/claims-api'
import type { LegacyCommentList } from '#/lib/claims-api'
import { buttonStyle, primaryStyle } from '#/components/members/editor-styles'

export const NAME_IS_A_HINT =
  'A matching name is only a hint: an Apple Pages name proves nothing. Read each comment and link only the ones you know this member wrote. The comment keeps its text, its Pages name and its date.'

/**
 * Linking imported comments to the member whose claim was approved (plan Q5,
 * Chunk 11). A separate step from the approval: the admin ticks each
 * comment, and can take a link back.
 */
export function LegacyCommentLinker({ claimId }: { claimId: string }) {
  const auth = useOrgAuth()
  const [list, setList] = useState<LegacyCommentList>()
  const [picked, setPicked] = useState<ReadonlySet<string>>(new Set())
  const [attempt, setAttempt] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()
  const [note, setNote] = useState<string>()

  useEffect(() => {
    const closed = new AbortController()
    void (async () => {
      try {
        const token = await auth.getToken()
        if (!token) throw new Error('Your sign-in session has expired.')
        const result = await fetchLegacyComments(token, claimId)
        if (!closed.signal.aborted) {
          setList(result)
          setError(undefined)
        }
      } catch (err) {
        if (!closed.signal.aborted) {
          setError(
            err instanceof Error ? err.message : 'The comments did not load.',
          )
        }
      }
    })()
    return () => closed.abort()
  }, [auth, claimId, attempt])

  /** Links the ticked unlinked comments, or unlinks the ticked linked ones. */
  async function apply(shown: LegacyCommentList, unlink: boolean) {
    setBusy(true)
    setError(undefined)
    setNote(undefined)
    try {
      const token = await auth.getToken()
      if (!token) throw new Error('Your sign-in session has expired.')
      const ids = shown.comments
        .filter(
          (comment) =>
            comment.linked === unlink && picked.has(comment.commentId),
        )
        .map((comment) => comment.commentId)
      const result = await linkLegacyComments(token, claimId, ids, unlink)
      const done = (unlink ? result.unlinked : result.linked) ?? []
      setNote(
        `${unlink ? 'Unlinked' : 'Linked'} ${done.length} of ${ids.length}.` +
          (result.skipped.length
            ? ` ${result.skipped.length} could not be changed (already linked, removed, or changed meanwhile).`
            : ''),
      )
      setPicked(new Set())
      setAttempt((count) => count + 1)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That did not work.')
    } finally {
      setBusy(false)
    }
  }

  const toggle = (commentId: string) =>
    setPicked((current) => {
      const next = new Set(current)
      if (next.has(commentId)) next.delete(commentId)
      else next.add(commentId)
      return next
    })

  const pickedLinked = list?.comments.some(
    (comment) => comment.linked && picked.has(comment.commentId),
  )
  const pickedUnlinked = list?.comments.some(
    (comment) => !comment.linked && picked.has(comment.commentId),
  )

  return (
    <section
      aria-label="Imported comments"
      className="mt-4 border-t border-[rgba(236,226,196,0.16)] pt-4"
    >
      <p className="text-xs leading-6 text-[#b8ad8d]">{NAME_IS_A_HINT}</p>
      {error && (
        <p role="alert" className="mt-2 text-sm text-[#f1a07a]">
          {error}
        </p>
      )}
      {note && (
        <p role="status" className="mt-2 text-sm text-[#9dcf83]">
          {note}
        </p>
      )}
      {!list && !error && (
        <p role="status" className="mt-2 text-sm text-[#9f9676]">
          Loading imported comments…
        </p>
      )}
      {list && list.comments.length === 0 && (
        <p className="mt-2 text-sm text-[#9f9676]">
          No imported comments are left to link.
        </p>
      )}
      {list && list.comments.length > 0 && (
        <ul className="mt-3 flex flex-col gap-3">
          {list.comments.map((comment) => (
            <li key={comment.commentId}>
              <label className="flex gap-3 text-sm text-[#ece2c4]">
                <input
                  type="checkbox"
                  checked={picked.has(comment.commentId)}
                  onChange={() => toggle(comment.commentId)}
                />
                <span className="min-w-0">
                  <span className="font-medium">{comment.name}</span>
                  {comment.importedDate &&
                    ` · Pages: ${claimDay(comment.importedDate)}`}
                  {comment.page && ` · on ${comment.page.displayName}`}
                  {comment.linked && (
                    <span className="ml-2 text-[#9dcf83]">
                      Linked to {list.owner.displayName}
                    </span>
                  )}
                  {!comment.linked && comment.nameMatches && (
                    <span className="ml-2 text-[#f1d78a]">Name matches</span>
                  )}
                  <span className="mt-1 block whitespace-pre-wrap text-[#b8ad8d] [overflow-wrap:anywhere]">
                    {comment.excerpt}
                  </span>
                </span>
              </label>
            </li>
          ))}
        </ul>
      )}
      {list?.hasMore && (
        <p className="mt-2 text-xs text-[#9f9676]">
          Only the first imported comments are listed.
        </p>
      )}
      {list && list.comments.length > 0 && (
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            className={primaryStyle}
            disabled={busy || !pickedUnlinked}
            onClick={() => void apply(list, false)}
          >
            Link the ticked comments
          </button>
          <button
            type="button"
            className={buttonStyle}
            disabled={busy || !pickedLinked}
            onClick={() => void apply(list, true)}
          >
            Take back the ticked links
          </button>
        </div>
      )}
    </section>
  )
}
