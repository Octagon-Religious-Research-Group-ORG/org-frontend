import { useEffect, useState } from 'react'
import { useOrgAuth } from '#/lib/auth'
import { fetchPictureObjectUrl, pictureUrl } from '#/lib/members-api'

/**
 * A member's picture in the octagon cut-out. A public page's picture is a
 * plain image; any other is fetched with the viewer's token, and the server
 * decides. No picture, or a failed one, shows the empty octagon.
 */
export function ProfilePicture({
  slug,
  displayName,
  hasPicture,
  picturePublic,
  version,
}: {
  slug: string
  displayName: string
  hasPicture: boolean
  picturePublic: boolean
  /** Changes when the picture does; a new one replaces the old on screen. */
  version?: string
}) {
  const auth = useOrgAuth()
  const [objectUrl, setObjectUrl] = useState<string>()
  const restricted = hasPicture && !picturePublic

  useEffect(() => {
    if (!restricted || !auth.isAuthenticated) return
    const closed = new AbortController()
    let created: string | undefined
    void (async () => {
      try {
        const token = await auth.getToken()
        if (!token) return
        const url = await fetchPictureObjectUrl(slug, token)
        created = url
        if (closed.signal.aborted) URL.revokeObjectURL(url)
        else setObjectUrl(url)
      } catch {
        // The empty octagon stands in; there is nothing to act on.
      }
    })()
    return () => {
      closed.abort()
      if (created) URL.revokeObjectURL(created)
    }
  }, [restricted, auth, slug, version])

  const source = !hasPicture
    ? undefined
    : picturePublic
      ? pictureUrl(slug, version)
      : objectUrl

  return (
    <div className="octagon relative aspect-square w-full bg-[#1a2230]">
      {source && (
        <img
          src={source}
          alt={`Picture chosen by ${displayName}`}
          loading="lazy"
          className="h-full w-full object-cover"
        />
      )}
    </div>
  )
}
