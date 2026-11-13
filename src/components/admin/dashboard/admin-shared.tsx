import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { ApiError } from '#/lib/api'
import { useOrgAuth } from '#/lib/auth'
import { buttonStyle } from '#/components/members/editor-styles'

export const ADMINS_ONLY = 'This page is for ORG admins.'

export function sessionToken(token: string | undefined) {
  if (!token) throw new Error('Your sign-in session has expired.')
  return token
}

/**
 * Loads one admin read with the signed-in token. A 403 is remembered as
 * `denied`, so a section can show nothing but "admins only".
 */
export function useAdminLoad<T>(
  load: (token: string) => Promise<T>,
  key: string,
) {
  const auth = useOrgAuth()
  const [data, setData] = useState<T>()
  const [error, setError] = useState<string>()
  const [denied, setDenied] = useState(false)
  const [attempt, setAttempt] = useState(0)

  // A different list starts empty; a reload of the same one keeps what it
  // shows until the fresh answer arrives, so a form on it keeps its state.
  useEffect(() => setData(undefined), [key])

  useEffect(() => {
    const closed = new AbortController()
    setError(undefined)
    void (async () => {
      try {
        const result = await load(sessionToken(await auth.getToken()))
        if (!closed.signal.aborted) setData(result)
      } catch (err) {
        if (closed.signal.aborted) return
        if (err instanceof ApiError && err.status === 403) setDenied(true)
        else setError(err instanceof Error ? err.message : 'That did not load.')
      }
    })()
    return () => closed.abort()
    // `load` is rebuilt every render; `key` says when its inputs changed.
  }, [auth, key, attempt])

  return { data, error, denied, reload: () => setAttempt((n) => n + 1) }
}

/** One admin write at a time per card, with its error kept for the reader. */
export function useAdminAction() {
  const auth = useOrgAuth()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()

  async function run(
    write: (token: string) => Promise<unknown>,
    /** Runs only when the write succeeded. */
    after: () => void,
    /**
     * Re-reads the screen after a 409 or a 500, without claiming success.
     * Does nothing unless a caller passes a pure re-read: `after` may announce
     * success or close a form, which a failed write must never do.
     */
    refresh: () => void = () => undefined,
  ) {
    setBusy(true)
    setError(undefined)
    try {
      await write(sessionToken(await auth.getToken()))
      after()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That did not work.')
      // The screen is out of date (someone else acted first), or the change
      // happened but its audit record did not (a 500): show the news.
      if (
        err instanceof ApiError &&
        (err.status === 409 || err.status === 500)
      ) {
        refresh()
      }
    } finally {
      setBusy(false)
    }
  }

  return { busy, error, run }
}

export function LoadState({
  denied,
  error,
  loading,
  onRetry,
  children,
}: {
  denied: boolean
  error?: string
  loading: boolean
  onRetry: () => void
  children: ReactNode
}) {
  if (denied) {
    return (
      <p role="alert" className="mt-6 text-sm text-[#f1a07a]">
        {ADMINS_ONLY}
      </p>
    )
  }
  if (error) {
    return (
      <div className="mt-6">
        <p role="alert" className="text-sm text-[#f1a07a]">
          {error}
        </p>
        <button type="button" className={buttonStyle} onClick={onRetry}>
          Try again
        </button>
      </div>
    )
  }
  if (loading) {
    return (
      <p role="status" className="mt-6 text-sm text-[#9f9676]">
        Loading…
      </p>
    )
  }
  return <>{children}</>
}

export function Pager({
  page,
  hasMore,
  onPage,
}: {
  page: number
  hasMore: boolean
  onPage: (page: number) => void
}) {
  if (page === 1 && !hasMore) return null
  return (
    <nav aria-label="Pages" className="mt-6 flex items-center gap-3">
      <button
        type="button"
        className={buttonStyle}
        disabled={page === 1}
        onClick={() => onPage(page - 1)}
      >
        Newer
      </button>
      <span className="mt-3 text-xs text-[#9f9676]">Page {page}</span>
      <button
        type="button"
        className={buttonStyle}
        disabled={!hasMore}
        onClick={() => onPage(page + 1)}
      >
        Older
      </button>
    </nav>
  )
}

export const cardStyle =
  'border border-[rgba(236,226,196,0.16)] bg-[rgba(11,13,18,0.85)] p-5'
export const sectionHeading =
  'text-2xl font-light uppercase tracking-[0.06em] text-[#f6efd9]'
export const noteStyle = 'mt-3 max-w-2xl text-sm leading-7 text-[#b8ad8d]'
