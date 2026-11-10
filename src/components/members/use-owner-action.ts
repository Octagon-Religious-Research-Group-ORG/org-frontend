import { useState } from 'react'
import { useOrgAuth } from '#/lib/auth'

const SESSION_UNCONFIRMED =
  "We couldn't confirm that you're signed in. Please try again."

/**
 * One owner action at a time: gets the token, runs the request, and keeps the
 * server's own words when it refuses (a 409 says to reload, for instance).
 *
 * @returns `run`, which resolves to the action's result, or undefined when it
 *   failed and `problem` says why
 */
export function useOwnerAction() {
  const auth = useOrgAuth()
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string>()

  const run = async <T>(action: (token: string) => Promise<T>) => {
    setBusy(true)
    setProblem(undefined)
    try {
      const token = await auth.getToken()
      if (!token) throw new Error(SESSION_UNCONFIRMED)
      return await action(token)
    } catch (err) {
      setProblem(err instanceof Error ? err.message : 'Something went wrong.')
      return undefined
    } finally {
      setBusy(false)
    }
  }

  return { busy, problem, run }
}
