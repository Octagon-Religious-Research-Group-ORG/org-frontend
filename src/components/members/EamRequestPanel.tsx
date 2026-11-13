import { useEffect, useState } from 'react'
import { useOrgAuth } from '#/lib/auth'
import {
  adminTime,
  fetchMyEamRequest,
  MAX_EAM_NOTE_LENGTH,
  requestEam,
} from '#/lib/admin-api'
import type { EamStatus } from '#/lib/admin-api'
import {
  buttonStyle,
  fieldStyle,
  labelStyle,
  primaryStyle,
} from './editor-styles'

export const EAM_EXPLAINED =
  'An Entheogen-approved Member (EaM) is a member, in the USA, whose beliefs include entheogenic practice (or who states their awareness and openness) and who completes an ORG-approved safety training. Pressing the button tells Tripp you are interested; he will be in touch about the next steps.'

/**
 * "Request EaM" (plan §2d item 9, Chunk 12): for members with an approved
 * page, once, until an admin lets them ask again. Shown only to a signed-in
 * member the server says may ask, or who already asked.
 */
export function EamRequestPanel() {
  const auth = useOrgAuth()
  const [status, setStatus] = useState<EamStatus>()
  const [open, setOpen] = useState(false)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()

  useEffect(() => {
    if (auth.isLoading || !auth.isAuthenticated) return
    const closed = new AbortController()
    void (async () => {
      try {
        const token = await auth.getToken()
        if (!token) return
        const result = await fetchMyEamRequest(token)
        if (!closed.signal.aborted) setStatus(result)
      } catch {
        // Nothing to offer until the server answers; the page still works.
      }
    })()
    return () => closed.abort()
  }, [auth])

  if (!status || status.block === 'needs-approved-page') return null

  async function send() {
    setBusy(true)
    setError(undefined)
    try {
      const token = await auth.getToken()
      if (!token) throw new Error('Your sign-in session has expired.')
      setStatus(await requestEam(token, note))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That did not work.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section
      aria-labelledby="eam-heading"
      className="mt-12 border border-[rgba(236,226,196,0.16)] bg-[rgba(11,13,18,0.85)] p-6 sm:p-10"
    >
      <h2
        id="eam-heading"
        className="text-2xl font-light uppercase tracking-[0.06em] text-[#f6efd9]"
      >
        Entheogen-approved Member
      </h2>
      <p className="mt-4 max-w-2xl text-sm leading-7 text-[#b8ad8d]">
        {EAM_EXPLAINED}
      </p>
      {status.block === 'already-requested' && (
        <p role="status" className="mt-4 text-sm text-[#9dcf83]">
          You asked
          {status.requestedAt ? ` on ${adminTime(status.requestedAt)}` : ''}.
          Tripp will be in touch.
        </p>
      )}
      {status.mayRequest && !open && (
        <button
          type="button"
          className={primaryStyle}
          onClick={() => setOpen(true)}
        >
          Request EaM
        </button>
      )}
      {status.mayRequest && open && (
        <form
          className="mt-4 max-w-xl"
          onSubmit={(event) => {
            event.preventDefault()
            void send()
          }}
        >
          <label htmlFor="eam-note" className={labelStyle}>
            A note for Tripp (optional)
          </label>
          <textarea
            id="eam-note"
            rows={3}
            maxLength={MAX_EAM_NOTE_LENGTH}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            className={fieldStyle}
          />
          {error && (
            <p role="alert" className="mt-2 text-sm text-[#f1a07a]">
              {error}
            </p>
          )}
          <div className="flex flex-wrap gap-3">
            <button type="submit" className={primaryStyle} disabled={busy}>
              Send the request
            </button>
            <button
              type="button"
              className={buttonStyle}
              disabled={busy}
              onClick={() => setOpen(false)}
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </section>
  )
}
