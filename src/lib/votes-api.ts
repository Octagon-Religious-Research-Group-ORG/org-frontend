import type { ParagraphView } from './members-api'
import { memberRequest } from './membership-api'

export type VoteValue = 'agree' | 'disagree'

/** Why the vote buttons are off for this reader, on this belief. */
export type VoteBlock =
  | 'sign-in'
  | 'needs-approved-page'
  | 'anonymous-off'
  | 'verify-email'
  | 'cannot-check'
  | 'own-belief'
  | 'not-open'

/** One belief's votes as this reader sees them (Chunk 10). */
export interface TabVotes {
  /** Counted votes on the current wording. */
  agree: number
  disagree: number
  /** Votes kept from an earlier wording; not counted. */
  earlierWording: number
  /** The reader's vote on the current wording. */
  myVote?: VoteValue
  /** The reader's vote on an earlier wording, to confirm on this one. */
  myVoteOnEarlierWording?: VoteValue
  mayVote: boolean
  viewerVoteBlock?: VoteBlock
}

/** A write's answer: the belief's votes now, and its text version. */
export interface VoteAnswer {
  tabId: string
  textSeq: number
  votes: TabVotes
}

export interface AgreedBelief {
  slug: string
  tabId: string
  title: string
  paragraphs: Array<ParagraphView>
  textSeq: number
  author: { displayName: string; slug: string }
  votes: TabVotes
}

export interface AgreedPage {
  beliefs: Array<AgreedBelief>
  nextAfter?: string
}

/** Casts, changes or confirms a vote on the wording `baseSeq`. */
export function castVote(
  token: string,
  vote: { slug: string; tabId: string; value: VoteValue; baseSeq: number },
) {
  return memberRequest<VoteAnswer>('/me/votes', {
    method: 'PUT',
    token,
    body: JSON.stringify(vote),
  })
}

/**
 * Takes the reader's vote back. The answer carries the belief's votes when
 * the reader may still read it.
 */
export function withdrawVote(
  token: string,
  target: { slug: string; tabId: string },
) {
  return memberRequest<{ withdrawn: true } & Partial<VoteAnswer>>('/me/votes', {
    method: 'DELETE',
    token,
    body: JSON.stringify(target),
  })
}

/** The Beliefs page section: beliefs at least two members agree with. */
export function fetchAgreedBeliefs(
  options: { after?: string; token?: string } = {},
) {
  const query = options.after
    ? `?after=${encodeURIComponent(options.after)}`
    : ''
  return memberRequest<AgreedPage>(`/members/agreed-beliefs${query}`, {
    token: options.token,
  })
}

/** "2 agree · 1 disagree". */
export function countsLabel(votes: Pick<TabVotes, 'agree' | 'disagree'>) {
  return `${votes.agree.toLocaleString('en-US')} agree · ${votes.disagree.toLocaleString('en-US')} disagree`
}

/** "1 vote on an earlier wording"; nothing for none. */
export function earlierLabel(count: number) {
  if (count === 0) return undefined
  return count === 1
    ? '1 vote on an earlier wording'
    : `${count.toLocaleString('en-US')} votes on an earlier wording`
}
