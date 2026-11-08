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

/** How often an open tab checks for a draft past its age. */
export const DRAFT_SWEEP_INTERVAL_MS = 60 * 60 * 1000

interface StoredDraft {
  owner?: string
  savedAt: number
  draft: JoinDraft
}

/** A draft that can no longer be shown: malformed, or outside its age. */
function isUsable(saved: Partial<StoredDraft>): saved is StoredDraft {
  const age = Date.now() - (saved.savedAt ?? Number.NaN)
  return (
    age >= 0 && age <= DRAFT_MAX_AGE_MS && Array.isArray(saved.draft?.beliefs)
  )
}

function readStored(): Partial<StoredDraft> | undefined {
  const raw = sessionStorage.getItem(DRAFT_KEY)
  return raw ? (JSON.parse(raw) as Partial<StoredDraft>) : undefined
}

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
    const saved = readStored()
    if (!saved) return undefined
    if (saved.owner === owner && isUsable(saved)) return saved.draft
    clearJoinDraft()
    return undefined
  } catch {
    clearJoinDraft()
    return undefined
  }
}

/**
 * Drops a draft past its age even if nothing reads it: a tab can sit open for
 * days after a session lapses, and the expiry must not depend on the form.
 */
export function sweepExpiredJoinDraft() {
  try {
    const saved = readStored()
    if (saved && !isUsable(saved)) clearJoinDraft()
  } catch {
    clearJoinDraft()
  }
}

export function clearJoinDraft() {
  try {
    sessionStorage.removeItem(DRAFT_KEY)
  } catch {
    // Nothing to clear if storage is unavailable.
  }
}
