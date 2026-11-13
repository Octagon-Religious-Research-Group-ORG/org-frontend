import {
  castVote,
  countsLabel,
  earlierLabel,
  withdrawVote,
} from '#/lib/votes-api'
import type {
  TabVotes,
  VoteAnswer,
  VoteBlock,
  VoteValue,
} from '#/lib/votes-api'
import { buttonStyle, primaryStyle } from './editor-styles'
import { useOwnerAction } from './use-owner-action'

/** Why the buttons are off, in the reader's own situation. */
export const VOTE_BLOCK_NOTES: Record<VoteBlock, string> = {
  'sign-in': 'Members with an approved page can vote. Sign in to take part.',
  'needs-approved-page':
    'You can vote once your member page has been approved.',
  'anonymous-off':
    'Anonymous members cannot vote for now. The members will decide whether they can.',
  'verify-email':
    'Please confirm your email address to vote. Check your inbox for the link.',
  'cannot-check':
    "We can't check your account right now, so voting is paused. Please try again in a moment.",
  'own-belief': 'This is your own belief, so you cannot vote on it.',
  'not-open': 'Voting opens once this page has been approved.',
}

export const STANCE_LABEL: Record<VoteValue, string> = {
  agree: 'Agrees',
  disagree: 'Disagrees',
}

/** Whether the reader may comment here, and why not (from the thread). */
export interface CommentAccess {
  mayComment: boolean
  /** Shown on the comment button when it is off. */
  reason?: string
}

/**
 * The five buttons on a belief (Tripp, D06/Q04): Agree · Disagree · Agree
 * and comment · Disagree and comment · Comment without a vote.
 *
 * - Agree and Disagree are toggles (`aria-pressed`): pressing your own vote
 *   again takes it back.
 * - "…and comment" casts that vote (unless it is already yours), then asks
 *   for the comment form with that stance.
 * - A vote on an earlier wording can be confirmed on this one in one click.
 * - The counts are announced politely when they change.
 *
 * The server decides who may vote; this only shows what it said.
 */
export function VoteButtons({
  slug,
  tabId,
  title,
  textSeq,
  votes,
  comment,
  onVotes,
  onCompose,
}: {
  slug: string
  tabId: string
  /** The belief's title: part of every button's name. */
  title: string
  /** The wording the page shows: what a vote is cast on. */
  textSeq: number
  votes: TabVotes
  /** Undefined while the thread has not said yet. */
  comment?: CommentAccess
  /** The belief's votes after a write. */
  onVotes: (answer: Pick<VoteAnswer, 'votes' | 'textSeq'>) => void
  /** Open the comment form, with the stance badge when given. */
  onCompose: (stance?: VoteValue) => void
}) {
  const { busy, problem, run } = useOwnerAction()
  const name = `“${title}”`
  const blocked = !votes.mayVote
  const reason = votes.viewerVoteBlock
    ? VOTE_BLOCK_NOTES[votes.viewerVoteBlock]
    : undefined

  const cast = async (value: VoteValue) => {
    const answer = await run((token) =>
      castVote(token, { slug, tabId, value, baseSeq: textSeq }),
    )
    if (answer === undefined) return false
    onVotes(answer)
    return true
  }

  const toggle = async (value: VoteValue) => {
    if (votes.myVote !== value) {
      await cast(value)
      return
    }
    const answer = await run((token) => withdrawVote(token, { slug, tabId }))
    if (answer?.votes) {
      onVotes({ votes: answer.votes, textSeq: answer.textSeq ?? textSeq })
    }
  }

  const voteAndComment = async (value: VoteValue) => {
    if (votes.myVote === value || (await cast(value))) onCompose(value)
  }

  const earlier = earlierLabel(votes.earlierWording)

  return (
    <div className="mt-6" aria-label={`Votes on ${name}`} role="group">
      <p
        role="status"
        aria-live="polite"
        className="font-mono text-[11px] uppercase tracking-[0.14em] text-[#ece2c4]"
      >
        {countsLabel(votes)}
        {earlier && (
          <span className="ml-2 normal-case tracking-normal text-[#9f9676]">
            ({earlier})
          </span>
        )}
      </p>
      {votes.myVoteOnEarlierWording && !votes.myVote && (
        <div className="mt-2 text-xs text-[#f1d78a]">
          <p>
            You voted “{votes.myVoteOnEarlierWording}” on an earlier wording of
            this belief, so your vote is not counted on this one.
          </p>
          <button
            type="button"
            disabled={busy || blocked}
            onClick={() => void cast(votes.myVoteOnEarlierWording as VoteValue)}
            className={primaryStyle}
          >
            Confirm my vote on the new wording
          </button>
        </div>
      )}
      <div className="flex flex-wrap gap-x-3">
        {(['agree', 'disagree'] as const).map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={votes.myVote === value}
            disabled={busy || blocked}
            onClick={() => void toggle(value)}
            aria-label={`${value === 'agree' ? 'Agree' : 'Disagree'} with ${name}`}
            className={votes.myVote === value ? primaryStyle : buttonStyle}
          >
            {value === 'agree' ? 'Agree' : 'Disagree'}
          </button>
        ))}
        {(['agree', 'disagree'] as const).map((value) => (
          <button
            key={`${value}-comment`}
            type="button"
            disabled={busy || blocked}
            onClick={() => void voteAndComment(value)}
            aria-label={`${value === 'agree' ? 'Agree' : 'Disagree'} and comment on ${name}`}
            className={buttonStyle}
          >
            {value === 'agree' ? 'Agree and comment' : 'Disagree and comment'}
          </button>
        ))}
        <button
          type="button"
          disabled={!comment?.mayComment}
          onClick={() => onCompose()}
          aria-label={`Comment without a vote on ${name}`}
          className={buttonStyle}
        >
          Comment without a vote
        </button>
      </div>
      {votes.myVote && (
        <p className="mt-2 text-xs text-[#9f9676]">
          You {votes.myVote} with this belief. Press{' '}
          {votes.myVote === 'agree' ? 'Agree' : 'Disagree'} again to take your
          vote back.
        </p>
      )}
      {blocked && reason && (
        <p className="mt-2 text-xs text-[#9f9676]">{reason}</p>
      )}
      {comment && !comment.mayComment && comment.reason && (
        <p className="mt-1 text-xs text-[#9f9676]">{comment.reason}</p>
      )}
      {problem && (
        <p role="alert" className="mt-2 text-sm text-[#f1a07a]">
          {problem}
        </p>
      )}
    </div>
  )
}
