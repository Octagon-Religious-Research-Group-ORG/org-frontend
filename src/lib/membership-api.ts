import { ApiError, apiRequest } from './api'

/** Who can see a member page, from widest to narrowest (backend enum). */
export const VISIBILITY_OPTIONS = [
  {
    value: 'public',
    label: 'Public',
    hint: 'Everyone, including guests and anyone you share your link with.',
  },
  {
    value: 'members',
    label: 'Members',
    hint: 'Every signed-in member, anonymous members included.',
  },
  {
    value: 'named-members',
    label: 'Named members only',
    hint: 'Only members who joined under their own name. Hidden from anonymous members and guests.',
  },
  {
    value: 'unlisted',
    label: 'Private (unlisted)',
    hint: 'Not listed in the Members Community at all. You still keep a full, timestamped record.',
  },
] as const

export type ProfileVisibility = (typeof VISIBILITY_OPTIONS)[number]['value']

export const CONTACT_METHODS = [
  { value: 'telegram', label: 'Telegram' },
  { value: 'signal', label: 'Signal' },
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Phone' },
  { value: 'other', label: 'Other' },
] as const

export type ContactMethod = (typeof CONTACT_METHODS)[number]['value']

export interface ContactEntry {
  method: ContactMethod
  value: string
}

export interface MembershipTerms {
  version: string
  hash: string
  items: Array<{ id: string; text: string }>
}

export interface MembershipSummary {
  /** `removed`: an admin took the page off the site (Chunk 12). */
  status: 'none' | 'pending' | 'approved' | 'removed'
  profile?: {
    slug: string
    displayName: string
    anonymous: boolean
    visibility: ProfileVisibility
  }
}

/** The server says only yes or no; the form explains the format itself. */
export interface SlugAvailability {
  available: boolean
}

export interface JoinMembershipInput {
  displayName: string
  slug: string
  anonymous: boolean
  visibility: ProfileVisibility
  bio: string
  beliefs: Array<{ title: string; text: string }>
  contacts: ContactEntry[]
  backupContacts: ContactEntry[]
  termsVersion: string
}

/**
 * How long a Members Community request may take. Long enough for the free test
 * server to wake from sleep (about 50 seconds).
 */
export const MEMBERSHIP_TIMEOUT_MS = 75_000

const SERVER_UNREACHABLE =
  "We couldn't reach the ORG server. Please check your connection and try again."
const SERVER_TROUBLE =
  'The ORG server is having trouble right now. Please try again in a minute.'
const TOO_MANY_TRIES =
  'That was a few too many tries. Please wait a minute and try again.'

/** The server's code for the per-account daily ration of address checks. */
export const ADDRESS_CHECK_DAILY_LIMIT = 'ADDRESS_CHECK_DAILY_LIMIT'

/** The server's code for the per-account daily ration of page changes. */
export const MEMBER_WRITE_DAILY_LIMIT = 'MEMBER_WRITE_DAILY_LIMIT'

/** The server's code for the per-account daily ration of claim requests. */
export const CLAIM_REQUEST_DAILY_LIMIT = 'CLAIM_REQUEST_DAILY_LIMIT'

const DAILY_CHECKS_USED =
  "You've used today's address checks, so we can't check this one ahead of time. You can still create your page: if the address is taken, we'll tell you when you submit, and you can pick another. Checks come back within 24 hours."

/**
 * Every Members Community call: answers within the time limit, and failures
 * in words a member can act on instead of "Failed to fetch" or a status code.
 * A refusal the server words itself (for example stale terms) passes through.
 */
export async function memberRequest<T>(
  path: string,
  options: Parameters<typeof apiRequest>[1] = {},
): Promise<T> {
  try {
    return await apiRequest<T>(path, {
      timeoutMs: MEMBERSHIP_TIMEOUT_MS,
      ...options,
    })
  } catch (err) {
    if (!(err instanceof ApiError)) throw new ApiError(SERVER_UNREACHABLE, 0)
    if (err.status === 429) {
      if (err.code === ADDRESS_CHECK_DAILY_LIMIT) {
        throw new ApiError(DAILY_CHECKS_USED, 429, err.code)
      }
      // The server's own words: this ration lasts a day, not a minute.
      if (
        err.code === MEMBER_WRITE_DAILY_LIMIT ||
        err.code === CLAIM_REQUEST_DAILY_LIMIT
      ) {
        throw err
      }
      throw new ApiError(TOO_MANY_TRIES, 429)
    }
    if (err.status >= 500) throw new ApiError(SERVER_TROUBLE, err.status)
    throw err
  }
}

export function fetchMembershipTerms() {
  return memberRequest<MembershipTerms>('/membership/terms')
}

export function fetchMyMembership(token: string) {
  return memberRequest<MembershipSummary>('/me/membership', { token })
}

/** Needs a login: a "no" says a page exists, hidden ones included. */
export function checkSlug(slug: string, token: string) {
  return memberRequest<SlugAvailability>(
    `/membership/slug-availability?slug=${encodeURIComponent(slug)}`,
    { token },
  )
}

export function recordGuestEntry() {
  return memberRequest<void>('/membership/guest-entry', { method: 'POST' })
}

export function joinMembership(token: string, input: JoinMembershipInput) {
  return memberRequest<MembershipSummary>('/me/membership', {
    method: 'POST',
    token,
    body: JSON.stringify(input),
  })
}

/** A page address suggested from a name: lowercase words joined by hyphens. */
export function suggestSlug(name: string) {
  return name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
}

const GUEST_KEY = 'org-members-guest'

/** Guest entry is remembered per browser so the choice sticks. */
export function isGuest() {
  try {
    return localStorage.getItem(GUEST_KEY) === '1'
  } catch {
    return false
  }
}

export function setGuest(value: boolean) {
  try {
    if (value) localStorage.setItem(GUEST_KEY, '1')
    else localStorage.removeItem(GUEST_KEY)
  } catch {
    // Private windows may block storage; guest entry then lasts this visit.
  }
}
