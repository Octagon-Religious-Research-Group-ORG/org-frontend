import { useEffect, useState } from 'react'

/** How long a request runs before the member is told why it is slow. */
export const SLOW_NOTICE_AFTER_MS = 4000

/** The free test server sleeps when idle and takes about 50 seconds to wake. */
export const SLOW_SERVER_MESSAGE =
  'The server can take up to a minute to wake up. Thanks for waiting.'

/** True once `busy` has lasted longer than {@link SLOW_NOTICE_AFTER_MS}. */
export function useSlowNotice(busy: boolean) {
  const [slow, setSlow] = useState(false)
  useEffect(() => {
    setSlow(false)
    if (!busy) return
    const timer = setTimeout(() => setSlow(true), SLOW_NOTICE_AFTER_MS)
    return () => clearTimeout(timer)
  }, [busy])
  return slow
}
