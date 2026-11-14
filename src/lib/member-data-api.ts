import { API_BASE_URL, ApiError } from './api'
import { memberRequest } from './membership-api'

/** The member's own page, as "Your data" shows it (Chunk 17). */
export type MyPageStatus =
  | { slug: string; displayName: string; deleted: false }
  | {
      slug: string
      displayName: string
      deleted: true
      deletedAt: string
      source: 'member' | 'account-deleted'
      /** Present while the member can still bring it back themselves. */
      undoUntil?: string
      purgeAfter: string
    }

export interface MyDataStatus {
  page: MyPageStatus | null
  /** The delete dialog's wording, from the server. */
  disclosure: Array<string>
}

/** A deleted page in the admin view. */
export interface DeletedPage {
  slug: string
  displayName: string
  source: 'member' | 'account-deleted'
  deletedAt: string
  undoUntil?: string
  purgeAfter: string
  purgedAt?: string
  /** The owner's Clerk account was deleted: a restore brings back a page no one can sign in to. */
  ownerAccountGone: boolean
}

/** What the five-year purge would remove now (a dry run). */
export interface PurgeDue {
  pages: Array<{
    slug: string
    displayName: string
    source: 'member' | 'account-deleted'
    deletedAt: string
    purgeAfter: string
  }>
  /** Deleted accounts due for the person-wide purge (Chunk 17 review #6). */
  accounts: Array<{ deletedAt: string; purgeAfter: string; hadPage: boolean }>
  hasMore: boolean
  visitAddresses: number
  retentionYears: number
}

export function fetchMyData(token: string) {
  return memberRequest<MyDataStatus>('/me/data', { token })
}

export function deleteMyPage(token: string, confirm: string) {
  return memberRequest<{
    deleted: true
    undoUntil: string
    purgeAfter: string
  }>('/me/data/delete-page', {
    token,
    method: 'POST',
    body: JSON.stringify({ confirm }),
  })
}

export function undoPageDeletion(token: string) {
  return memberRequest<{ deleted: false }>('/me/data/undo-delete', {
    token,
    method: 'POST',
  })
}

export function fetchDeletedPages(token: string, page: number) {
  return memberRequest<{ pages: Array<DeletedPage>; hasMore: boolean }>(
    `/admin/deleted-pages?page=${page}`,
    { token },
  )
}

export function fetchPurgeDue(token: string) {
  return memberRequest<PurgeDue>('/admin/deleted-pages/purge-due', { token })
}

export function restoreDeletedPage(
  token: string,
  slug: string,
  reason: string,
) {
  return memberRequest<{ restored: true }>(
    `/admin/deleted-pages/${encodeURIComponent(slug)}/restore`,
    { token, method: 'POST', body: JSON.stringify({ reason }) },
  )
}

/**
 * "Download my data": the browser saves the zip, nothing is kept here.
 *
 * @returns the saved file's name
 */
export async function downloadMyData(token: string): Promise<string> {
  let response: Response
  try {
    response = await fetch(`${API_BASE_URL}/me/data/export`, {
      headers: { Authorization: `Bearer ${token}` },
    })
  } catch {
    throw new ApiError("We couldn't reach ORG's server. Please try again.", 0)
  }
  if (!response.ok) {
    let message = `Your data could not be downloaded (status ${response.status}).`
    try {
      const payload = (await response.json()) as { message?: unknown }
      if (typeof payload.message === 'string') message = payload.message
    } catch {
      // Keep the status message.
    }
    throw new ApiError(message, response.status)
  }
  const name =
    /filename="([^"]+)"/.exec(
      response.headers.get('Content-Disposition') ?? '',
    )?.[1] ?? 'org-my-data.zip'
  const url = URL.createObjectURL(await response.blob())
  const link = document.createElement('a')
  link.href = url
  link.download = name
  document.body.append(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
  return name
}

/** A date the way a member reads it: "14 December 2026". */
export function longDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })
}
