import { memberRequest } from './membership-api'
import type { ProfileVisibility } from './membership-api'

/** Most characters a reason holds (the server's limits). */
export const MAX_REMOVAL_REASON_LENGTH = 500
export const MAX_ROLE_REASON_LENGTH = 500
/** Most characters of a member's note with an EaM request. */
export const MAX_EAM_NOTE_LENGTH = 1_000

export type PageStatus = 'pending' | 'approved' | 'removed'
export type MemberFilter = 'all' | 'approved' | 'pending' | 'removed'

/** A member page as the admin dashboard lists it. */
export interface AdminMember {
  slug: string
  displayName: string
  reviewStatus: PageStatus
  visibility: ProfileVisibility
  anonymous: boolean
  source: 'migrated' | 'native'
  /** Absent for an imported page nobody has claimed yet. */
  ownerUserId?: string
  createdAt?: string
  /** Pages whose name reads like this one (waiting pages only). */
  similarNameOf?: Array<string>
  removal?: {
    at: string
    by: string
    reason: string
    previousStatus: 'pending' | 'approved'
  }
}

export interface AdminPerson {
  userId: string
  email?: string
  name?: string
  page?: { slug: string; displayName: string }
  isYou: boolean
  /** Admin only through the server's allowlist, not a Clerk role. */
  viaAllowlist?: true
  /** A Clerk admin whose address is also on the allowlist. */
  allowlisted?: true
}

export interface PendingInvitation {
  invitationId: string
  email: string
  role?: 'admin' | 'moderator'
  /** Absent when Clerk did not say when it was sent. */
  createdAt?: string
}

export interface LogEntry {
  entryId: string
  at: string
  actorUserId: string
  actorName?: string
  action: string
  targetType: string
  targetId: string
  reason: string
  details?: Record<string, unknown>
}

export type InboxKind = 'page-submitted' | 'eam-request'
export type InboxStatus = 'open' | 'handled'

export interface InboxEntry {
  entryId: string
  kind: InboxKind
  status: InboxStatus
  subjectUserId: string
  page?: { slug: string; displayName: string; reviewStatus: string }
  note?: string
  createdAt: string
  handledAt?: string
  handledBy?: string
  /** An EaM request that still stops the member asking again. */
  blocksNewRequest?: boolean
}

export interface AdminSettings {
  votingInvite?: string
  anonymousMayVote: boolean
}

/** The member's "Request EaM" button. */
export interface EamStatus {
  mayRequest: boolean
  block?: 'needs-approved-page' | 'already-requested'
  requestedAt?: string
}

interface Paged {
  hasMore: boolean
}

const json = (body: unknown) => JSON.stringify(body)
const post = (body?: unknown) =>
  ({
    method: 'POST',
    ...(body === undefined ? {} : { body: json(body) }),
  }) as const
const id = (value: string) => encodeURIComponent(value)

export function fetchAdmins(token: string) {
  return memberRequest<{
    admins: Array<AdminPerson>
    complete: boolean
    /** The allowlist could not be read; its admins may be missing. */
    allowlistUnknown?: true
  }>('/admin/roles', { token })
}

export function promoteToAdmin(token: string, userId: string, reason: string) {
  return memberRequest<{ role: 'admin' }>(
    `/admin/roles/${id(userId)}/promote`,
    { token, ...post({ reason }) },
  )
}

export function removeAdminRole(token: string, userId: string, reason: string) {
  return memberRequest<{
    role: null
    /** Set when a follow-up (invitations, cached role) did not fully happen. */
    followUpWarning?: string
  }>(`/admin/roles/${id(userId)}/demote`, {
    token,
    ...post({ reason }),
  })
}

export function fetchInvitations(token: string) {
  return memberRequest<{
    invitations: Array<PendingInvitation>
    /** False when there were more than the server reads. */
    complete: boolean
  }>('/admin/invitations', { token })
}

/** An empty reason is sent as none. */
export function inviteByEmail(
  token: string,
  email: string,
  as: 'admin' | 'member',
  reason: string,
) {
  const trimmed = reason.trim()
  return memberRequest<PendingInvitation>('/admin/invitations', {
    token,
    ...post({
      email: email.trim(),
      as,
      ...(trimmed ? { reason: trimmed } : {}),
    }),
  })
}

export function revokeInvitation(token: string, invitationId: string) {
  return memberRequest<{ revoked: boolean }>(
    `/admin/invitations/${id(invitationId)}`,
    { token, method: 'DELETE' },
  )
}

export function fetchAdminMembers(
  token: string,
  filter: MemberFilter,
  query: string,
  page: number,
) {
  const params = new URLSearchParams({ status: filter, page: String(page) })
  if (query.trim()) params.set('q', query.trim())
  return memberRequest<{ members: Array<AdminMember> } & Paged>(
    `/admin/members?${params.toString()}`,
    { token },
  )
}

export type PageDecision = 'approve' | 'reject' | 'remove' | 'restore'

/** `approve` takes no reason; the other three need one. */
export function decideOnPage(
  token: string,
  slug: string,
  decision: PageDecision,
  reason?: string,
) {
  return memberRequest<{ reviewStatus: PageStatus }>(
    `/admin/members/${id(slug)}/${decision}`,
    { token, ...post(decision === 'approve' ? undefined : { reason }) },
  )
}

export function fetchModerationLog(token: string, page: number) {
  return memberRequest<{ entries: Array<LogEntry> } & Paged>(
    `/admin/log?page=${page}`,
    { token },
  )
}

export function fetchInbox(token: string, status: InboxStatus, page: number) {
  return memberRequest<{ entries: Array<InboxEntry> } & Paged>(
    `/admin/inbox?status=${status}&page=${page}`,
    { token },
  )
}

export function markInboxHandled(token: string, entryId: string) {
  return memberRequest<{ handled: boolean }>(
    `/admin/inbox/${id(entryId)}/handled`,
    { token, ...post() },
  )
}

export function resetEamRequest(token: string, entryId: string) {
  return memberRequest<{ reset: boolean }>(
    `/admin/inbox/${id(entryId)}/reset-eam`,
    { token, ...post() },
  )
}

export function fetchAdminSettings(token: string) {
  return memberRequest<AdminSettings>('/admin/settings', { token })
}

export function setAnonymousVoting(token: string, anonymousMayVote: boolean) {
  return memberRequest<{ anonymousMayVote: boolean }>(
    '/admin/settings/vote-eligibility',
    { token, method: 'PUT', body: json({ anonymousMayVote }) },
  )
}

/** An empty address clears the invite. */
export function setVotingInvite(token: string, inviteUrl: string) {
  return memberRequest<{ set: boolean }>('/admin/settings/voting-invite', {
    token,
    method: 'PUT',
    body: json({ inviteUrl: inviteUrl.trim() }),
  })
}

/** The ORG Voting invite as the server accepts it: a Telegram link. */
export function isVotingInvite(value: string) {
  return /^https:\/\/t\.me\/(?:\+|joinchat\/)?[A-Za-z0-9_-]+$/.test(
    value.trim(),
  )
}

export function fetchMyEamRequest(token: string) {
  return memberRequest<EamStatus>('/me/eam-request', { token })
}

export function requestEam(token: string, note: string) {
  const trimmed = note.trim()
  return memberRequest<EamStatus>('/me/eam-request', {
    token,
    ...post(trimmed ? { note: trimmed } : {}),
  })
}

/** A moment as the admin screens show it, e.g. "Nov 13, 2026, 10:00 AM" (UTC). */
export function adminTime(iso: string) {
  return new Date(iso).toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'UTC',
  })
}
