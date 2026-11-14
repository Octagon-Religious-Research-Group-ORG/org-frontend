import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { unsubscribe, unsubscribeScopeWords } from '#/lib/notifications-api'
import { primaryStyle } from './editor-styles'

export const NO_LINK =
  'This page needs the link from an ORG email. You can change your email settings after signing in.'
export const DONE = 'Done. Those emails are turned off.'

const linkStyle =
  'mt-6 inline-block font-mono text-[10px] uppercase tracking-[0.2em] text-[#9dcf83] underline'

/**
 * The page an email's "turn off" link opens (Chunk 14). No sign-in: the
 * link's token says who and what. One button, so a mail scanner opening the
 * link changes nothing; a mail client's own one-click unsubscribe goes
 * straight to the server.
 */
export function UnsubscribePanel({ token }: { token?: string }) {
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string>()
  const words = token ? unsubscribeScopeWords(token) : undefined

  async function turnOff(linkToken: string) {
    setBusy(true)
    setError(undefined)
    try {
      await unsubscribe(linkToken)
      setDone(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That did not work.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section
      aria-labelledby="unsubscribe-heading"
      className="mx-auto max-w-2xl border border-[rgba(236,226,196,0.16)] bg-[rgba(11,13,18,0.85)] p-7 sm:p-10"
    >
      <h1
        id="unsubscribe-heading"
        className="font-display text-4xl uppercase tracking-[0.03em] text-[#f6efd9]"
      >
        Email settings
      </h1>
      {!token || !words ? (
        <p role="alert" className="mt-4 text-sm text-[#f1a07a]">
          {NO_LINK}
        </p>
      ) : done ? (
        <p role="status" className="mt-4 text-sm text-[#9dcf83]">
          {DONE}
        </p>
      ) : (
        <>
          <p className="mt-4 text-sm leading-7 text-[#b8ad8d]">
            Turn off {words}?
          </p>
          {error && (
            <p role="alert" className="mt-4 text-sm text-[#f1a07a]">
              {error}
            </p>
          )}
          <button
            type="button"
            className={primaryStyle}
            disabled={busy}
            onClick={() => void turnOff(token)}
          >
            Turn these emails off
          </button>
        </>
      )}
      <div>
        <Link to="/settings/notifications" className={linkStyle}>
          Manage all your email settings
        </Link>
      </div>
    </section>
  )
}
