import { useEffect, useRef, useState } from 'react'
import { useOrgAuth } from '#/lib/auth'
import {
  deleteMyPage,
  downloadMyData,
  fetchMyData,
  longDate,
  undoPageDeletion,
} from '#/lib/member-data-api'
import type { MyDataStatus } from '#/lib/member-data-api'
import { ApiError } from '#/lib/api'
import { buttonStyle, primaryStyle } from './editor-styles'

export const SESSION_EXPIRED = 'Your sign-in session has expired.'
export const DOWNLOAD_EXPLAINED =
  'A zip file with your page and every earlier version of it, your comments and suggestions, your votes, your connection requests and connections (and the members you blocked), your settings, and a timestamp receipt for each version that has been anchored. Other people appear only as the site shows them to you.'
export const DOWNLOADED = (name: string) =>
  `Your data is downloading as ${name}.`
export const DELETED_NOTE = 'Your page is deleted.'
export const RESTORED_NOTE = 'Your page is back on the site.'

const boxStyle =
  'mt-6 border border-[rgba(236,226,196,0.16)] bg-[rgba(11,13,18,0.85)] p-6 sm:p-8'
const headingStyle =
  'font-mono text-[11px] uppercase tracking-[0.2em] text-[#9dcf83]'
const textStyle = 'mt-3 text-sm leading-7 text-[#d8cfb0]'
const dangerStyle =
  'border border-[#f1a07a] px-4 py-2 font-mono text-[10px] uppercase tracking-[0.18em] text-[#f1a07a] hover:bg-[#f1a07a] hover:text-[#0b0d12] disabled:opacity-50'

function message(err: unknown) {
  return err instanceof Error ? err.message : 'That did not work.'
}

/**
 * "Your data" (Chunk 17): download everything, delete the page with a
 * typed confirmation, and bring it back during the 30 days after.
 */
export function YourData() {
  const auth = useOrgAuth()
  const [status, setStatus] = useState<MyDataStatus>()
  const [loadError, setLoadError] = useState<string>()
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    const closed = new AbortController()
    setLoadError(undefined)
    void (async () => {
      try {
        const token = await auth.getToken()
        if (!token) throw new Error(SESSION_EXPIRED)
        const result = await fetchMyData(token)
        if (!closed.signal.aborted) setStatus(result)
      } catch (err) {
        if (!closed.signal.aborted) setLoadError(message(err))
      }
    })()
    return () => closed.abort()
  }, [auth, attempt])

  if (loadError) {
    return (
      <div className={boxStyle}>
        <p role="alert" className="text-sm text-[#f1a07a]">
          {loadError}
        </p>
        <button
          type="button"
          className={primaryStyle}
          onClick={() => setAttempt((n) => n + 1)}
        >
          Try again
        </button>
      </div>
    )
  }
  if (!status) {
    return (
      <p role="status" className="mt-6 text-sm text-[#9f9676]">
        Loading…
      </p>
    )
  }
  return (
    <>
      <DownloadCard />
      <PageCard status={status} onChanged={() => setAttempt((n) => n + 1)} />
    </>
  )
}

