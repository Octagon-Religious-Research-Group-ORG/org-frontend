import type { WriteBlock } from './comments-api'
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
  /** The reader may comment on the listed beliefs; why not, when not. */
  viewerMayComment: boolean
  viewerWriteBlock?: WriteBlock
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

/** One of ORG's own pages and its votes, as this reader sees them (Chunk 10b). */
export interface OrgPageVotes {
  pageId: string
  /** The published revision the counts are for: what a vote is cast on. */
  revision: number
  votes: TabVotes
}

const orgPagePath = (pageId: string) =>
  `/members/org-pages/${encodeURIComponent(pageId)}`
const myOrgPageVote = (pageId: string) =>
  `/me/org-pages/${encodeURIComponent(pageId)}/vote`

/** An ORG page's votes; anyone may read them, signed in or not. */
export function fetchOrgPageVotes(
  pageId: string,
  options: { token?: string } = {},
) {
  return memberRequest<OrgPageVotes>(`${orgPagePath(pageId)}/votes`, {
    token: options.token,
  })
}

/** Casts, changes or confirms a vote on an ORG page's revision `baseSeq`. */
export function castOrgPageVote(
  token: string,
  pageId: string,
  vote: { value: VoteValue; baseSeq: number },
) {
  return memberRequest<OrgPageVotes>(myOrgPageVote(pageId), {
    method: 'PUT',
    token,
    body: JSON.stringify(vote),
  })
}

/** Takes the reader's vote on an ORG page back, on any revision. */
export function withdrawOrgPageVote(token: string, pageId: string) {
  return memberRequest<{ withdrawn: true } & OrgPageVotes>(
    myOrgPageVote(pageId),
    { method: 'DELETE', token },
  )
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

/**
 * "1 vote on an earlier wording"; nothing for none. An ORG page has versions
 * rather than wordings (Chunk 10b).
 */
export function earlierLabel(
  count: number,
  unit: 'wording' | 'version' = 'wording',
) {
  if (count === 0) return undefined
  return count === 1
    ? `1 vote on an earlier ${unit}`
    : `${count.toLocaleString('en-US')} votes on an earlier ${unit}`
}
