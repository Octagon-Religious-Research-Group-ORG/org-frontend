import { API_BASE_URL, ApiError } from './api'
import { memberRequest } from './membership-api'

/** What a receipt is for: a belief's text or title, or a comment. */
export type ReceiptTarget =
  | { kind: 'belief'; slug: string; tabId: string; field?: 'text' | 'title' }
  | { kind: 'comment'; slug: string; commentId: string }
  /** A comment on one of ORG's own pages (Chunk 10b). */
  | { kind: 'org-comment'; pageId: string; commentId: string }

export type CheckOutcome = 'pass' | 'fail' | 'cannot-measure'

export interface Check {
  outcome: CheckOutcome
  detail: string
}

/** One version in a receipt, as far as the page shows it. */
export interface ReceiptVersion {
  seq: number
  serverTime: string
  versionHash: string
  imported?: string
  outlineLabel?: string
  anchor:
    | { state: 'pending'; message: string }
    | {
        state: 'anchored'
        anchorId: string
        root: string
        freetsa: { status: string; genTime?: string }
        opentimestamps: { status: string; bitcoinHeights: Array<number> }
        serverChecks: Record<'hash' | 'path' | 'tsa' | 'ots', Check>
      }
}

export interface Receipt {
  format: string
  generatedAt: string
  notice: Array<string>
  versions: Array<ReceiptVersion>
}

const segment = (value: string) => encodeURIComponent(value)

/** The receipt's path on the server, without `/download`. */
export function receiptPath(target: ReceiptTarget) {
  if (target.kind === 'org-comment') {
    return `/members/org-pages/${segment(target.pageId)}/comments/${segment(target.commentId)}/receipt`
  }
  const page = `/members/profiles/${segment(target.slug.toLowerCase())}`
  if (target.kind === 'comment') {
    return `${page}/comments/${segment(target.commentId)}/receipt`
  }
  const field = target.field ?? 'text'
  return `${page}/tabs/${segment(target.tabId)}/receipt${field === 'text' ? '' : '?field=title'}`
}

function withDownload(path: string) {
  const [base, query] = path.split('?')
  return `${base}/download${query ? `?${query}` : ''}`
}

/** The receipt (JSON), readable by whoever can read that part of the page. */
export function fetchReceipt(target: ReceiptTarget, token?: string) {
  return memberRequest<Receipt>(receiptPath(target), { token })
}

/** The file name the server gave, or a plain one. */
export function fileNameOf(disposition: string | null) {
  return /filename="([^"]+)"/.exec(disposition ?? '')?.[1] ?? 'receipt.zip'
}

/**
 * Downloads the receipt as a zip: the browser saves it, nothing is kept
 * here. The same access as the JSON; a refusal says why.
 *
 * @returns the saved file's name
 */
export async function downloadReceipt(
  target: ReceiptTarget,
  token?: string,
): Promise<string> {
  let response: Response
  try {
    response = await fetch(
      `${API_BASE_URL}${withDownload(receiptPath(target))}`,
      {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      },
    )
  } catch {
    throw new ApiError("We couldn't reach ORG's server. Please try again.", 0)
  }
  if (!response.ok) {
    let message = `The receipt could not be downloaded (status ${response.status}).`
    try {
      const payload = (await response.json()) as { message?: unknown }
      if (typeof payload.message === 'string') message = payload.message
    } catch {
      // Keep the status message.
    }
    throw new ApiError(message, response.status)
  }
  const name = fileNameOf(response.headers.get('Content-Disposition'))
  const url = URL.createObjectURL(await response.blob())
  const link = document.createElement('a')
  link.href = url
  link.download = name
  document.body.append(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
  return name
}

/** One anchor as the admin dashboard lists it (Chunk 16). */
export interface AnchorRow {
  anchorId: string
  status: 'building' | 'built' | 'empty'
  builtAt?: string
  leaves: number
  merkleRoot?: string
  tsa: {
    status?: string
    attempts: number
    genTime?: string
    nextAttemptAt?: string
    lastError?: string
  }
  ots: {
    status?: string
    attempts: number
    calendars: Array<{ url: string; ok: boolean; error?: string }>
    bitcoinHeights: Array<number>
    lastUpgradeAt?: string
    nextAttemptAt?: string
    lastError?: string
  }
  verify: Record<'root' | 'versions' | 'tsa' | 'ots' | 'bitcoin', Check>
}

export interface AnchorsView {
  enabled: boolean
  checkedAt: string
  coverage: Check
  totals: Record<
    'root' | 'versions' | 'tsa' | 'ots' | 'bitcoin',
    Record<CheckOutcome, number>
  >
  anchors: Array<AnchorRow>
}

export interface AnchorRunReport {
  build: { state: string; anchorId?: string; leaves?: number }
  tsa: Array<{ anchorId: string; outcome: string }>
  ots: Array<{ anchorId: string; outcome: string }>
}

export function fetchAnchors(token: string) {
  return memberRequest<AnchorsView>('/admin/anchors', { token })
}

export function runAnchorsNow(token: string) {
  return memberRequest<AnchorRunReport>('/admin/anchors/run', {
    token,
    method: 'POST',
  })
}
