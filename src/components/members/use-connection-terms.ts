import { useEffect, useState } from 'react'
import { DEFAULT_TERMS, fetchConnectionTerms } from '#/lib/connections-api'
import type { ConnectionTerms } from '#/lib/connections-api'

/** One request per page load, shared by every component that names it. */
let cached: Promise<ConnectionTerms> | undefined

/** Forgets the name, after an admin renames it (and between tests). */
export function forgetConnectionTerms() {
  cached = undefined
}

/**
 * What the site calls a connection request (an admin setting, Chunk 18).
 * The default until the server answers, and if it cannot.
 */
export function useConnectionTerms(): ConnectionTerms {
  const [terms, setTerms] = useState<ConnectionTerms>(DEFAULT_TERMS)
  useEffect(() => {
    let live = true
    cached ??= fetchConnectionTerms().catch(() => {
      cached = undefined
      return DEFAULT_TERMS
    })
    void cached.then((answer) => {
      if (live) setTerms(answer)
    })
    return () => {
      live = false
    }
  }, [])
  return terms
}
