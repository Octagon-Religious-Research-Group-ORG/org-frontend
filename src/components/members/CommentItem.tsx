import { useState } from 'react'
import {
  acceptSuggestion,
  declineSuggestion,
  editComment,
  postComment,
  removeComment,
} from '#/lib/comments-api'
import type { CommentView } from '#/lib/comments-api'
import { CommentAuthorName } from './CommentAuthorName'
import { CommentForm } from './CommentForm'
import { CommentHistory } from './CommentHistory'
import { buttonStyle, dangerStyle, primaryStyle } from './editor-styles'
import { formatSavedAt } from './HistoryPanel'
import { MemberText } from './MemberText'
import { useOwnerAction } from './use-owner-action'

export const REMOVED_NOTE = 'Comment removed by its author.'
export const REMOVE_COMMENT_EXPLAINED =
  'It disappears from the thread for everyone, and replies keep their place. ORG keeps its text for at least five years.'

function formatDay(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    dateStyle: 'medium',
    timeZone: 'UTC',
  })
}

const STATUS_LABEL = {
  pending: 'Waiting for the page owner',
  accepted: 'Accepted by the page owner',
  declined: 'Declined by the page owner',
} as const

type Mode = 'idle' | 'replying' | 'editing' | 'confirm-remove' | 'history'

export interface ThreadActions {
  slug: string
  /** The reader may write: shows "Reply". */
  mayReply: boolean
  /** The belief's text now, to compare a suggestion with. */
  currentText?: string
  /** Reload the thread after a change. */
  onThreadChanged: () => void
  /** Reload the whole page: an accepted suggestion changed the belief. */
  onPageChanged: () => void
}

/**
 * One comment with its replies. A removed one keeps its place as a note, so
 * the replies under it still make sense; an imported one shows its Apple
 * Pages name and date, which prove nothing about when it was written.
 */
