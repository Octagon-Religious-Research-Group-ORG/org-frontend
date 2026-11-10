import { notFound } from '@tanstack/react-router'
import { API_BASE_URL, ApiError } from './api'
import { memberRequest } from './membership-api'
import type { ContactEntry, ProfileVisibility } from './membership-api'

export interface ParagraphView {
  blockId: string
  kind: 'heading' | 'paragraph' | 'outline-item' | 'image'
  label: string
  text: string
}

export interface BeliefTab {
  tabId: string
  title: string
  group?: string
  needsReview: boolean
  paragraphs: Array<ParagraphView>
}

export interface ExtraSection {
  section: 'considering' | 'texts' | 'other'
  paragraphs: Array<ParagraphView>
}

export interface NameOnlyProfile {
  access: 'name-only'
  slug: string
  displayName: string
  isOwner: false
  hasPicture: false
  picturePublic: false
}

export interface FullProfile {
  access: 'full'
  slug: string
  displayName: string
  isOwner: boolean
  hasPicture: boolean
  picturePublic: boolean
  pictureVersion?: string
  contacts: Array<ContactEntry>
  bio: Array<ParagraphView>
  extras: Array<ExtraSection>
  tabs: Array<BeliefTab>
  /** Owner only: the newest version of each field, what an edit starts from. */
  revisions?: Revisions
  manage?: {
    visibility: ProfileVisibility
    reviewStatus: string
    source?: 'migrated' | 'native'
    /** Older servers did not send it. */
    removedTabs?: Array<RemovedTab>
  }
}

export interface Revisions {
  bio: number
  tabs: Partial<Record<string, { text: number; title: number }>>
}

export interface RemovedTab {
  tabId: string
  title: string
  removedAt: string
}

export interface HistoryEntry {
  seq: number
  savedAt: string
  text: string
  hash: string
  source: 'member' | 'imported' | 'title-before-history'
  /** The text as kept before its first edit here, one record per paragraph. */
  beforeFirstEdit: boolean
  /** The start of each paragraph's hash, in reading order, for that entry. */
  partHashes?: Array<string>
}

/** Lone UTF-16 surrogates, which the server stores as U+FFFD. */
const LONE_SURROGATE = /\p{Cs}/gu
const STRIPPED_CONTROLS =
  // eslint-disable-next-line no-control-regex -- matching them is the point
  /[\u0000-\u0008\u000e-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g
const ODD_LINE_BREAKS = /[\v\f\u2028\u2029]/g
const INVISIBLE = /[\p{C}\p{Z}\p{M}\p{Default_Ignorable_Code_Point}\u2800]/gu

/**
 * Member text as the server stores it (kept in step with the backend's
 * `normaliseFieldText` and `member-text.ts`): lone surrogates become U+FFFD,
 * control characters and bidirectional overrides are removed, paragraphs are
 * split on blank lines, trimmed, emptied ones dropped, and joined by exactly
 * one blank line. The editor counts and compares this, so its count and its
 * "nothing changed" agree with the server's.
 */
export function normaliseMemberText(raw: string) {
  return raw
    .replace(LONE_SURROGATE, '\uFFFD')
    .replace(STRIPPED_CONTROLS, '')
    .replace(ODD_LINE_BREAKS, '\n')
    .split(/\r?\n\s*\r?\n/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph.replace(INVISIBLE, '') !== '')
    .join('\n\n')
}

/** Most characters one saved version holds (the server's limit). */
export const MAX_SAVED_TEXT = 20_000

export const BELIEF_TOO_LONG =
  'This belief is longer than one save can hold (20,000 characters). Please move part of it into a new belief tab.'
export const BIO_TOO_LONG =
  'Your bio is longer than one save can hold (20,000 characters). Please shorten it.'

export interface HistoryPage {
  entries: Array<HistoryEntry>
  page: number
  hasMore: boolean
}

/** Which history to read: the bio, or one belief's text or title. */
export type HistoryTarget =
  { kind: 'bio' } | { kind: 'tab'; tabId: string; field: 'text' | 'title' }

export interface SaveResult {
  changed: boolean
  seq: number
}

export type MemberProfile = NameOnlyProfile | FullProfile

export interface DirectoryCard {
  slug: string
  displayName: string
  access: 'full' | 'name-only'
  hasPicture: boolean
  picturePublic: boolean
}

export interface MemberDirectory {
  members: Array<DirectoryCard>
  hasMore: boolean
}

export type ChatsView =
  | { voting: 'hidden' }
  | { voting: 'ask-tripp' }
  | { voting: 'invite'; inviteUrl: string }

/** A server render waits this long, then the browser takes over. */
export const SERVER_RENDER_TIMEOUT_MS = 8_000

/** Keep in step with the backend's upload limit. */
export const MAX_PICTURE_BYTES = 10 * 1024 * 1024

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export function isMemberSlug(slug: string) {
  return slug.length >= 2 && slug.length <= 80 && SLUG.test(slug.toLowerCase())
}

/** @param version - changes when the picture does, so a browser asks again */
export function pictureUrl(slug: string, version?: string) {
  const url = `${API_BASE_URL}/members/profiles/${encodeURIComponent(slug)}/picture`
  return version ? `${url}?v=${encodeURIComponent(version)}` : url
}

export function fetchMemberDirectory(token?: string) {
  return memberRequest<MemberDirectory>('/members/directory', { token })
}

export function fetchMemberChats(token?: string) {
  return memberRequest<ChatsView>('/members/chats', { token })
}

export function fetchMemberProfile(
  slug: string,
  options: { token?: string; timeoutMs?: number } = {},
) {
  return memberRequest<MemberProfile>(
    `/members/profiles/${encodeURIComponent(slug.toLowerCase())}`,
    options,
  )
}

/**
 * Loads a page for the server render, as a logged-out visitor: only what a
 * guest may see can ever end up in the HTML or in loader data. A page that
 * cannot be seen or does not exist is a real 404; the browser retries with the
 * visitor's token. A slow or sleeping server leaves the page to the browser.
 */
export async function loadMemberPage(
  slug: string,
): Promise<{ profile?: MemberProfile }> {
  if (!isMemberSlug(slug)) throw notFound()
  try {
    return {
      profile: await fetchMemberProfile(slug, {
        timeoutMs: SERVER_RENDER_TIMEOUT_MS,
      }),
    }
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) throw notFound()
    return {}
  }
}

