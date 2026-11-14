import { useEffect, useState } from 'react'
import { useOrgAuth } from '#/lib/auth'
import { downloadReceipt, fetchReceipt, receiptPath } from '#/lib/receipts-api'
import type { Receipt, ReceiptTarget, ReceiptVersion } from '#/lib/receipts-api'
import { buttonStyle, primaryStyle } from './editor-styles'

const SESSION_UNCONFIRMED =
  "We couldn't confirm that you're signed in. Please try again."

/** What a receipt proves, and what it does not, in plain words (plan §6). */
export const RECEIPT_EXPLAINED = [
  "A receipt is a file you can keep. It holds this version's fingerprint (hash) and two independent time-stamps of it: FreeTSA (an RFC 3161 time-stamp) and OpenTimestamps (anchored in the Bitcoin blockchain).",
  'It does not show who wrote the text, that it is true, or that it was not written earlier somewhere else. FreeTSA is not an EU "qualified" time-stamp authority, and this is not legal advice.',
  'Beliefs imported from Apple Pages are dated when they were imported here; a receipt never claims an earlier date.',
]

/** The author's (or an admin's) receipt: every step can be recomputed. */
export const COMPLETE_RECEIPT =
  'This receipt is complete: it shows that this exact text existed no later than those time-stamps, and anyone can check every step with free public tools; the steps are inside the file.'

/** The same while anchoring is pending (review round 2, L-d). */
export const COMPLETE_PENDING_RECEIPT =
  'This receipt is complete for the text and its fingerprint, but it has no time-stamp yet: until one arrives (normally within a day of the daily anchor) it proves nothing about when the text existed. Download it again after that.'

/** Anyone else's (review M3, round 2 M-A): the hash material is held back. */
export const PARTIAL_RECEIPT =
  "This receipt proves only that this version's sealed fingerprint (its leaf in the anchor) existed no later than those time-stamps; anyone can check that part with free public tools. It cannot show by itself that the text is the text behind that fingerprint: that can be checked only with the author's complete receipt, which only the author or an ORG admin can download."

/** The leaf-only receipt while anchoring is pending (review round 4, LOW-2). */
export const PARTIAL_PENDING_RECEIPT =
  "This receipt has no time-stamp yet: until one arrives (normally within a day of the daily anchor) it proves nothing about when this version existed. Download it again after that. Even then it will prove only that this version's sealed fingerprint existed by that time; that the text is the text behind it can be checked only with the author's complete receipt, which only the author or an ORG admin can download."

/** The same while anchoring is pending (review round 3, L-4). */
export const HASHES_PENDING_RECEIPT =
  "This receipt holds this version's fingerprint (hash), but it has no time-stamp yet: until one arrives (normally within a day of the daily anchor) it proves nothing about when the version existed. Download it again after that. The step from the text to the fingerprint needs the author's complete receipt."

/** A reader allowed to know the author (round 3): hashes, no account id. */
export const HASHES_RECEIPT =
  "This receipt proves that this version's fingerprint (hash) existed no later than those time-stamps; anyone can check every step from that fingerprint on with free public tools. The step from the text to the fingerprint needs the author's complete receipt, because the fingerprint also covers the author's account id, which only the author and ORG admins receive."

type Stamps = 'both' | 'freetsa' | 'opentimestamps'

/**
 * The stamps one version holds that give a time: an OpenTimestamps proof
 * counts only once confirmed in Bitcoin (review round 8, LOW-1).
 */
function versionStamps(version: ReceiptVersion): Stamps | undefined {
  if (version.anchor.state !== 'anchored') return undefined
  // A stamp counts only when its own server check did not fail (round 9).
  const checks = version.anchor.serverChecks
  const tsa =
    version.anchor.freetsa.responseBase64 !== undefined &&
    checks.tsa.outcome !== 'fail'
  const ots =
    version.anchor.opentimestamps.proofBase64 !== undefined &&
    version.anchor.opentimestamps.bitcoinHeights.length > 0 &&
    checks.ots.outcome !== 'fail'
  if (tsa && ots) return 'both'
  if (tsa) return 'freetsa'
  return ots ? 'opentimestamps' : undefined
}

/**
 * Stamped only when EVERY version holds at least one stamp that gives a
 * time; `mixed` when their kinds differ (review round 8, LOW-2).
 */
function stampsOf(
  versions: ReadonlyArray<ReceiptVersion>,
): Stamps | 'mixed' | undefined {
  const each = versions.map(versionStamps)
  if (each.some((stamps) => stamps === undefined)) return undefined
  return new Set(each).size === 1 ? each[0] : 'mixed'
}

/** Names the stamps when not both are in (review rounds 7 and 8). */
export const ONE_STAMP = {
  freetsa:
    'Only the FreeTSA time-stamp gives a time so far; the OpenTimestamps proof is not confirmed in Bitcoin yet.',
  opentimestamps:
    'Only the OpenTimestamps proof, confirmed in Bitcoin, gives a time so far; the FreeTSA time-stamp is not in yet.',
  mixed: 'Some versions hold only one of the two time-stamps.',
}

