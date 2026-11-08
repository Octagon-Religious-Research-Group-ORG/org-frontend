import type { ContactEntry, ProfileVisibility } from './membership-api'

/**
 * What survives a session lapse while someone writes their member page.
 *
 * Beliefs are sensitive, so the draft lives in this browser tab only
 * (sessionStorage: gone when the tab closes), expires, and is tied to the
 * account that wrote it. Admin-only backup contacts are never part of it,
 * and neither is the agreement to the terms.
 */
export interface JoinDraft {
  displayName: string
  slug: string
  slugEdited: boolean
  anonymous: boolean
  visibility: ProfileVisibility
  bio: string
  beliefs: Array<{ title: string; text: string }>
  contacts: ContactEntry[]
}

const DRAFT_KEY = 'org-members-join-draft'

/** A draft older than a day is dropped rather than shown again. */
export const DRAFT_MAX_AGE_MS = 24 * 60 * 60 * 1000

export function saveJoinDraft(owner: string | undefined, draft: JoinDraft) {
  try {
    sessionStorage.setItem(
      DRAFT_KEY,
      JSON.stringify({ owner, savedAt: Date.now(), draft }),
    )
  } catch {
    // Private windows may block storage; the form still works without a draft.
  }
}

/** The saved draft, only if it is this account's and recent enough. */
export function loadJoinDraft(
  owner: string | undefined,
): JoinDraft | undefined {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY)
    if (!raw) return undefined
    const saved = JSON.parse(raw) as {
      owner?: string
      savedAt: number
      draft: JoinDraft
    }
    if (
      saved.owner !== owner ||
      Date.now() - saved.savedAt > DRAFT_MAX_AGE_MS
    ) {
      clearJoinDraft()
      return undefined
    }
    return saved.draft
  } catch {
    return undefined
  }
}

export function clearJoinDraft() {
  try {
    sessionStorage.removeItem(DRAFT_KEY)
  } catch {
    // Nothing to clear if storage is unavailable.
  }
}