/** A restricted picture needs the token, so it cannot be a plain image URL. */
export async function fetchPictureObjectUrl(slug: string, token: string) {
  const response = await fetch(pictureUrl(slug), {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!response.ok) throw new ApiError('Picture unavailable.', response.status)
  return URL.createObjectURL(await response.blob())
}

export function changeVisibility(token: string, visibility: ProfileVisibility) {
  return memberRequest<{ visibility: ProfileVisibility }>(
    '/me/member-page/visibility',
    { method: 'PATCH', token, body: JSON.stringify({ visibility }) },
  )
}

export function addBeliefTab(
  token: string,
  belief: { title: string; text: string },
) {
  return memberRequest<{ tabId: string; title: string }>(
    '/me/member-page/tabs',
    { method: 'POST', token, body: JSON.stringify(belief) },
  )
}

/**
 * The text an editor starts from: paragraphs separated by a blank line, an
 * imported outline label kept in front. The server compares the same way, so
 * saving it unchanged writes no version.
 */
export function editorText(paragraphs: Array<ParagraphView>) {
  return paragraphs
    .map((paragraph) =>
      paragraph.label ? `${paragraph.label} ${paragraph.text}` : paragraph.text,
    )
    .join('\n\n')
}

const tabPath = (tabId: string) =>
  `/me/member-page/tabs/${encodeURIComponent(tabId)}`

export function editBio(token: string, text: string, baseSeq: number) {
  return memberRequest<SaveResult>('/me/member-page/bio', {
    method: 'PUT',
    token,
    body: JSON.stringify({ text, baseSeq }),
  })
}

export function editBeliefText(
  token: string,
  tabId: string,
  text: string,
  baseSeq: number,
) {
  return memberRequest<SaveResult>(`${tabPath(tabId)}/text`, {
    method: 'PUT',
    token,
    body: JSON.stringify({ text, baseSeq }),
  })
}

export function editBeliefTitle(
  token: string,
  tabId: string,
  title: string,
  baseSeq: number,
) {
  return memberRequest<SaveResult>(`${tabPath(tabId)}/title`, {
    method: 'PUT',
    token,
    body: JSON.stringify({ title, baseSeq }),
  })
}

export function moveBelief(
  token: string,
  tabId: string,
  direction: 'up' | 'down',
) {
  return memberRequest<{ moved: boolean }>(`${tabPath(tabId)}/position`, {
    method: 'PATCH',
    token,
    body: JSON.stringify({ direction }),
  })
}

export function removeBelief(token: string, tabId: string) {
  return memberRequest<{ removed: boolean }>(tabPath(tabId), {
    method: 'DELETE',
    token,
  })
}

/** Readable by whoever can read that part of the page; a token when signed in. */
export function fetchHistory(
  slug: string,
  target: HistoryTarget,
  options: { page?: number; token?: string } = {},
) {
  const base = `/members/profiles/${encodeURIComponent(slug.toLowerCase())}`
  const query = new URLSearchParams({ page: String(options.page ?? 1) })
  let path = `${base}/bio/history`
  if (target.kind === 'tab') {
    query.set('field', target.field)
    path = `${base}/tabs/${encodeURIComponent(target.tabId)}/history`
  }
  return memberRequest<HistoryPage>(`${path}?${query.toString()}`, {
    token: options.token,
  })
}

export function uploadProfilePicture(token: string, picture: File) {
  const body = new FormData()
  body.append('picture', picture)
  return memberRequest<{ hasPicture: boolean }>('/me/member-page/picture', {
    method: 'PUT',
    token,
    body,
  })
}