function DownloadCard() {
  const auth = useOrgAuth()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()
  const [done, setDone] = useState<string>()

  async function download() {
    setBusy(true)
    setError(undefined)
    setDone(undefined)
    try {
      const token = await auth.getToken()
      if (!token) throw new Error(SESSION_EXPIRED)
      setDone(DOWNLOADED(await downloadMyData(token)))
    } catch (err) {
      setError(message(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section aria-labelledby="download-heading" className={boxStyle}>
      <h2 id="download-heading" className={headingStyle}>
        Download my data
      </h2>
      <p className={textStyle}>{DOWNLOAD_EXPLAINED}</p>
      <button
        type="button"
        className={`${primaryStyle} mt-4`}
        disabled={busy}
        onClick={() => void download()}
      >
        {busy ? 'Preparing…' : 'Download my data'}
      </button>
      <div aria-live="polite">
        {done && <p className="mt-3 text-sm text-[#9dcf83]">{done}</p>}
      </div>
      {error && (
        <p role="alert" className="mt-3 text-sm text-[#f1a07a]">
          {error}
        </p>
      )}
    </section>
  )
}

function PageCard({
  status,
  onChanged,
}: {
  status: MyDataStatus
  onChanged: () => void
}) {
  const auth = useOrgAuth()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()
  const [note, setNote] = useState<string>()
  const [asking, setAsking] = useState(false)
  const opener = useRef<HTMLButtonElement>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  // Back to the button that opened the dialog, once it is on screen again.
  const wasAsking = useRef(false)
  useEffect(() => {
    if (wasAsking.current && !asking) opener.current?.focus()
    wasAsking.current = asking
  }, [asking])
  const page = status.page
  // After a delete or an undo the control that was used goes away with the
  // re-read status: focus moves to the section heading, which stays, once
  // the dialog has closed (round 10, 4).
  const [landed, setLanded] = useState(false)
  useEffect(() => {
    if (landed) {
      heading.current?.focus()
      setLanded(false)
    }
  }, [landed])

  async function act(write: (token: string) => Promise<unknown>, done: string) {
    setBusy(true)
    setError(undefined)
    try {
      const token = await auth.getToken()
      if (!token) throw new Error(SESSION_EXPIRED)
      await write(token)
      setAsking(false)
      setNote(done)
      setLanded(true)
      onChanged()
    } catch (err) {
      setError(message(err))
      // Someone changed the page meanwhile (round 10, 5): show it as it is.
      if (err instanceof ApiError && err.status === 409) onChanged()
    } finally {
      setBusy(false)
    }
  }

  return (
    <section aria-labelledby="page-heading" className={boxStyle}>
      <h2
        id="page-heading"
        ref={heading}
        tabIndex={-1}
        className={`${headingStyle} focus:outline-none focus-visible:outline-1`}
      >
        Delete my page
      </h2>
      <div aria-live="polite">
        {note && <p className="mt-3 text-sm text-[#9dcf83]">{note}</p>}
      </div>
      {!page && (
        <p className={textStyle}>
          You have no member page, so there is nothing to delete.
        </p>
      )}
      {page && !page.deleted && (
        <>
          <p className={textStyle}>
            Your page is at /{page.slug}. Deleting it takes it off the site
            straight away. You can change your mind for 30 days.
          </p>
          {!asking && (
            <button
              ref={opener}
              type="button"
              className={`${dangerStyle} mt-4`}
              onClick={() => {
                setError(undefined)
                setAsking(true)
              }}
            >
              Delete my page…
            </button>
          )}
          {asking && (
            <DeleteDialog
              slug={page.slug}
              disclosure={status.disclosure}
              busy={busy}
              error={error}
              onCancel={() => {
                setAsking(false)
                setError(undefined)
              }}
              onConfirm={(typed) =>
                void act((token) => deleteMyPage(token, typed), DELETED_NOTE)
              }
            />
          )}
        </>
      )}
      {page?.deleted && (
        <>
          <p className={textStyle}>
            Your page was taken off the site on {longDate(page.deletedAt)}
            {page.source === 'account-deleted'
              ? ', when your account was deleted'
              : ''}
            . ORG keeps a private copy until {longDate(page.purgeAfter)}, then
            removes your personal content for good.
          </p>
          {page.undoUntil ? (
            <>
              <p className={textStyle}>
                You can bring it back until {longDate(page.undoUntil)}.
              </p>
              <button
                type="button"
                className={`${primaryStyle} mt-4`}
                disabled={busy}
                onClick={() =>
                  void act((token) => undoPageDeletion(token), RESTORED_NOTE)
                }
              >
                Bring my page back
              </button>
            </>
          ) : (
            <p className={textStyle}>
              To bring it back now, please ask an ORG admin.
            </p>
          )}
          {error && (
            <p role="alert" className="mt-3 text-sm text-[#f1a07a]">
              {error}
            </p>
          )}
        </>
      )}
    </section>
  )
}

/**
 * The confirmation: what happens, in the server's words (five years, plan
 * §2b), and the page’s address typed by hand, in a native modal dialog.
 * Escape (the browser’s `cancel`) or "Keep my page"
 * closes it.
 */
function DeleteDialog({
  slug,
  disclosure,
  busy,
  error,
  onCancel,
  onConfirm,
}: {
  slug: string
  disclosure: Array<string>
  busy: boolean
  error?: string
  onCancel: () => void
  onConfirm: (typed: string) => void
}) {
  const [typed, setTyped] = useState('')
  const input = useRef<HTMLInputElement>(null)
  const dialog = useRef<HTMLDialogElement>(null)
  // A real modal (review #10): the rest of the page is inert while it is
  // open, and the browser's Escape arrives as `cancel`.
  useEffect(() => {
    const element = dialog.current!
    element.showModal()
    input.current?.focus()
    // Closing a closed dialog does nothing, so this is safe either way.
    return () => element.close()
  }, [])
  const matches = typed.trim().toLowerCase() === slug

  return (
    <dialog
      ref={dialog}
      aria-labelledby="delete-dialog-title"
      aria-describedby="delete-dialog-text"
      className="max-w-xl border border-[#f1a07a] bg-[#0b0d12] p-5 text-[#ece2c4] backdrop:bg-black/70"
      onCancel={(event) => {
        event.preventDefault()
        onCancel()
      }}
    >
      <h3 id="delete-dialog-title" className="text-base text-[#f6efd9]">
        Delete your page?
      </h3>
      <ul
        id="delete-dialog-text"
        className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-[#d8cfb0]"
      >
        {disclosure.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      <form
        className="mt-4"
        onSubmit={(event) => {
          event.preventDefault()
          if (matches) onConfirm(typed)
        }}
      >
        <label
          htmlFor="delete-confirm"
          className="block text-sm text-[#f6efd9]"
        >
          To confirm, type your page's address: <strong>{slug}</strong>
        </label>
        <input
          ref={input}
          id="delete-confirm"
          value={typed}
          autoComplete="off"
          spellCheck={false}
          onChange={(event) => setTyped(event.target.value)}
          className="mt-2 w-full border border-[rgba(236,226,196,0.3)] bg-transparent px-3 py-2 text-sm text-[#f6efd9]"
        />
        {error && (
          <p role="alert" className="mt-3 text-sm text-[#f1a07a]">
            {error}
          </p>
        )}
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="submit"
            className={dangerStyle}
            disabled={!matches || busy}
          >
            {busy ? 'Deleting…' : 'Delete my page'}
          </button>
          <button type="button" className={buttonStyle} onClick={onCancel}>
            Keep my page
          </button>
        </div>
      </form>
    </dialog>
  )
}
