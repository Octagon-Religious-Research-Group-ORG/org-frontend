import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useOrgAuth } from '#/lib/auth'
import {
  claimDay,
  fetchMyClaims,
  MAX_CLAIM_MESSAGE_LENGTH,
  requestClaim,
  withdrawClaim,
} from '#/lib/claims-api'
import type { ClaimBlock, MyClaims } from '#/lib/claims-api'
import {
  buttonStyle,
  dangerStyle,
  fieldStyle,
  labelStyle,
  primaryStyle,
} from './editor-styles'

export const CLAIM_BUTTON = 'This is my page — ask to claim it'
export const CLAIM_EXPLAINED =
  "Pages from ORG's old Pages profiles were brought over without their owners. If this one is yours, ask to claim it: an admin checks and, once approved, it becomes your page to edit."
export const CLAIM_MESSAGE_LABEL = 'How can the admins tell this page is yours?'
export const CLAIM_MESSAGE_HINT =
  'For example, where you shared it before, or something only you and Tripp would know. Only the admins read this.'
export const CLAIM_PENDING =
  'You asked to claim this page. An admin will look at it; only you and the admins can see your request.'
export const CLAIM_REJECTED =
  'Your request to claim this page was not approved.'

/** What each refusal tells the reader instead of the button. */
export const CLAIM_BLOCK_NOTES: Record<ClaimBlock, string | undefined> = {
  'verify-email':
    'Please confirm your email address to ask to claim this page.',
  // An account with a page of its own claims nothing: there is nothing to say.
  'has-page': undefined,
  'has-pending':
    'You already have a request waiting for another page. Withdraw it there to ask for this one.',
  'cannot-check':
    "We can't check your account right now. Please try again in a moment.",
}

const panel =
  'mt-6 max-w-2xl border-l-2 border-[#f1d78a] pl-4 text-sm leading-7 text-[#ece2c4]'

/**
 * "This is my page" on an imported page with no owner (Chunk 11). Shown only
 * when the server marked the page claimable, which it does only for a
 * signed-in reader. What the reader asked before, and whether they may ask
 * now, comes from their own list of requests; nobody else's are ever shown.
 */
export function ClaimPanel({ slug }: { slug: string }) {
  const auth = useOrgAuth()
  const [mine, setMine] = useState<MyClaims>()
  const [loadError, setLoadError] = useState<string>()
  const [attempt, setAttempt] = useState(0)
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()

  useEffect(() => {
    if (auth.isLoading || !auth.isAuthenticated) return
    const closed = new AbortController()
    void (async () => {
      try {
        const token = await auth.getToken()
        if (!token) throw new Error('Your sign-in session has expired.')
        const result = await fetchMyClaims(token)
        if (!closed.signal.aborted) {
          setMine(result)
          setLoadError(undefined)
        }
      } catch (err) {
        if (!closed.signal.aborted) {
          setLoadError(
            err instanceof Error ? err.message : 'Your requests did not load.',
          )
        }
      }
    })()
    return () => closed.abort()
  }, [auth, attempt])

  if (!auth.isAuthenticated) return null
  if (!mine) {
    return loadError ? (
      <div className={panel}>
        <p role="alert" className="text-[#f1a07a]">
          {loadError}
        </p>
        <button
          type="button"
          className={buttonStyle}
          onClick={() => setAttempt((count) => count + 1)}
        >
          Try again
        </button>
      </div>
    ) : null
  }

  async function act(run: (token: string) => Promise<unknown>) {
    setBusy(true)
    setError(undefined)
    try {
      const token = await auth.getToken()
      if (!token) throw new Error('Your sign-in session has expired.')
      await run(token)
      setOpen(false)
      setMessage('')
      setAttempt((count) => count + 1)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That did not work.')
    } finally {
      setBusy(false)
    }
  }

  const here = mine.claims.find((claim) => claim.page?.slug === slug)
  // Counted as the server counts it: the text without its outer spaces.
  const length = message.trim().length
  const tooLong = length > MAX_CLAIM_MESSAGE_LENGTH
  const errorLine = error && (
    <p role="alert" className="mt-2 text-[#f1a07a]">
      {error}
    </p>
  )

  if (here?.status === 'pending') {
    return (
      <section aria-label="Your claim request" className={panel}>
        <p>{CLAIM_PENDING}</p>
        <p className="text-xs text-[#9f9676]">
          Asked on {claimDay(here.requestedAt)}.
        </p>
        <button
          type="button"
          className={dangerStyle}
          disabled={busy}
          onClick={() =>
            void act((token) => withdrawClaim(token, here.claimId))
          }
        >
          Withdraw my request
        </button>
        {errorLine}
      </section>
    )
  }

  const blockNote = mine.block && CLAIM_BLOCK_NOTES[mine.block]
  const rejected = here?.status === 'rejected'
  if (!rejected && !mine.mayClaim && !blockNote) return null

  return (
    <section aria-label="Claim this page" className={panel}>
      {rejected && (
        <>
          <p>{CLAIM_REJECTED}</p>
          {here.reason && (
            <p className="text-[#b8ad8d]">Reason given: {here.reason}</p>
          )}
        </>
      )}
      {blockNote && <p>{blockNote}</p>}
      {mine.mayClaim && !open && (
        <>
          {!rejected && <p className="text-[#b8ad8d]">{CLAIM_EXPLAINED}</p>}
          <button
            type="button"
            className={primaryStyle}
            onClick={() => setOpen(true)}
          >
            {CLAIM_BUTTON}
          </button>
        </>
      )}
      {mine.mayClaim && open && (
        <form
          onSubmit={(event: FormEvent) => {
            event.preventDefault()
            void act((token) => requestClaim(token, slug, message))
          }}
        >
          <label htmlFor="claim-message" className={labelStyle}>
            {CLAIM_MESSAGE_LABEL}
          </label>
          <textarea
            id="claim-message"
            rows={4}
            value={message}
            aria-describedby="claim-message-hint claim-message-count"
            onChange={(event) => setMessage(event.target.value)}
            className={fieldStyle}
          />
          <p id="claim-message-hint" className="text-xs text-[#9f9676]">
            {CLAIM_MESSAGE_HINT}
          </p>
          <p
            id="claim-message-count"
            className={`font-mono text-[11px] ${tooLong ? 'text-[#f1a07a]' : 'text-[#9f9676]'}`}
          >
            {length.toLocaleString('en-US')} /{' '}
            {MAX_CLAIM_MESSAGE_LENGTH.toLocaleString('en-US')} characters
            {tooLong && ' (too long)'}
          </p>
          <div className="flex flex-wrap gap-3">
            <button
              type="submit"
              className={primaryStyle}
              disabled={busy || !message.trim() || tooLong}
            >
              Send my request
            </button>
            <button
              type="button"
              className={buttonStyle}
              disabled={busy}
              onClick={() => {
                setOpen(false)
                setError(undefined)
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      )}
      {errorLine}
    </section>
  )
}