/**
 * When this server's own check of a version's hash or path failed (review
 * round 9, L2): said plainly, whatever the reader's tier.
 */
export const UNCONFIRMED_RECEIPT =
  "This receipt could not be confirmed: this server's own check of the version's fingerprint, or of its place in the anchor, failed. It proves nothing about when the text existed; do not rely on it, and tell an ORG admin."

/** Said when a version's only proof cannot give a time yet (round 8). */
export const UNCONFIRMED_OTS =
  'An OpenTimestamps proof is in but not yet confirmed in a Bitcoin block, so it gives no time yet.'

/**
 * The receipt's wording: pending unless every version is anchored AND holds
 * a stamp; one stamp only is named (review round 7, LOW-3).
 */
function noticeOf(versions: ReadonlyArray<ReceiptVersion>): string {
  const failed = versions.some(
    (version) =>
      version.anchor.state === 'anchored' &&
      (version.anchor.serverChecks.hash.outcome === 'fail' ||
        version.anchor.serverChecks.path.outcome === 'fail'),
  )
  if (failed) return UNCONFIRMED_RECEIPT
  const stamps = stampsOf(versions)
  // Only a proof whose check did not fail is "in" (review round 10, LOW-1).
  const unconfirmed = versions.some(
    (version) =>
      version.anchor.state === 'anchored' &&
      versionStamps(version) === undefined &&
      version.anchor.opentimestamps.proofBase64 !== undefined &&
      version.anchor.serverChecks.ots.outcome !== 'fail',
  )
  const partial = versions.some(
    (version) => !version.hashInput.included && version.disclosure !== 'hashes',
  )
  const hashes = versions.some((version) => version.disclosure === 'hashes')
  if (!stamps) {
    const pending = partial
      ? PARTIAL_PENDING_RECEIPT
      : hashes
        ? HASHES_PENDING_RECEIPT
        : COMPLETE_PENDING_RECEIPT
    return unconfirmed ? `${pending} ${UNCONFIRMED_OTS}` : pending
  }
  const text = partial
    ? PARTIAL_RECEIPT
    : hashes
      ? HASHES_RECEIPT
      : COMPLETE_RECEIPT
  return stamps === 'both' ? text : `${text} ${ONE_STAMP[stamps]}`
}

const CHECK_NAMES = {
  hash: 'Fingerprint check',
  path: 'Path check',
  tsa: 'FreeTSA check',
  ots: 'OpenTimestamps check',
} as const

export const ANCHORING_PENDING =
  'Anchoring pending: ORG time-stamps new versions once a day. The receipt already holds the text and its fingerprint; download it again after the next daily anchor to get both time-stamps.'

function day(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    dateStyle: 'medium',
    timeZone: 'UTC',
  })
}

function freetsaLine(status: string, genTime?: string) {
  if (status === 'granted' && genTime) {
    return `FreeTSA: time-stamped ${new Date(genTime).toLocaleString('en-US', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: 'UTC',
    })} UTC.`
  }
  return 'FreeTSA: not received yet; it is tried again automatically.'
}

function otsLine(status: string, heights: Array<number>) {
  if (status === 'confirmed') {
    return `OpenTimestamps: confirmed in Bitcoin block ${heights.join(', ')}.`
  }
  if (status === 'pending') {
    return 'OpenTimestamps: waiting for Bitcoin (usually a few hours); the downloaded proof can be completed later with the ots client.'
  }
  return 'OpenTimestamps: not received yet; it is tried again automatically.'
}

/** Every server check that did not pass, as a plain warning (review M2). */
function warnings(version: ReceiptVersion) {
  if (version.anchor.state !== 'anchored') return []
  const checks = version.anchor.serverChecks
  return (Object.keys(CHECK_NAMES) as Array<keyof typeof CHECK_NAMES>)
    .filter((name) => checks[name].outcome !== 'pass')
    .map(
      (name) =>
        `${CHECK_NAMES[name]}: ${
          checks[name].outcome === 'fail' ? 'FAILED' : 'could not be checked'
        } (${checks[name].detail}).`,
    )
}

