import { useEffect, useState } from 'react'
import { useOrgAuth } from '#/lib/auth'
import { downloadReceipt, fetchReceipt, receiptPath } from '#/lib/receipts-api'
import type { Receipt, ReceiptTarget, ReceiptVersion } from '#/lib/receipts-api'
import { buttonStyle, primaryStyle } from './editor-styles'

const SESSION_UNCONFIRMED =
  "We couldn't confirm that you're signed in. Please try again."

/** What a receipt proves, and what it does not, in plain words (plan §6). */
export const RECEIPT_EXPLAINED = [
  'A receipt is a file you can keep. It shows that this exact text existed no later than the moment two independent services time-stamped it: FreeTSA (an RFC 3161 time-stamp) and OpenTimestamps (anchored in the Bitcoin blockchain). Anyone can check it with free public tools; the steps are inside the file.',
  'It does not show who wrote the text, that it is true, or that it was not written earlier somewhere else. FreeTSA is not an EU “qualified” time-stamp authority, and this is not legal advice.',
  'Beliefs imported from Apple Pages are dated when they were imported here; a receipt never claims an earlier date.',
]

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

function VersionStatus({ version }: { version: ReceiptVersion }) {
  const { anchor } = version
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
      {anchor.state === 'anchored' ? (
        <>
          Anchored on {day(`${anchor.anchorId}T00:00:00Z`)}.{' '}
          {freetsaLine(anchor.freetsa.status, anchor.freetsa.genTime)}{' '}
          {otsLine(
            anchor.opentimestamps.status,
            anchor.opentimestamps.bitcoinHeights,
          )}
        </>
      ) : (
        <span className="text-[#f1d78a]">{ANCHORING_PENDING}</span>
      )}
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
  useEffect(() => {
    if (auth.isLoading) return
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
  }, [auth, key])

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
          <ul className="mt-3 flex flex-col gap-2">
            {receipt.versions.map((version) => (
              <VersionStatus
                key={`${version.seq}-${version.versionHash}`}
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
