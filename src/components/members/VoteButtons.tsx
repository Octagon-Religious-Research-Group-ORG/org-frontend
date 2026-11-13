import { ApiError } from '#/lib/api'
import {
  castOrgPageVote,
  castVote,
  countsLabel,
  earlierLabel,
  withdrawOrgPageVote,
  withdrawVote,
} from '#/lib/votes-api'
import type {
  TabVotes,
  VoteAnswer,
  VoteBlock,
  VoteValue,
} from '#/lib/votes-api'
import { useEffect, useRef, useState } from 'react'
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
 * What the buttons vote on: a member's belief, or one of ORG's own pages
 * (Chunk 10b), whose wording is its published revision.
 */
export type VoteTarget =
  | { slug: string; tabId: string; orgPageId?: never }
  | { orgPageId: string; slug?: never; tabId?: never }

/**
 * The five buttons on a belief or an ORG page (Tripp, D06/Q04): Agree ·
 * Disagree · Agree and comment · Disagree and comment · Comment without a
 * vote.
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
  orgPageId,
  title,
  textSeq,
  votes,
  comment,
  onVotes,
  onCompose,
  onStale,
}: VoteTarget & {
  /** The belief's or page's title: part of every button's name. */
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
  /**
   * An ORG page refused a vote with 409 (a newer revision was published, or
   * another window is saving): the page reads its votes again, so it can
   * offer the reload (Chunk 10b round 2, N1).
   */
  onStale?: () => void
}) {
  const { busy, problem, run } = useOwnerAction()
  const [countsOld, setCountsOld] = useState(false)
  // The votes this component handed up itself with old counts; any other
  // votes the page passes down (a page read again included) are fresh
  // (fix round 3, N2).
  const handedUp = useRef<TabVotes>(undefined)
  useEffect(() => {
    if (votes !== handedUp.current) setCountsOld(false)
  }, [votes])
  const name = `“${title}”`
  const subject = orgPageId === undefined ? 'belief' : 'page'
  const unit = orgPageId === undefined ? 'wording' : 'version'
  const blocked = !votes.mayVote
  const reason = votes.viewerVoteBlock
    ? VOTE_BLOCK_NOTES[votes.viewerVoteBlock]
    : undefined

  const cast = async (value: VoteValue) => {
    const answer = await run(async (token) => {
      if (orgPageId === undefined) {
        return castVote(token, { slug, tabId, value, baseSeq: textSeq })
      }
      const page = await castOrgPageVote(token, orgPageId, {
        value,
        baseSeq: textSeq,
      }).catch((err: unknown) => {
        if (err instanceof ApiError && err.status === 409) onStale?.()
        throw err
      })
      return { votes: page.votes, textSeq: page.revision }
    })
    if (answer === undefined) return false
    // Fresh counts: no longer "from before" (fix round 2, item a).
    setCountsOld(false)
    onVotes(answer)
    return true
  }

  /**
   * Takes the reader's vote back, on this wording or an earlier one. When
   * the answer carries no counts (the reader can no longer read the belief),
   * the pressed state is cleared here and the counts are marked as not
   * updated (fix round 1, LOW 4).
   */
  const withdraw = async () => {
    const answer = await run(async (token) => {
      if (orgPageId === undefined) {
        return withdrawVote(token, { slug, tabId })
      }
      const page = await withdrawOrgPageVote(token, orgPageId)
      // No votes back once the page is no longer published.
      return page.votes
        ? { votes: page.votes, textSeq: page.revision }
        : { withdrawn: true as const }
    })
    if (answer === undefined) return
    if (answer.votes) {
      setCountsOld(false)
      onVotes({ votes: answer.votes, textSeq: answer.textSeq ?? textSeq })
      return
    }
    const { myVote: _vote, myVoteOnEarlierWording: _earlier, ...rest } = votes
    setCountsOld(true)
    handedUp.current = rest
    onVotes({ votes: rest, textSeq })
  }

  const toggle = async (value: VoteValue) => {
    if (votes.myVote !== value) {
      await cast(value)
      return
    }
    await withdraw()
  }

  const voteAndComment = async (value: VoteValue) => {
    if (votes.myVote === value || (await cast(value))) onCompose(value)
  }

  const earlier = earlierLabel(votes.earlierWording, unit)

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
            You voted “{votes.myVoteOnEarlierWording}” on an earlier {unit} of
            this {subject}, so your vote is not counted on this one.
          </p>
          <button
            type="button"
            disabled={busy || blocked}
            onClick={() => void cast(votes.myVoteOnEarlierWording as VoteValue)}
            className={primaryStyle}
          >
            Confirm my vote on the new {unit}
          </button>{' '}
          <button
            type="button"
            disabled={busy}
            onClick={() => void withdraw()}
            className={buttonStyle}
          >
            Remove my earlier vote
          </button>
        </div>
      )}
      <div className="flex flex-wrap gap-x-3">
        {(['agree', 'disagree'] as const).map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={votes.myVote === value}
            // Taking one's own vote back never needs the right to vote now.
            disabled={busy || (blocked && votes.myVote !== value)}
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
          You {votes.myVote} with this {subject}. Press{' '}
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
      {countsOld && (
        <p role="status" className="mt-2 text-xs text-[#9f9676]">
          Your vote was taken back. The counts above are from before; reload the
          page to see them now.
        </p>
      )}
      {problem && (
        <p role="alert" className="mt-2 text-sm text-[#f1a07a]">
          {problem}
        </p>
      )}
    </div>
  )
}