export function CommentItem({
  comment,
  actions,
  isReply = false,
}: {
  comment: CommentView
  actions: ThreadActions
  isReply?: boolean
}) {
  const [mode, setMode] = useState<Mode>('idle')
  const { busy, problem, run } = useOwnerAction()
  const suggestion = comment.suggestion

  const done = (changed: boolean) => {
    if (!changed) return false
    setMode('idle')
    actions.onThreadChanged()
    return true
  }

  const reply = async (body: string) =>
    done(
      (await run((token) =>
        postComment(token, {
          slug: actions.slug,
          parentCommentId: comment.commentId,
          body,
        }),
      )) !== undefined,
    )

  const edit = async (body: string) =>
    done(
      (await run((token) =>
        editComment(token, comment.commentId, body, comment.seq ?? 1),
      )) !== undefined,
    )

  const remove = async () =>
    done(
      (await run((token) => removeComment(token, comment.commentId))) !==
        undefined,
    )

  const decide = async (decision: 'accept' | 'decline') => {
    const result = await run<unknown>((token) =>
      decision === 'accept'
        ? acceptSuggestion(token, comment.commentId)
        : declineSuggestion(token, comment.commentId),
    )
    if (result === undefined) return
    if (decision === 'accept') actions.onPageChanged()
    actions.onThreadChanged()
  }

  return (
    <li
      className={`border-t border-[rgba(236,226,196,0.12)] pt-3 ${isReply ? 'ml-4 sm:ml-8' : ''}`}
    >
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <CommentAuthorName author={comment.author} />
        <time
          dateTime={comment.postedAt}
          className="font-mono text-[11px] text-[#78aea2]"
        >
          {formatSavedAt(comment.postedAt)}
        </time>
        {comment.editedAt && (
          <span className="font-mono text-[11px] text-[#9f9676]">
            edited {formatSavedAt(comment.editedAt)}
          </span>
        )}
      </div>
      {comment.source === 'imported' && (
        <p className="mt-1 text-xs text-[#f1d78a]">
          Imported from Apple Pages
          {comment.importedDate &&
            `; Pages showed ${formatDay(comment.importedDate)}, which is not proof of when it was written`}
          .
        </p>
      )}
      {suggestion && (
        <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.18em] text-[#78aea2]">
          Suggested rewording · {STATUS_LABEL[suggestion.status]}
          {suggestion.decidedAt && ` · ${formatSavedAt(suggestion.decidedAt)}`}
        </p>
      )}
      {comment.anchorText && (
        <blockquote className="mt-2 border-l-2 border-[#78aea2] pl-3 text-sm italic text-[#b8ad8d] [overflow-wrap:anywhere]">
          “{comment.anchorText}”
        </blockquote>
      )}

      {comment.removed ? (
        <p className="mt-2 text-sm italic text-[#9f9676]">{REMOVED_NOTE}</p>
      ) : mode === 'editing' ? (
        <CommentForm
          label="Edit your comment"
          submitLabel="Save"
          initial={comment.body}
          busy={busy}
          onSubmit={edit}
          onCancel={() => setMode('idle')}
        />
      ) : (
        comment.body && (
          <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[#d8ceb0] [overflow-wrap:anywhere]">
            <MemberText text={comment.body} />
          </p>
        )
      )}

      {suggestion?.proposedText !== undefined && !comment.removed && (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {suggestion.canDecide && actions.currentText !== undefined && (
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#9f9676]">
                Now
              </p>
              <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-[#b8ad8d] [overflow-wrap:anywhere]">
                <MemberText text={actions.currentText} />
              </p>
            </div>
          )}
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#9f9676]">
              Proposed
            </p>
            <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-[#ece2c4] [overflow-wrap:anywhere]">
              <MemberText text={suggestion.proposedText} />
            </p>
          </div>
        </div>
      )}
      {suggestion?.stale && (
        <p className="mt-2 text-xs text-[#f1d78a]">
          The belief changed since this suggestion was written, so it can only
          be declined now.
        </p>
      )}
      {suggestion?.canDecide && (
        <div className="flex flex-wrap gap-3">
          {!suggestion.stale && (
            <button
              type="button"
              disabled={busy}
              onClick={() => void decide('accept')}
              className={primaryStyle}
            >
              Accept
            </button>
          )}
          <button
            type="button"
            disabled={busy}
            onClick={() => void decide('decline')}
            className={buttonStyle}
          >
            Decline
          </button>
        </div>
      )}

      {!comment.removed && mode !== 'editing' && (
        <div className="flex flex-wrap gap-3">
          {!isReply && actions.mayReply && (
            <button
              type="button"
              aria-expanded={mode === 'replying'}
              onClick={() => setMode(mode === 'replying' ? 'idle' : 'replying')}
              className={buttonStyle}
            >
              Reply
            </button>
          )}
          {comment.edited && (
            <button
              type="button"
              aria-expanded={mode === 'history'}
              onClick={() => setMode(mode === 'history' ? 'idle' : 'history')}
              className={buttonStyle}
            >
              Edit history
            </button>
          )}
          {comment.mine && comment.kind === 'comment' && (
            <button
              type="button"
              onClick={() => setMode('editing')}
              className={buttonStyle}
            >
              Edit
            </button>
          )}
          {comment.mine &&
            (comment.kind === 'comment' ||
              suggestion?.status === 'pending') && (
              <button
                type="button"
                onClick={() => setMode('confirm-remove')}
                className={dangerStyle}
              >
                {comment.kind === 'suggestion' ? 'Withdraw' : 'Remove'}
              </button>
            )}
        </div>
      )}
      {mode === 'confirm-remove' && (
        <div role="group" aria-label="Confirm removal" className="mt-3">
          <p className="text-sm text-[#d8ceb0]">{REMOVE_COMMENT_EXPLAINED}</p>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              disabled={busy}
              onClick={() => void remove()}
              className={dangerStyle}
            >
              Yes, remove it
            </button>
            <button
              type="button"
              onClick={() => setMode('idle')}
              className={buttonStyle}
            >
              Keep it
            </button>
          </div>
        </div>
      )}
      {mode === 'history' && (
        <CommentHistory
          slug={actions.slug}
          commentId={comment.commentId}
          onClose={() => setMode('idle')}
        />
      )}
      {mode === 'replying' && (
        <CommentForm
          label="Your reply"
          submitLabel="Post reply"
          busy={busy}
          onSubmit={reply}
          onCancel={() => setMode('idle')}
        />
      )}
      {problem && (
        <p role="alert" className="mt-2 text-sm text-[#f1a07a]">
          {problem}
        </p>
      )}

      {comment.replies && comment.replies.length > 0 && (
        <ol className="mt-3 flex flex-col gap-3">
          {comment.replies.map((replyView) => (
            <CommentItem
              key={replyView.commentId}
              comment={replyView}
              actions={actions}
              isReply
            />
          ))}
        </ol>
      )}
    </li>
  )
}
