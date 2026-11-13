import { memberRequest } from './membership-api'

/** Most characters a claim request's message holds (the server's limit). */
export const MAX_CLAIM_MESSAGE_LENGTH = 2_000

/** Most characters a rejection reason holds (the server's limit). */
export const MAX_CLAIM_REASON_LENGTH = 500

export type ClaimStatus = 'pending' | 'approved' | 'rejected' | 'withdrawn'

/** Why a signed-in reader may not ask to claim a page now. */
export type ClaimBlock =
  'verify-email' | 'has-page' | 'has-pending' | 'cannot-check'

export interface ClaimedPage {
  slug: string
  displayName: string
}

/** One of the reader's own requests. */
export interface MyClaim {
  claimId: string
  /** Absent when the page no longer exists. */
  page?: ClaimedPage
  status: ClaimStatus
  message: string
  requestedAt: string
  decidedAt?: string
  /** A rejection's reason, when the admin gave one. */
  reason?: string
}

export interface MyClaims {
  mayClaim: boolean
  block?: ClaimBlock
  /** Newest first. */
  claims: Array<MyClaim>
}

/** One request in the admin queue. */
export interface AdminClaim {
  claimId: string
  status: ClaimStatus
  /** An approval is being written right now. */
  approving: boolean
  message: string
  requestedAt: string
  decidedAt?: string
  /** The site decided it (the page went to someone else, or is gone). */
  decidedBySite: boolean
  reason?: string
  claimant: { userId: string; email?: string; emailVerified?: boolean }
  page?: ClaimedPage
}

/** An imported comment an admin may link to an approved claimant. */
export interface LegacyComment {
  commentId: string
  page?: ClaimedPage
  /** The name typed into Apple Pages. */
  name: string
  importedDate?: string
  excerpt: string
  /** Already linked to this claimant. */
  linked: boolean
  /** Its Pages name reads like the claimed page's: a hint, never proof. */
  nameMatches: boolean
}

export interface LegacyCommentList {
  owner: ClaimedPage
  comments: Array<LegacyComment>
  hasMore: boolean
}

const json = (body: unknown) => JSON.stringify(body)
const claimPath = (claimId: string) =>
  `/admin/claims/${encodeURIComponent(claimId)}`

export function fetchMyClaims(token: string) {
  return memberRequest<MyClaims>('/me/claims', { token })
}

export function requestClaim(token: string, slug: string, message: string) {
  return memberRequest<MyClaim>('/me/claims', {
    method: 'POST',
    token,
    body: json({ slug, message }),
  })
}

export function withdrawClaim(token: string, claimId: string) {
  return memberRequest<{ withdrawn: boolean }>(
    `/me/claims/${encodeURIComponent(claimId)}`,
    { method: 'DELETE', token },
  )
}

export function fetchAdminClaims(token: string, status: ClaimStatus) {
  return memberRequest<{ claims: Array<AdminClaim> }>(
    `/admin/claims?status=${encodeURIComponent(status)}`,
    { token },
  )
}

export function approveClaim(token: string, claimId: string) {
  return memberRequest<{ approved: boolean }>(`${claimPath(claimId)}/approve`, {
    method: 'POST',
    token,
  })
}

/** An empty reason is sent as none. */
export function rejectClaim(token: string, claimId: string, reason: string) {
  const trimmed = reason.trim()
  return memberRequest<{ rejected: boolean }>(`${claimPath(claimId)}/reject`, {
    method: 'POST',
    token,
    body: json(trimmed ? { reason: trimmed } : {}),
  })
}

export function fetchLegacyComments(token: string, claimId: string) {
  return memberRequest<LegacyCommentList>(
    `${claimPath(claimId)}/legacy-comments`,
    { token },
  )
}

export function linkLegacyComments(
  token: string,
  claimId: string,
  commentIds: Array<string>,
  unlink = false,
) {
  return memberRequest<{
    linked?: Array<string>
    unlinked?: Array<string>
    skipped: Array<string>
  }>(`${claimPath(claimId)}/legacy-comments/${unlink ? 'unlink' : 'link'}`, {
    method: 'POST',
    token,
    body: json({ commentIds }),
  })
}

/** A day as the claims screens show it, e.g. "Nov 13, 2026" (UTC). */
export function claimDay(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    dateStyle: 'medium',
    timeZone: 'UTC',
  })
}
