import { useEffect, useState } from 'react'
import { useOrgAuth } from '#/lib/auth'
import { fetchThread, postComment, suggestRewording } from '#/lib/comments-api'
import type { CommentView, ThreadPage } from '#/lib/comments-api'
import { MAX_SAVED_TEXT } from '#/lib/members-api'
import { CommentForm } from './CommentForm'
import { CommentItem } from './CommentItem'
import type { ThreadActions } from './CommentItem'
import { buttonStyle } from './editor-styles'
import { useOwnerAction } from './use-owner-action'

const SESSION_UNCONFIRMED =
  "We couldn't confirm that you're signed in. Please try again."

export const WRITE_HINT =
  'Members with an approved page can comment. Sign in, or finish joining, to take part.'

/**
 * One thread: a belief's (at the bottom of its tab, plan §2c) or the page's
 * own ("About this page"). Oldest first, twenty top-level comments at a
 * time, each with its replies. The server decides who may read and write;
 * this shows the forms only when it says the reader may.
 */
export function CommentThread({
  slug,
  title,
  tabId,
  belief,
  onPageChanged,
}: {
  slug: string
  /** The heading, e.g. "Comments" or "About this page". */
  title: string
  /** A belief's thread; without it, the page's own. */
  tabId?: string
  /** The belief as the page shows it, for suggestions. */
  belief?: { text: string; textSeq: number }
  onPageChanged: () => void
}) {
  const auth = useOrgAuth()
  const [pages, setPages] = useState<Array<ThreadPage>>([])
  const [problem, setProblem] = useState<string>()
  const [reloads, setReloads] = useState(0)
  const [more, setMore] = useState<string>()
  const [suggesting, setSuggesting] = useState(false)
  const writer = useOwnerAction()

  useEffect(() => {
    if (auth.isLoading) return
    const closed = new AbortController()
    void (async () => {
      try {
        const token = auth.isAuthenticated ? await auth.getToken() : undefined
        if (auth.isAuthenticated && !token) throw new Error(SESSION_UNCONFIRMED)
        const page = await fetchThread(slug, { tabId, after: more, token })
        if (closed.signal.aborted) return
        setPages((loaded) => (more ? [...loaded, page] : [page]))
        setProblem(undefined)
      } catch (err) {
        if (closed.signal.aborted) return
        setProblem(
          err instanceof Error
            ? err.message
            : 'These comments are unavailable.',
        )
      }
    })()
    return () => closed.abort()
  }, [auth, slug, tabId, more, reloads])

  const reload = () => {
    setMore(undefined)
    setReloads((count) => count + 1)
  }

  const first = pages.at(0)
  const last = pages.at(-1)
  const comments: Array<CommentView> = pages.flatMap((page) => page.comments)
  const actions: ThreadActions = {
    slug,
    mayReply: first?.viewerMayComment ?? false,
    ...(belief ? { currentText: belief.text } : {}),
    onThreadChanged: reload,
    onPageChanged,
  }

  const post = async (body: string) => {
    const saved = await writer.run((token) =>
      postComment(token, { slug, body, ...(tabId ? { tabId } : {}) }),
    )
    if (saved === undefined) return false
    reload()
    return true
  }

  const suggestOn =
    (target: { tabId: string; textSeq: number }) => async (text: string) => {
      const saved = await writer.run((token) =>
        suggestRewording(token, {
          slug,
          tabId: target.tabId,
          text,
          baseSeq: target.textSeq,
        }),
      )
      if (saved === undefined) return false
      setSuggesting(false)
      reload()
      return true
    }

  return (
    <section aria-label={title} className="mt-8">
      <h4 className="font-mono text-[11px] uppercase tracking-[0.24em] text-[#78aea2]">
        {title}
      </h4>
      {problem && (
        <p role="alert" className="mt-3 text-sm text-[#f1a07a]">
          {problem}
        </p>
      )}
      {!first && !problem ? (
        <p role="status" className="mt-3 text-sm text-[#b8ad8d]">
          Opening the comments…
        </p>
      ) : comments.length === 0 && first ? (
        <p className="mt-3 text-sm text-[#b8ad8d]">No comments yet.</p>
      ) : (
        <ol className="mt-3 flex flex-col gap-3">
          {comments.map((comment) => (
            <CommentItem
              key={comment.commentId}
              comment={comment}
              actions={actions}
            />
          ))}
        </ol>
      )}
      {last?.nextAfter && (
        <button
          type="button"
          onClick={() => setMore(last.nextAfter)}
          className={buttonStyle}
        >
          Load more comments
        </button>
      )}
      {first?.viewerMayComment ? (
        <CommentForm
          label={tabId ? 'Comment on this belief' : 'Comment on this page'}
          submitLabel="Post comment"
          busy={writer.busy}
          onSubmit={post}
        />
      ) : (
        first && <p className="mt-3 text-xs text-[#9f9676]">{WRITE_HINT}</p>
      )}
      {first?.viewerMaySuggest && tabId && belief && (
        <>
          <button
            type="button"
            aria-expanded={suggesting}
            onClick={() => setSuggesting(!suggesting)}
            className={buttonStyle}
          >
            Suggest a rewording
          </button>
          {suggesting && (
            <CommentForm
              label="Your wording of the whole belief"
              submitLabel="Send suggestion"
              initial={belief.text}
              max={MAX_SAVED_TEXT}
              busy={writer.busy}
              onSubmit={suggestOn({ tabId, textSeq: belief.textSeq })}
              onCancel={() => setSuggesting(false)}
            />
          )}
        </>
      )}
      {writer.problem && (
        <p role="alert" className="mt-2 text-sm text-[#f1a07a]">
          {writer.problem}
        </p>
      )}
    </section>
  )
}
