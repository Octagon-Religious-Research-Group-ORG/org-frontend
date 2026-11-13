import { memberRequest } from './membership-api'
import type { VoteValue } from './votes-api'

/** Most characters one comment holds (the server's limit). */
export const MAX_COMMENT_LENGTH = 10_000

/** Who wrote a comment, as this reader may see them. */
export type CommentAuthor =
  /**
   * A site member: named only when their page is approved and the reader
   * may see it; `slug` only when the reader may open the whole page.
   */
  | { kind: 'member'; displayName?: string; slug?: string }
  /** A name typed into Apple Pages; it proves no identity. */
  | { kind: 'imported'; name: string }
  | { kind: 'admin' }

/** Why the comment form is not offered. */
export type WriteBlock =
  'sign-in' | 'needs-approved-page' | 'verify-email' | 'cannot-check'

export interface SuggestionView {
  /** Absent once its author removed it. */
  proposedText?: string
  baseSeq: number
  status: 'pending' | 'accepted' | 'declined'
  decidedAt?: string
  /** Pending, and the belief changed since it was written. */
  stale?: boolean
  /** The reader owns the page and may accept or decline it. */
  canDecide?: boolean
}

export interface CommentView {
  commentId: string
  kind: 'comment' | 'suggestion'
  source: 'imported' | 'member'
  author: CommentAuthor
  /** Server time it was written here (for imports: when it was imported). */
  postedAt: string
  /** The date Apple Pages showed: never proof of when it was written. */
  importedDate?: string
  removed: boolean
  body?: string
  /** The highlighted text an imported comment was attached to. */
  anchorText?: string
  edited: boolean
  editedAt?: string
  /** The reader wrote it, so may edit or remove it. */
  mine: boolean
  /** What an edit is based on; only on the reader's own. */
  seq?: number
  suggestion?: SuggestionView
  /** On a reply: the comment it answers. */
  parentCommentId?: string
  /** Posted with "Agree and comment" / "Disagree and comment" (Chunk 10). */
  stance?: VoteValue
  /** Top-level comments only. */
  replies?: Array<CommentView>
}

/** Every write answers with the comment as the writer now sees it. */
export interface WriteAnswer {
  comment?: CommentView
}

export interface ThreadPage {
  comments: Array<CommentView>
  nextAfter?: string
  viewerMayComment: boolean
  /** Why not, when the reader may not write. */
  viewerWriteBlock?: WriteBlock
  viewerMaySuggest: boolean
}

export interface CommentHistoryEntry {
  seq: number
  savedAt: string
  text: string
  hash: string
}

export interface CommentHistoryPage {
  entries: Array<CommentHistoryEntry>
  page: number
  hasMore: boolean
}

const profilePath = (slug: string) =>
  `/members/profiles/${encodeURIComponent(slug.toLowerCase())}`

/**
 * One page of a thread: a belief's (`tabId`) or the page's own ("About this
 * page"). Oldest first, each comment with its replies.
 */
export function fetchThread(
  slug: string,
  options: { tabId?: string; after?: string; token?: string } = {},
) {
  const query = new URLSearchParams()
  if (options.tabId) query.set('tab', options.tabId)
  if (options.after) query.set('after', options.after)
  const search = query.toString()
  return memberRequest<ThreadPage>(
    `${profilePath(slug)}/comments${search ? `?${search}` : ''}`,
    { token: options.token },
  )
}

export function fetchCommentHistory(
  slug: string,
  commentId: string,
  options: { page?: number; token?: string } = {},
) {
  return memberRequest<CommentHistoryPage>(
    `${profilePath(slug)}/comments/${encodeURIComponent(commentId)}/history?page=${options.page ?? 1}`,
    { token: options.token },
  )
}

export function postComment(
  token: string,
  comment: {
    slug: string
    body: string
    tabId?: string
    parentCommentId?: string
    /** The writer's vote on the belief, shown as a badge (Chunk 10). */
    stance?: VoteValue
  },
) {
  return memberRequest<WriteAnswer & { commentId: string; seq: number }>(
    '/me/comments',
    {
      method: 'POST',
      token,
      body: JSON.stringify(comment),
    },
  )
}

export function editComment(
  token: string,
  commentId: string,
  body: string,
  baseSeq: number,
) {
  return memberRequest<WriteAnswer & { changed: boolean; seq: number }>(
    `/me/comments/${encodeURIComponent(commentId)}`,
    { method: 'PUT', token, body: JSON.stringify({ body, baseSeq }) },
  )
}

export function removeComment(token: string, commentId: string) {
  return memberRequest<WriteAnswer & { removed: boolean }>(
    `/me/comments/${encodeURIComponent(commentId)}`,
    { method: 'DELETE', token },
  )
}

export function suggestRewording(
  token: string,
  suggestion: {
    slug: string
    tabId: string
    text: string
    baseSeq: number
    note?: string
  },
) {
  return memberRequest<WriteAnswer & { commentId: string }>('/me/suggestions', {
    method: 'POST',
    token,
    body: JSON.stringify(suggestion),
  })
}

const decisionPath = (commentId: string, decision: 'accept' | 'decline') =>
  `/me/member-page/suggestions/${encodeURIComponent(commentId)}/${decision}`

export function acceptSuggestion(token: string, commentId: string) {
  return memberRequest<WriteAnswer & { accepted: boolean; seq: number }>(
    decisionPath(commentId, 'accept'),
    { method: 'POST', token },
  )
}

export function declineSuggestion(token: string, commentId: string) {
  return memberRequest<WriteAnswer & { declined: boolean }>(
    decisionPath(commentId, 'decline'),
    { method: 'POST', token },
  )
}
