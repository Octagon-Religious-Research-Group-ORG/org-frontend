import { useEffect, useMemo, useRef, useState } from 'react'
import { ApiError } from '#/lib/api'
import { useOrgAuth } from '#/lib/auth'
import { reloadPage } from '#/lib/reload-page'
import { fetchOrgPageVotes } from '#/lib/votes-api'
import type { OrgPageVotes, VoteValue } from '#/lib/votes-api'
import { CommentThread } from './CommentThread'
import { buttonStyle } from './editor-styles'
import { VoteButtons } from './VoteButtons'
import type { CommentAccess } from './VoteButtons'

export const REACTIONS_HEADING = 'Your response to this page'
export const REACTIONS_UNAVAILABLE =
  'Votes and comments on this page are unavailable right now. Please try again later.'
export const PAGE_UPDATED_NOTE =
  'This page has been updated since you opened it. Reload it to read the new version and vote on it.'

const SESSION_UNCONFIRMED =
  "We couldn't confirm that you're signed in. Please try again."

/** A page as its route loaded it (`loadPublishedPage`). */
interface LoadedPage {
  pageId: string
  revision: number
  content: { title: string }
}

/**
 * The reactions under a page its route loaded, titled as the page is unless
 * the route shows another title.
 */
export function PageReactions({
  page,
  title,
}: {
  page: LoadedPage
  title?: string
}) {
  return (
    <OrgPageReactions
      pageId={page.pageId}
      revision={page.revision}
      title={title ?? page.content.title}
    />
  )
}

/**
 * The five buttons and a comment thread under one of ORG's own pages
 * (Chunk 10b, Tripp D06/Q04: "on every belief and on ORG's own pages").
 *
 * A vote is cast on the revision this page shows (`revision`, from the
 * page's own loader): when a newer one was published meanwhile, the server
 * refuses the vote and the reader is asked to reload. Read in the browser
 * with the reader's token, since their own vote and who may write depend on
 * who asks. A server that does not know the page (404) shows nothing here.
 */
export function OrgPageReactions({
  pageId,
  revision,
  title,
}: {
  pageId: string
  /** The published revision this page shows. */
  revision: number
  /** The page's title: part of every button's name. */
  title: string
}) {
  const auth = useOrgAuth()
  const [state, setState] = useState<OrgPageVotes>()
  const [problem, setProblem] = useState<string>()
  const [missing, setMissing] = useState(false)
  const [access, setAccess] = useState<CommentAccess>()
  const [compose, setCompose] = useState<{
    stance?: VoteValue
    nonce: number
  }>()
  // Only the newest read may show its answer.
  const generation = useRef(0)

  const load = async () => {
    const run = ++generation.current
    try {
      const token = auth.isAuthenticated ? await auth.getToken() : undefined
      if (auth.isAuthenticated && !token) throw new Error(SESSION_UNCONFIRMED)
      const answer = await fetchOrgPageVotes(pageId, { token })
      if (run !== generation.current) return
      setState(answer)
      setProblem(undefined)
    } catch (err) {
      if (run !== generation.current) return
      if (err instanceof ApiError && err.status === 404) {
        setMissing(true)
        return
      }
      setProblem(err instanceof Error ? err.message : REACTIONS_UNAVAILABLE)
    }
  }

  useEffect(() => {
    if (auth.isLoading) return
    void load()
    return () => {
      generation.current++
    }
    // `load` reads the latest props itself; a new reader or page reloads.
  }, [auth, pageId])

  // A newer revision than the one shown (review MEDIUM 2): a vote now would
  // be on text the reader has not seen, so the buttons show the counts only
  // and the reader is asked to reload. Taking a vote back needs no revision,
  // but here it waits for the reload too, like every other button.
  const stale = state !== undefined && state.revision !== revision
  const shownVotes = useMemo(
    () =>
      state === undefined || !stale
        ? state?.votes
        : {
            agree: state.votes.agree,
            disagree: state.votes.disagree,
            earlierWording: state.votes.earlierWording,
            mayVote: false,
          },
    [state, stale],
  )

  if (missing) return null
  const headingId = `reactions-${pageId}`

  return (
    <section
      aria-labelledby={headingId}
      className="mx-auto mt-12 max-w-[860px] border-t border-[rgba(236,226,196,0.16)] pt-8"
    >
      <h2
        id={headingId}
        className="font-mono text-[11px] uppercase tracking-[0.24em] text-[#78aea2]"
      >
        {REACTIONS_HEADING}
      </h2>
      {problem && (
        <p role="alert" className="mt-3 text-sm text-[#f1a07a]">
          {problem}
        </p>
      )}
      {stale && (
        <div role="status" className="mt-3 text-sm text-[#f1d78a]">
          <p>{PAGE_UPDATED_NOTE}</p>
          <button type="button" onClick={reloadPage} className={buttonStyle}>
            Reload the page
          </button>
        </div>
      )}
      {shownVotes ? (
        <VoteButtons
          orgPageId={pageId}
          title={title}
          textSeq={revision}
          votes={shownVotes}
          comment={access}
          onVotes={(answer) => {
            setState({ pageId, revision: answer.textSeq, votes: answer.votes })
            // An open "…and comment" form follows the vote as it is now: no
            // badge once there is no vote (as on a belief, Chunk 10).
            setCompose((last) =>
              last?.stance
                ? {
                    nonce: last.nonce,
                    ...(answer.votes.myVote
                      ? { stance: answer.votes.myVote }
                      : {}),
                  }
                : last,
            )
          }}
          onCompose={(stance) =>
            setCompose((last) => ({
              ...(stance ? { stance } : {}),
              nonce: (last?.nonce ?? 0) + 1,
            }))
          }
        />
      ) : (
        !problem && (
          <p role="status" className="mt-3 text-sm text-[#b8ad8d]">
            Opening the votes…
          </p>
        )
      )}
      <CommentThread
        orgPageId={pageId}
        title="Comments"
        // Nothing on an ORG page changes it from here; read the votes again.
        onPageChanged={load}
        {...(compose ? { compose } : {})}
        onAccess={setAccess}
      />
    </section>
  )
}
