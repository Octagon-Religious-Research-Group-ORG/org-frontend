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
  manage?: {
    visibility: ProfileVisibility
    reviewStatus: string
    source?: 'migrated' | 'native'
  }
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

export function uploadProfilePicture(token: string, picture: File) {
  const body = new FormData()
  body.append('picture', picture)
  return memberRequest<{ hasPicture: boolean }>('/me/member-page/picture', {
    method: 'PUT',
    token,
    body,
  })
}
