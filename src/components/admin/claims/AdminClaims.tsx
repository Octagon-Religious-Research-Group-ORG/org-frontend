import { useEffect, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { ApiError } from '#/lib/api'
import { useOrgAuth } from '#/lib/auth'
import {
  approveClaim,
  claimDay,
  fetchAdminClaims,
  MAX_CLAIM_REASON_LENGTH,
  rejectClaim,
} from '#/lib/claims-api'
import type { AdminClaim, ClaimStatus } from '#/lib/claims-api'
import {
  buttonStyle,
  dangerStyle,
  fieldStyle,
  labelStyle,
  primaryStyle,
} from '#/components/members/editor-styles'
import { LegacyCommentLinker } from './LegacyCommentLinker'

export const STATUS_TABS: Array<{ status: ClaimStatus; label: string }> = [
  { status: 'pending', label: 'Waiting' },
  { status: 'approved', label: 'Approved' },
  { status: 'rejected', label: 'Rejected' },
  { status: 'withdrawn', label: 'Withdrawn' },
]

export const ADMINS_ONLY = 'This page is for ORG admins.'
export const APPROVE_EXPLAINED =
  'Approving gives this page to the person who asked: they can then edit it and accept suggestions. Any other requests for the page are rejected.'

function sessionToken(token: string | undefined) {
  if (!token) throw new Error('Your sign-in session has expired.')
  return token
}

/**
 * The admins' claims queue (Chunk 11): requests to own imported pages,
 * approve or reject, and then link imported comments. Kept small on purpose:
 * it moves into the admin dashboard in Chunk 12.
 */
export function AdminClaims() {
  const auth = useOrgAuth()
  const [status, setStatus] = useState<ClaimStatus>('pending')
  const [claims, setClaims] = useState<Array<AdminClaim>>()
  const [denied, setDenied] = useState(false)
  const [error, setError] = useState<string>()
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    const closed = new AbortController()
    setClaims(undefined)
    void (async () => {
      try {
        const token = sessionToken(await auth.getToken())
        const result = await fetchAdminClaims(token, status)
        if (!closed.signal.aborted) {
          setClaims(result.claims)
          setError(undefined)
        }
      } catch (err) {
        if (closed.signal.aborted) return
        if (err instanceof ApiError && err.status === 403) setDenied(true)
        else {
          setError(
            err instanceof Error ? err.message : 'The requests did not load.',
          )
        }
      }
    })()
    return () => closed.abort()
  }, [auth, status, attempt])

  if (denied) {
    return (
      <p role="alert" className="text-sm text-[#f1a07a]">
        {ADMINS_ONLY}
      </p>
    )
  }

  return (
    <div className="text-[#ece2c4]">
      <h1 className="text-[clamp(28px,6vw,52px)] font-thin uppercase tracking-[0.06em] text-[#f6efd9]">
        Page claims
      </h1>
      <p className="mt-3 max-w-2xl text-sm leading-7 text-[#b8ad8d]">
        Members asking to own a page imported from the old Pages profiles. Only
        you, the other admins and the person who asked can see a request.
      </p>
      <div
        role="tablist"
        aria-label="Status"
        className="mt-6 flex flex-wrap gap-2"
      >
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.status}
            type="button"
            role="tab"
            aria-selected={tab.status === status}
            onClick={() => setStatus(tab.status)}
            className={tab.status === status ? primaryStyle : buttonStyle}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {error && (
        <div className="mt-4">
          <p role="alert" className="text-sm text-[#f1a07a]">
            {error}
          </p>
          <button
            type="button"
            className={buttonStyle}
            onClick={() => setAttempt((count) => count + 1)}
          >
            Try again
          </button>
        </div>
      )}
      {!claims && !error && (
        <p role="status" className="mt-6 text-sm text-[#9f9676]">
          Loading requests…
        </p>
      )}
      {claims?.length === 0 && (
        <p className="mt-6 text-sm text-[#9f9676]">No requests here.</p>
      )}
      {claims && claims.length > 0 && (
        <ul className="mt-6 flex flex-col gap-6">
          {claims.map((claim) => (
            <li key={claim.claimId}>
              <ClaimCard
                claim={claim}
                onDecided={() => setAttempt((count) => count + 1)}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function ClaimCard({
  claim,
  onDecided,
}: {
  claim: AdminClaim
  onDecided: () => void
}) {
  const auth = useOrgAuth()
  const [rejecting, setRejecting] = useState(false)
  const [reason, setReason] = useState('')
  const [linking, setLinking] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()
  const who = claim.claimant.email ?? claim.claimant.userId
  const pageName = claim.page?.displayName ?? 'A page that no longer exists'

  async function decide(run: (token: string) => Promise<unknown>) {
    setBusy(true)
    setError(undefined)
    try {
      await run(sessionToken(await auth.getToken()))
      onDecided()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That did not work.')
      // The queue may have moved on (decided elsewhere, page taken).
      if (err instanceof ApiError && err.status === 409) onDecided()
    } finally {
      setBusy(false)
    }
  }

  return (
    <article
      aria-label={`Request for ${pageName}`}
      className="border border-[rgba(236,226,196,0.16)] bg-[rgba(11,13,18,0.85)] p-5"
    >
      <h2 className="text-lg text-[#f6efd9]">
        {claim.page ? (
          <Link
            to="/$slug"
            params={{ slug: claim.page.slug }}
            className="underline underline-offset-4"
          >
            {pageName}
          </Link>
        ) : (
          pageName
        )}
      </h2>
      <p className="mt-1 text-sm text-[#b8ad8d]">
        Asked by <span className="[overflow-wrap:anywhere]">{who}</span>
        {claim.claimant.emailVerified === false && ' (email not confirmed)'}
        {' · '}
        {claimDay(claim.requestedAt)}
      </p>
      <p className="mt-3 whitespace-pre-wrap text-sm leading-7 [overflow-wrap:anywhere]">
        {claim.message}
      </p>
      {claim.decidedAt && (
        <p className="mt-2 text-xs text-[#9f9676]">
          {claim.decidedBySite ? 'Decided by the site' : 'Decided'} on{' '}
          {claimDay(claim.decidedAt)}
          {claim.reason && ` · Reason: ${claim.reason}`}
        </p>
      )}
      {error && (
        <p role="alert" className="mt-2 text-sm text-[#f1a07a]">
          {error}
        </p>
      )}

      {claim.status === 'pending' && !rejecting && (
        <>
          <p className="mt-3 text-xs text-[#9f9676]">{APPROVE_EXPLAINED}</p>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              className={primaryStyle}
              disabled={busy}
              onClick={() =>
                void decide((token) => approveClaim(token, claim.claimId))
              }
            >
              Approve
            </button>
            <button
              type="button"
              className={dangerStyle}
              disabled={busy}
              onClick={() => setRejecting(true)}
            >
              Reject…
            </button>
          </div>
        </>
      )}
      {claim.status === 'pending' && rejecting && (
        <form
          className="mt-3"
          onSubmit={(event) => {
            event.preventDefault()
            void decide((token) => rejectClaim(token, claim.claimId, reason))
          }}
        >
          <label htmlFor={`reason-${claim.claimId}`} className={labelStyle}>
            Reason, shown to the person who asked (optional)
          </label>
          <textarea
            id={`reason-${claim.claimId}`}
            rows={2}
            maxLength={MAX_CLAIM_REASON_LENGTH}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            className={fieldStyle}
          />
          <div className="flex flex-wrap gap-3">
            <button type="submit" className={dangerStyle} disabled={busy}>
              Reject the request
            </button>
            <button
              type="button"
              className={buttonStyle}
              disabled={busy}
              onClick={() => setRejecting(false)}
            >
              Cancel
            </button>
          </div>
        </form>
      )}
      {claim.status === 'approved' && claim.page && (
        <>
          <button
            type="button"
            className={buttonStyle}
            aria-expanded={linking}
            onClick={() => setLinking((open) => !open)}
          >
            {linking ? 'Close imported comments' : 'Link imported comments…'}
          </button>
          {linking && <LegacyCommentLinker claimId={claim.claimId} />}
        </>
      )}
    </article>
  )
}
