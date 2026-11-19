import { memberRequest } from './membership-api'
import type { ContactEntry } from './membership-api'

/** What the site calls a connection request (an admin setting, Chunk 18). */
export interface ConnectionTerms {
  singular: string
  plural: string
}

export const DEFAULT_TERMS: ConnectionTerms = {
  singular: 'connection request',
  plural: 'connection requests',
}

/** The optional note sent with a request. */
export const MAX_CONNECTION_NOTE_LENGTH = 500

/** Rows a member keeps for their connections only. */
export const MAX_CONNECTION_CONTACT_ROWS = 10

export type OpenTo = 'nobody' | 'public-members' | 'any-member'

/** The other member, as the server shows them to this one. */
export interface MemberCard {
  name: string
  /** Only when the reader may open the whole page. */
  slug?: string
}

export interface ConnectionsOverview {
  terms: ConnectionTerms
  me: {
    eligible: boolean
    visibility?: string
    openTo: OpenTo
    /** False while the default for the member's page applies. */
    openToChosen: boolean
    /** Rows shown to connections only, never on the page. */
    contacts: Array<ContactEntry>
    pendingSent: number
    maxPendingSent: number
  }
  incoming: Array<{
    id: string
    member: MemberCard
    note?: string
    sentAt: string
  }>
  outgoing: Array<{
    id: string
    member: MemberCard
    note?: string
    sentAt: string
    /** The member no longer has an approved page; it can still be withdrawn. */
    unavailable?: true
  }>
  connected: Array<{
    id: string
    member: MemberCard
    since: string
    contacts: Array<ContactEntry>
  }>
  blocked: Array<{ id: string; member: MemberCard; since: string }>
}

/** Why the profile button cannot send a request now. */
export type RelationReason =
  'not-eligible' | 'not-open' | 'private-needs-public' | 'cooldown' | 'limit'

/** Where the reader stands with a page's owner: the profile's button. */
export type Relation =
  | { state: 'self' }
  | { state: 'blocked'; blockId: string }
  | { state: 'outgoing' | 'incoming'; id: string }
  | { state: 'connected'; id: string; contacts: Array<ContactEntry> }
  | {
      state: 'none'
      canRequest: boolean
      reason?: RelationReason
      until?: string
    }

/** "A" or "an" before a name an admin chose. */
export function article(word: string) {
  return /^[aeiou]/i.test(word) ? 'an' : 'a'
}

/**
 * Default words about connection requests in the admins' name for them;
 * other text, or no name, as written.
 */
export function renamed(text: string, terms?: ConnectionTerms) {
  if (!terms) return text
  return text
    .replace(/connection requests/g, terms.plural)
    .replace(
      /\ba connection request\b/g,
      `${article(terms.singular)} ${terms.singular}`,
    )
    .replace(/connection request/g, terms.singular)
}

/** The first letter capitalised, for a name at the start of a sentence. */
export function capitalised(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

/** Needs no sign-in. */
export function fetchConnectionTerms() {
  return memberRequest<ConnectionTerms>('/connections/terms')
}

export function fetchConnections(token: string) {
  return memberRequest<ConnectionsOverview>('/me/connections', { token })
}

export function fetchRelation(token: string, slug: string) {
  return memberRequest<Relation>(
    `/me/connections/with/${encodeURIComponent(slug)}`,
    { token },
  )
}

/** An empty note is sent as none. */
export function sendConnectionRequest(
  token: string,
  slug: string,
  note: string,
) {
  const trimmed = note.trim()
  return memberRequest<{
    status: 'pending' | 'accepted'
    id: string
    crossed?: boolean
  }>('/me/connections', {
    method: 'POST',
    token,
    body: JSON.stringify({ slug, ...(trimmed ? { note: trimmed } : {}) }),
  })
}

export type ConnectionAction = 'accept' | 'decline' | 'withdraw' | 'disconnect'

export function answerConnection(
  token: string,
  id: string,
  action: ConnectionAction,
) {
  return memberRequest<{ status: string; id: string }>(
    `/me/connections/${encodeURIComponent(id)}/${action}`,
    { method: 'POST', token },
  )
}

/** Block a member by their page, or by a request between the two. */
export function blockMember(
  token: string,
  target: { slug: string } | { connectionId: string },
) {
  return memberRequest<{ blocked: true }>('/me/connections/blocks', {
    method: 'POST',
    token,
    body: JSON.stringify(target),
  })
}

export function unblockMember(token: string, blockId: string) {
  return memberRequest<{ blocked: false }>(
    `/me/connections/blocks/${encodeURIComponent(blockId)}`,
    { method: 'DELETE', token },
  )
}

export function saveConnectionSettings(
  token: string,
  change: { openTo?: OpenTo; contacts?: Array<ContactEntry> },
) {
  return memberRequest<{
    openTo: OpenTo
    openToChosen: boolean
    contacts: Array<ContactEntry>
  }>('/me/connections/settings', {
    method: 'PUT',
    token,
    body: JSON.stringify(change),
  })
}

/** Admins: rename the feature; both empty puts the default back. */
export function saveConnectionTerms(token: string, terms: ConnectionTerms) {
  return memberRequest<ConnectionTerms>('/admin/settings/connection-name', {
    method: 'PUT',
    token,
    body: JSON.stringify(terms),
  })
}
