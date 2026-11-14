import { useEffect, useState } from 'react'
import { useOrgAuth } from '#/lib/auth'
import { searchArchive } from '#/lib/search-api'
import type { ArchiveSearch, SearchType } from '#/lib/search-api'

/** Shortest query worth sending (the server answers shorter ones with nothing). */
export const MIN_QUERY_LENGTH = 2

export type ArchiveSearchState =
  | { status: 'idle' }
  | { status: 'loading'; data?: ArchiveSearch }
  | { status: 'ready'; data: ArchiveSearch }
  | { status: 'error'; error: string }

/**
 * Searches the archive as the signed-in reader, or as a guest when nobody is
 * signed in, so a member sees members-only results and a guest never does.
 * A later query cancels the answer of an earlier one.
 */
export function useArchiveSearch(
  query: string,
  type: SearchType,
  page: number,
  debounceMs = 0,
) {
  const auth = useOrgAuth()
  const [state, setState] = useState<ArchiveSearchState>({ status: 'idle' })
  const [attempt, setAttempt] = useState(0)
  const q = query.trim()

  useEffect(() => {
    if (q.length < MIN_QUERY_LENGTH) {
      setState({ status: 'idle' })
      return
    }
    if (auth.isLoading) return
    const closed = new AbortController()
    setState((previous) => ({
      status: 'loading',
      ...(previous.status === 'ready' ? { data: previous.data } : {}),
    }))
    const timer = setTimeout(() => {
      void (async () => {
        try {
          const token = auth.isAuthenticated ? await auth.getToken() : undefined
          const data = await searchArchive({ q, type, page }, token)
          if (!closed.signal.aborted) setState({ status: 'ready', data })
        } catch (err) {
          if (closed.signal.aborted) return
          setState({
            status: 'error',
            error:
              err instanceof Error ? err.message : 'Search is unavailable.',
          })
        }
      })()
    }, debounceMs)
    return () => {
      closed.abort()
      clearTimeout(timer)
    }
  }, [auth, q, type, page, debounceMs, attempt])

  return { state, retry: () => setAttempt((n) => n + 1) }
}
