import { useEffect, useRef, useState } from 'react'
import { useOrgAuth } from '#/lib/auth'
import { fetchThread, postComment, suggestRewording } from '#/lib/comments-api'
import type { CommentView, ThreadPage, WriteBlock } from '#/lib/comments-api'
import { CommentForm } from './CommentForm'
import { CommentItem } from './CommentItem'
import type { ThreadActions } from './CommentItem'
import { buttonStyle } from './editor-styles'
import { SuggestForm } from './SuggestForm'
import {
  EMPTY_THREAD,
  shownComments,
  withComment,
  withMorePages,
  withPages,
} from './thread-state'
import type { ThreadState } from './thread-state'
import { useOwnerAction } from './use-owner-action'

const SESSION_UNCONFIRMED =
  "We couldn't confirm that you're signed in. Please try again."

/** Why the form is not there, in the reader's own situation. */
export const WRITE_BLOCK_NOTES: Record<WriteBlock, string> = {
  'sign-in':
    'Members with an approved page can comment. Sign in, or finish joining, to take part.',
  'needs-approved-page':
    'You can comment once your member page has been approved.',
  'verify-email':
    'Please confirm your email address to comment. Check your inbox for the link.',
  'cannot-check':
    "We can't check your account right now, so commenting is paused. Please try again in a moment.",
}
export const WRITE_HINT = WRITE_BLOCK_NOTES['sign-in']

/**
 * One thread: a belief's (at the bottom of its tab, plan §2c) or the page's
 * own ("About this page"). Oldest first, twenty top-level comments at a
 * time, each with its replies. The server decides who may read and write;
 * this shows the forms only when it says the reader may.
 *
 * Every write answers with its comment, which is put in place at once
 * (`thread-state.ts`): a new comment at the thread's end, an edit or a
 * removal where it is. The thread is not read again to show it, however
 * long it is (review round 2, item 3).
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
  const [thread, setThread] = useState<ThreadState>(EMPTY_THREAD)
  const [problem, setProblem] = useState<string>()
  const [loading, setLoading] = useState(false)
  const [suggesting, setSuggesting] = useState(false)
  const writer = useOwnerAction()
  const current = useRef<ThreadState>(EMPTY_THREAD)
  // Only the newest load may show its answer; closing the thread ends all.
  const generation = useRef(0)

  const show = (next: ThreadState) => {
    current.current = next
    setThread(next)
  }

  /**
   * Reads `count` pages from the start, or one more page after the last.
   * Bounded by what the reader asked for: never the whole thread.
   */
  const load = async (plan: { append?: boolean; count?: number } = {}) => {
    const run = ++generation.current
    setLoading(true)
    try {
      const token = auth.isAuthenticated ? await auth.getToken() : undefined
      if (auth.isAuthenticated && !token) throw new Error(SESSION_UNCONFIRMED)
      const fetched: Array<ThreadPage> = []
      let after = plan.append
        ? current.current.pages.at(-1)?.nextAfter
        : undefined
      const want = Math.max(plan.count ?? 1, 1)
      do {
        const page = await fetchThread(slug, { tabId, after, token })
        fetched.push(page)
        after = page.nextAfter
      } while (after && fetched.length < want)
      if (run !== generation.current) return
      show(
        plan.append
          ? withMorePages(current.current, fetched)
          : withPages(current.current, fetched),
      )
      setProblem(undefined)
    } catch (err) {
      if (run !== generation.current) return
      setProblem(
        err instanceof Error ? err.message : 'These comments are unavailable.',
      )
    } finally {
      if (run === generation.current) setLoading(false)
    }
  }

  useEffect(() => {
    if (auth.isLoading) return
    show(EMPTY_THREAD)
    void load()
    return () => {
      generation.current++
    }
    // `load` reads the latest props itself; a new reader or thread reloads.
  }, [auth, slug, tabId])

  /** Shows a write's answer in place; an older server sends none. */
  const changed = (view?: CommentView) => {
    if (view) show(withComment(current.current, view))
    else void load({ count: current.current.pages.length })
  }

  const first = thread.pages.at(0)
  const last = thread.pages.at(-1)
  const comments = shownComments(thread)
  const actions: ThreadActions = {
    slug,
    mayReply: first?.viewerMayComment ?? false,
    ...(belief ? { currentText: belief.text } : {}),
    onChanged: changed,
    onPageChanged,
  }

  const post = async (body: string) => {
    const saved = await writer.run((token) =>
      postComment(token, { slug, body, ...(tabId ? { tabId } : {}) }),
    )
    if (saved === undefined) return false
    changed(saved.comment)
    return true
  }

  const suggestOn =
    (target: { tabId: string; textSeq: number }) =>
    async (text: string, note: string) => {
      const saved = await writer.run((token) =>
        suggestRewording(token, {
          slug,
          tabId: target.tabId,
          text,
          baseSeq: target.textSeq,
          ...(note ? { note } : {}),
        }),
      )
      if (saved === undefined) return false
      setSuggesting(false)
      changed(saved.comment)
      return true
    }

  const block = first?.viewerWriteBlock ?? 'sign-in'

  return (
    <section aria-label={title} aria-busy={loading} className="mt-8">
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
          {thread.pages
            .flatMap((page) => page.comments)
            .map((comment, index) => (
              <CommentItem
                key={comment.commentId}
                comment={comment}
                position={`comment ${index + 1}`}
                actions={actions}
              />
            ))}
        </ol>
      )}
      {last?.nextAfter && (
        <button
          type="button"
          disabled={loading}
          onClick={() => void load({ append: true })}
          className={buttonStyle}
        >
          Load more comments
        </button>
      )}
      {thread.posted.length > 0 && (
        <ol
          aria-label="Your new comments, at the end of the thread"
          className="mt-3 flex flex-col gap-3"
        >
          {thread.posted.map((comment, index) => (
            <CommentItem
              key={comment.commentId}
              comment={comment}
              position={`your new comment ${index + 1}`}
              actions={actions}
            />
          ))}
        </ol>
      )}
      {first?.viewerMayComment ? (
        <CommentForm
          label={tabId ? 'Comment on this belief' : 'Comment on this page'}
          submitLabel="Post comment"
          busy={writer.busy}
          onSubmit={post}
        />
      ) : (
        first && (
          <p className="mt-3 text-xs text-[#9f9676]">
            {WRITE_BLOCK_NOTES[block]}
          </p>
        )
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
            <SuggestForm
              initial={belief.text}
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
