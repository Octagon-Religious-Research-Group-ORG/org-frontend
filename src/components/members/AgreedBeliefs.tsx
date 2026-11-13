import { useEffect, useRef, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { useOrgAuth } from '#/lib/auth'
import { postComment } from '#/lib/comments-api'
import { fetchAgreedBeliefs } from '#/lib/votes-api'
import type { AgreedBelief, AgreedPage, VoteValue } from '#/lib/votes-api'
import type { CommentAccess } from './VoteButtons'
import { BELIEF_ANCHOR } from './BeliefTabs'
import { CommentForm } from './CommentForm'
import { WRITE_BLOCK_NOTES } from './CommentThread'
import { buttonStyle } from './editor-styles'
import { Paragraphs } from './Paragraphs'
import { useOwnerAction } from './use-owner-action'
import { STANCE_LABEL, VoteButtons } from './VoteButtons'

export const AGREED_HEADING = "Members' beliefs agreed by 2 or more members"

/**
 * A page that came back empty but says there is more (every belief it
 * looked at was on a page this reader may not read) is followed this many
 * more times before the list says so (fix round 1, LOW 2).
 */
export const EMPTY_PAGES_FOLLOWED = 3

/** New entries after the ones shown; an entry already shown is not repeated. */
export function appendUnique(
  shown: ReadonlyArray<AgreedBelief>,
  more: ReadonlyArray<AgreedBelief>,
) {
  const seen = new Set(shown.map((belief) => belief.tabId))
  return [...shown, ...more.filter((belief) => !seen.has(belief.tabId))]
}

const SESSION_UNCONFIRMED =
  "We couldn't confirm that you're signed in. Please try again."

/**
 * Below the Beliefs page's own text (Chunk 10, Tripp Q04: "2+ is all it
 * takes"): every member belief at least two members agree with, on its
 * current wording, that this reader may read. Most agrees first, then
 * newest; ten at a time. Voting and commenting work right here.
 *
 * Read in the browser, with the reader's token when signed in: who may see
 * which belief, and their own votes, depend on who asks.
 */
export function AgreedBeliefs() {
  const auth = useOrgAuth()
  const [beliefs, setBeliefs] = useState<Array<AgreedBelief>>()
  const [nextAfter, setNextAfter] = useState<string>()
  const [loading, setLoading] = useState(false)
  const [problem, setProblem] = useState<string>()
  // Replaced by the list's own answer with the first page.
  const [comment, setComment] = useState<CommentAccess>({ mayComment: false })
  const [reworded, setReworded] = useState<ReadonlySet<string>>(new Set())
  const generation = useRef(0)

  const load = async (after?: string) => {
    const run = ++generation.current
    setLoading(true)
    try {
      const token = auth.isAuthenticated ? await auth.getToken() : undefined
      if (auth.isAuthenticated && !token) throw new Error(SESSION_UNCONFIRMED)
      let page: AgreedPage = await fetchAgreedBeliefs({ after, token })
      const found = [...page.beliefs]
      for (
        let followed = 0;
        found.length === 0 && page.nextAfter && followed < EMPTY_PAGES_FOLLOWED;
        followed++
      ) {
        page = await fetchAgreedBeliefs({ after: page.nextAfter, token })
        found.push(...page.beliefs)
      }
      if (run !== generation.current) return
      setBeliefs((shown) =>
        // "Show more" exists only once a first page is shown.
        after ? appendUnique(shown as Array<AgreedBelief>, found) : found,
      )
      setNextAfter(page.nextAfter)
      setComment(
        page.viewerMayComment
          ? { mayComment: true }
          : {
              mayComment: false,
              reason: WRITE_BLOCK_NOTES[page.viewerWriteBlock ?? 'sign-in'],
            },
      )
      setProblem(undefined)
    } catch (err) {
      if (run !== generation.current) return
      setProblem(
        err instanceof Error ? err.message : 'This list is unavailable.',
      )
    } finally {
      if (run === generation.current) setLoading(false)
    }
  }

  useEffect(() => {
    if (auth.isLoading) return
    void load()
    return () => {
      generation.current++
    }
  }, [auth])

  return (
    <section
      aria-labelledby="agreed-beliefs-heading"
      aria-busy={loading}
      className="mx-auto mt-12 max-w-[860px]"
    >
      <h2
        id="agreed-beliefs-heading"
        className="text-2xl font-light uppercase tracking-[0.06em] text-[#f6efd9]"
      >
        {AGREED_HEADING}
      </h2>
      <p className="mt-2 text-sm text-[#b8ad8d]">
        A member’s belief appears here once two members agree with its current
        wording. Disagreeing votes are shown too.
      </p>
      {problem && (
        <p role="alert" className="mt-3 text-sm text-[#f1a07a]">
          {problem}
        </p>
      )}
      {beliefs === undefined && !problem ? (
        <p role="status" className="mt-3 text-sm text-[#b8ad8d]">
          Opening the list…
        </p>
      ) : beliefs?.length === 0 ? (
        <p className="mt-3 text-sm text-[#b8ad8d]">
          {nextAfter
            ? 'None of the beliefs looked at so far are ones you can read. There are more to look at.'
            : 'No member belief has two agreeing votes yet.'}
        </p>
      ) : (
        <ol className="mt-4 flex flex-col gap-8">
          {beliefs?.map((belief) => (
            <AgreedEntry
              key={belief.tabId}
              belief={belief}
              comment={comment}
              reworded={reworded.has(belief.tabId)}
              onVotes={(votes) =>
                setBeliefs((all) =>
                  all?.map((entry) =>
                    entry.tabId === belief.tabId ? { ...entry, votes } : entry,
                  ),
                )
              }
              // Already loaded pages stay; this entry says it changed.
              onReworded={() =>
                setReworded((all) => new Set([...all, belief.tabId]))
              }
            />
          ))}
        </ol>
      )}
      {nextAfter && (
        <button
          type="button"
          disabled={loading}
          onClick={() => void load(nextAfter)}
          className={buttonStyle}
        >
          Show more beliefs
        </button>
      )}
    </section>
  )
}

function AgreedEntry({
  belief,
  comment,
  reworded,
  onVotes,
  onReworded,
}: {
  belief: AgreedBelief
  /** From the list's answer: whether this reader may comment, and why not. */
  comment: CommentAccess
  reworded: boolean
  onVotes: (votes: AgreedBelief['votes']) => void
  onReworded: () => void
}) {
  const [compose, setCompose] = useState<{
    stance?: VoteValue
    nonce: number
  }>()
  const [posted, setPosted] = useState(false)
  const writer = useOwnerAction()

  const post = async (body: string) => {
    const saved = await writer.run((token) =>
      postComment(token, {
        slug: belief.slug,
        tabId: belief.tabId,
        body,
        ...(compose?.stance ? { stance: compose.stance } : {}),
      }),
    )
    if (saved === undefined) return false
    setCompose(undefined)
    setPosted(true)
    return true
  }

  const link = (
    <Link
      to="/$slug"
      params={{ slug: belief.slug }}
      hash={`${BELIEF_ANCHOR}${belief.tabId}`}
      className="underline underline-offset-4"
    >
      Open this belief on {belief.author.displayName}’s page
    </Link>
  )

  return (
    <li className="border-t border-[rgba(236,226,196,0.16)] pt-5">
      <article aria-label={belief.title}>
        <h3 className="text-xl font-light text-[#f6efd9] [overflow-wrap:anywhere]">
          {belief.title}
        </h3>
        <p className="mt-1 text-sm text-[#b8ad8d]">
          By{' '}
          <Link
            to="/$slug"
            params={{ slug: belief.author.slug }}
            className="text-[#f6efd9] underline underline-offset-4 [overflow-wrap:anywhere]"
          >
            {belief.author.displayName}
          </Link>
        </p>
        <div className="mt-2">
          <Paragraphs paragraphs={belief.paragraphs} />
        </div>
        {reworded && (
          <p role="status" className="mt-2 text-xs text-[#f1d78a]">
            This belief was reworded since the list was read. Open it on the
            member’s page to read and vote on the new wording.
          </p>
        )}
        <VoteButtons
          slug={belief.slug}
          tabId={belief.tabId}
          title={belief.title}
          textSeq={belief.textSeq}
          votes={belief.votes}
          comment={comment}
          onVotes={(answer) => {
            onVotes(answer.votes)
            // An open "…and comment" form follows the vote as it is now.
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
            if (answer.textSeq !== belief.textSeq) onReworded()
          }}
          onCompose={(stance) =>
            setCompose((last) => ({
              ...(stance ? { stance } : {}),
              nonce: (last?.nonce ?? 0) + 1,
            }))
          }
        />
        {compose && (
          <CommentForm
            label={`Comment on “${belief.title}”`}
            submitLabel="Post comment"
            busy={writer.busy}
            onSubmit={post}
            onCancel={() => setCompose(undefined)}
            focusKey={compose.nonce}
            note={
              compose.stance && (
                <p className="mt-2 text-xs text-[#ece2c4]">
                  Your comment will show “{STANCE_LABEL[compose.stance]}”, as
                  your vote says.
                </p>
              )
            }
          />
        )}
        {writer.problem && (
          <p role="alert" className="mt-2 text-sm text-[#f1a07a]">
            {writer.problem}
          </p>
        )}
        {posted && (
          <p role="status" className="mt-2 text-sm text-[#ece2c4]">
            Your comment is posted. {link}
          </p>
        )}
        <p className="mt-3 text-sm text-[#b8ad8d]">{link}</p>
      </article>
    </li>
  )
}
