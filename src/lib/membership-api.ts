import { apiRequest } from './api'

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
  status: 'none' | 'pending' | 'approved'
  profile?: {
    slug: string
    displayName: string
    anonymous: boolean
    visibility: ProfileVisibility
  }
}

export type SlugAvailability =
  | { available: true }
  | { available: false; reason: 'format' | 'reserved' | 'taken' }

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

export function fetchMembershipTerms() {
  return apiRequest<MembershipTerms>('/membership/terms')
}

export function fetchMyMembership(token: string) {
  return apiRequest<MembershipSummary>('/me/membership', { token })
}

export function checkSlug(slug: string) {
  return apiRequest<SlugAvailability>(
    `/membership/slug-availability?slug=${encodeURIComponent(slug)}`,
  )
}

export function recordGuestEntry() {
  return apiRequest<void>('/membership/guest-entry', { method: 'POST' })
}

export function joinMembership(token: string, input: JoinMembershipInput) {
  return apiRequest<MembershipSummary>('/me/membership', {
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
