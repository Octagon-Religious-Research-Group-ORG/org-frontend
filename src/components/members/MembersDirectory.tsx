import { useEffect, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { TabPerforations } from '#/components/BlotterPerforations'
import { useOrgAuth } from '#/lib/auth'
import { fetchMemberDirectory } from '#/lib/members-api'
import type { DirectoryCard, MemberDirectory } from '#/lib/members-api'
import { ProfilePicture } from './ProfilePicture'

function Card({ card }: { card: DirectoryCard }) {
  return (
    <Link
      to="/$slug"
      params={{ slug: card.slug }}
      className="group block min-w-0 no-underline"
    >
      <div className="relative">
        <ProfilePicture
          slug={card.slug}
          displayName={card.displayName}
          hasPicture={card.hasPicture}
          picturePublic={card.picturePublic}
        />
        <TabPerforations tabs={4} />
      </div>
      <div className="mt-3 [overflow-wrap:anywhere] text-sm text-[#f6efd9] group-hover:underline">
        {card.displayName}
      </div>
      <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.18em] text-[#9f9676]">
        {card.access === 'name-only' ? 'Members only' : 'Read page'}
      </div>
    </Link>
  )
}

/**
 * The member directory, inside the Members Community. Who is listed, and how
 * much each card shows, is decided by the server from the viewer's token.
 */
export function MembersDirectory() {
  const auth = useOrgAuth()
  const [directory, setDirectory] = useState<MemberDirectory>()
  const [error, setError] = useState<string>()
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (auth.isLoading) return
    const closed = new AbortController()
    void (async () => {
      try {
        const token = auth.isAuthenticated ? await auth.getToken() : undefined
        const result = await fetchMemberDirectory(token)
        if (!closed.signal.aborted) setDirectory(result)
      } catch (err) {
        if (!closed.signal.aborted) {
          setError(
            err instanceof Error
              ? err.message
              : 'The directory is unavailable.',
          )
        }
      }
    })()
    return () => closed.abort()
  }, [auth, attempt])

  return (
    <section
      aria-label="Member directory"
      className="mt-12 border border-[rgba(236,226,196,0.16)] bg-[rgba(11,13,18,0.85)] p-6 sm:p-10"
    >
      <h2 className="text-2xl font-light uppercase tracking-[0.06em] text-[#f6efd9]">
        Members
      </h2>
      {error && !directory && (
        <div className="mt-4">
          <p role="alert" className="text-sm text-[#f1a07a]">
            {error}
          </p>
          <button
            type="button"
            onClick={() => {
              setError(undefined)
              setAttempt((count) => count + 1)
            }}
            className="mt-3 border border-[#78aea2] px-4 py-2 font-mono text-[10px] uppercase tracking-[0.18em] text-[#78aea2]"
          >
            Try again
          </button>
        </div>
      )}
      {!error && !directory && (
        <p className="mt-4 text-sm text-[#b8ad8d]">Opening the directory…</p>
      )}
      {directory && directory.members.length === 0 && (
        <p className="mt-4 text-sm text-[#b8ad8d]">No member pages yet.</p>
      )}
      {directory && directory.members.length > 0 && (
        <div className="mt-6 grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-4">
          {directory.members.map((card) => (
            <Card key={card.slug} card={card} />
          ))}
        </div>
      )}
      {directory?.hasMore && (
        <p className="mt-6 text-xs text-[#9f9676]">
          Only part of the directory is shown here.
        </p>
      )}
    </section>
  )
}
