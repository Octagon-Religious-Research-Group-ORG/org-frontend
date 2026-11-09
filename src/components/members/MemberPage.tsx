import { useEffect, useState } from 'react'
import { SiteNav } from '#/components/SiteNav'
import { ApiError } from '#/lib/api'
import { useOrgAuth } from '#/lib/auth'
import { fetchMemberProfile } from '#/lib/members-api'
import type { MemberProfile } from '#/lib/members-api'
import { ProfileView } from './ProfileView'
import { ReferenceLinks } from './ReferenceLinks'

const SESSION_UNCONFIRMED =
  "We couldn't confirm that you're signed in. Please try again."

function NotFoundMessage() {
  return (
    <>
      <h1 className="text-3xl font-thin uppercase tracking-[0.18em] text-[#ece2c4]">
        Page not found
      </h1>
      <p className="mt-4 max-w-md text-sm leading-6 text-[#b8ad8d]">
        The requested page does not exist in the ORG archive.
      </p>
    </>
  )
}

interface MemberPageProps {
  slug: string
  initial?: MemberProfile
  missing?: boolean
}

/**
 * A member's page at its own address. The server render shows only what a
 * logged-out visitor may see; a signed-in visitor then asks again with their
 * token and gets whatever the server gives them.
 *
 * @param missing - the server answered "no such page" to a logged-out request;
 *   for a signed-in visitor this may still be their own hidden page
 */
export function MemberPage(props: MemberPageProps) {
  return <LoadedMemberPage key={props.slug} {...props} />
}

function LoadedMemberPage({ slug, initial, missing = false }: MemberPageProps) {
  const auth = useOrgAuth()
  const [profile, setProfile] = useState(initial)
  const [gone, setGone] = useState(false)
  const [error, setError] = useState<string>()
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (auth.isLoading) return
    // Nothing more to learn: a logged-out visitor already has their answer.
    if (!auth.isAuthenticated && (initial || missing)) return
    const closed = new AbortController()
    void (async () => {
      try {
        const token = auth.isAuthenticated ? await auth.getToken() : undefined
        if (auth.isAuthenticated && !token) throw new Error(SESSION_UNCONFIRMED)
        const result = await fetchMemberProfile(slug, { token })
        if (!closed.signal.aborted) {
          setProfile(result)
          setGone(false)
          setError(undefined)
        }
      } catch (err) {
        if (closed.signal.aborted) return
        if (err instanceof ApiError && err.status === 404) setGone(true)
        else if (!initial) {
          setError(
            err instanceof Error ? err.message : 'This page is unavailable.',
          )
        }
      }
    })()
    return () => closed.abort()
  }, [auth, slug, initial, missing, attempt])

  // Also while the login check runs, so the server's 404 page says what it is;
  // a signed-in owner sees their page replace it a moment later.
  const showMissing = gone || (missing && !profile && !auth.isAuthenticated)

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#0b0d12] text-[#ece2c4]">
      <SiteNav />
      <main className="relative z-[1] mx-auto max-w-[1120px] px-[clamp(16px,4vw,40px)] pb-24 pt-[clamp(132px,16vh,176px)]">
        {showMissing ? (
          <NotFoundMessage />
        ) : profile ? (
          <ProfileView
            profile={profile}
            onChanged={() => setAttempt((count) => count + 1)}
          />
        ) : error ? (
          <div>
            <p role="alert" className="text-sm text-[#f1a07a]">
              {error}
            </p>
            <button
              type="button"
              onClick={() => {
                setError(undefined)
                setAttempt((count) => count + 1)
              }}
              className="mt-4 border border-[#78aea2] px-4 py-2 font-mono text-[10px] uppercase tracking-[0.18em] text-[#78aea2]"
            >
              Try again
            </button>
          </div>
        ) : (
          <p role="status" className="text-sm text-[#b8ad8d]">
            Opening this page…
          </p>
        )}
        <ReferenceLinks />
      </main>
    </div>
  )
}