function VersionStatus({ version }: { version: ReceiptVersion }) {
  const { anchor } = version
  const confirmed =
    anchor.state === 'anchored' &&
    anchor.serverChecks.hash.outcome === 'pass' &&
    anchor.serverChecks.path.outcome === 'pass'
  return (
    <li className="text-xs leading-5 text-[#b8ad8d]">
      {version.outlineLabel && (
        <span className="font-mono text-[#78aea2]">
          {version.outlineLabel}{' '}
        </span>
      )}
      {version.imported && (
        <span className="text-[#f1d78a]">
          {version.imported.charAt(0).toUpperCase() + version.imported.slice(1)}
          .{' '}
        </span>
      )}
      {anchor.state === 'anchored' && !confirmed && (
        <span className="text-[#f1a07a]">
          ORG’s server could not confirm that this version is in the anchor of{' '}
          {day(`${anchor.anchorId}T00:00:00Z`)}.{' '}
        </span>
      )}
      {anchor.state === 'anchored' ? (
        <>
          {confirmed && (
            <>Anchored on {day(`${anchor.anchorId}T00:00:00Z`)}. </>
          )}
          {/* A provider whose check failed is shown only as the warning. */}
          {anchor.serverChecks.tsa.outcome !== 'fail' && (
            <>{freetsaLine(anchor.freetsa.status, anchor.freetsa.genTime)} </>
          )}
          {anchor.serverChecks.ots.outcome !== 'fail' &&
            otsLine(
              anchor.opentimestamps.status,
              anchor.opentimestamps.bitcoinHeights,
            )}
        </>
      ) : (
        <span className="text-[#f1d78a]">{ANCHORING_PENDING}</span>
      )}
      {warnings(version).map((line) => (
        <span key={line} className="block text-[#f1a07a]">
          {line}
        </span>
      ))}
    </li>
  )
}

/**
 * The receipt of one belief or comment version (Chunk 16): what it proves,
 * whether it is anchored yet, and the download. The server decides who may
 * have one, exactly as for reading that history.
 */
export function ReceiptPanel({
  target,
  label,
  onClose,
}: {
  target: ReceiptTarget
  /** What the receipt is for, e.g. a belief's title or "comment 2". */
  label: string
  onClose: () => void
}) {
  const auth = useOrgAuth()
  const [receipt, setReceipt] = useState<Receipt>()
  const [problem, setProblem] = useState<string>()
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState<string>()

  const token = async () => {
    const value = auth.isAuthenticated ? await auth.getToken() : undefined
    if (auth.isAuthenticated && !value) throw new Error(SESSION_UNCONFIRMED)
    return value
  }

  // The target is rebuilt every render; its path says when it changed.
  const key = receiptPath(target)
  // The sign-in values, not the auth object, so a new object with the same
  // state asks nothing again (review L6).
  const { isLoading, isAuthenticated, getToken } = auth
  useEffect(() => {
    // Another version: nothing of the last one stays on screen.
    setReceipt(undefined)
    setProblem(undefined)
    setSaved(undefined)
    if (isLoading) return
    const closed = new AbortController()
    void (async () => {
      try {
        const result = await fetchReceipt(target, await token())
        if (!closed.signal.aborted) setReceipt(result)
      } catch (err) {
        if (!closed.signal.aborted) {
          setProblem(
            err instanceof Error ? err.message : 'No receipt is available.',
          )
        }
      }
    })()
    return () => closed.abort()
  }, [isLoading, isAuthenticated, getToken, key])

  const download = async () => {
    setSaving(true)
    setProblem(undefined)
    try {
      setSaved(await downloadReceipt(target, await token()))
    } catch (err) {
      setProblem(
        err instanceof Error ? err.message : 'The receipt did not download.',
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <section
      aria-label={`Receipt for ${label}`}
      className="mt-4 border border-[rgba(236,226,196,0.16)] bg-[rgba(11,13,18,0.85)] p-4"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h4 className="text-sm uppercase tracking-[0.14em] text-[#ece2c4] [overflow-wrap:anywhere]">
          Receipt for {label}
        </h4>
        <button type="button" onClick={onClose} className={buttonStyle}>
          Close receipt
        </button>
      </div>
      {RECEIPT_EXPLAINED.map((line) => (
        <p key={line} className="mt-2 text-xs leading-5 text-[#9f9676]">
          {line}
        </p>
      ))}
      {!receipt && !problem && (
        <p role="status" className="mt-3 text-sm text-[#b8ad8d]">
          Checking the anchoring…
        </p>
      )}
      {receipt && (
        <>
          <p className="mt-2 text-xs leading-5 text-[#d8ceb0]">
            {noticeOf(receipt.versions)}
          </p>
          <ul className="mt-3 flex flex-col gap-2">
            {receipt.versions.map((version) => (
              <VersionStatus
                key={`${version.seq}-${version.serverTime}`}
                version={version}
              />
            ))}
          </ul>
          <button
            type="button"
            disabled={saving}
            onClick={() => void download()}
            className={primaryStyle}
          >
            {saving ? 'Preparing…' : 'Download receipt'}
          </button>
        </>
      )}
      {saved && (
        <p role="status" className="mt-2 text-xs text-[#78aea2]">
          Saved as {saved}.
        </p>
      )}
      {problem && (
        <p role="alert" className="mt-3 text-sm text-[#f1a07a]">
          {problem}
        </p>
      )}
    </section>
  )
}
