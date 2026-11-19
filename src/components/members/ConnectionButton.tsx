import { Link } from '@tanstack/react-router'
import { useCallback, useEffect, useId, useState } from 'react'
import type { ReactNode } from 'react'
import { useOrgAuth } from '#/lib/auth'
import {
  answerConnection,
  article,
  blockMember,
  capitalised,
  fetchRelation,
  MAX_CONNECTION_NOTE_LENGTH,
  sendConnectionRequest,
  unblockMember,
} from '#/lib/connections-api'
import type {
  ConnectionTerms,
  Relation,
  RelationReason,
} from '#/lib/connections-api'
import { CONTACT_METHODS } from '#/lib/membership-api'
import type { ContactEntry } from '#/lib/membership-api'
import { CharacterCount } from './CharacterCount'
import {
  buttonStyle,
  dangerStyle,
  fieldStyle,
  labelStyle,
  primaryStyle,
} from './editor-styles'
import { useConnectionTerms } from './use-connection-terms'
import { useOwnerAction } from './use-owner-action'

/** Why a request cannot be sent, in the admins' name for it. */
export function reasonText(
  reason: RelationReason,
  terms: ConnectionTerms,
  until?: string,
) {
  switch (reason) {
    case 'not-eligible':
      return `Only members with an approved page can send ${terms.plural}.`
    case 'private-needs-public':
      return `Your page is Private, so you can send ${terms.plural} only to members whose page is Public.`
    case 'cooldown':
      return `This member did not accept your last ${terms.singular}. You can send another after ${until?.slice(0, 10) ?? 'a while'}.`
    case 'limit':
      return `You have too many ${terms.plural} waiting for an answer. Withdraw one, or wait for answers, before sending another.`
    default:
      return `This member is not open to ${terms.plural} from you.`
  }
}

export const BLOCK_EXPLAINED =
  'They will not be told. Neither of you can send the other a request while the block stands, and anything between you ends now.'

function methodLabel(method: string) {
  return CONTACT_METHODS.find((entry) => entry.value === method)?.label
}

/** Contact rows a connection shares: the page's and the private ones. */
export function SharedContacts({
  contacts,
  title,
}: {
  contacts: Array<ContactEntry>
  title: string
}) {
  if (contacts.length === 0) {
    return (
      <p className="mt-2 text-xs text-[#9f9676]">
        This member has not added any contact details yet.
      </p>
    )
  }
  return (
    <section aria-label={title} className="mt-3">
      <h3 className="font-mono text-[10px] uppercase tracking-[0.28em] text-[#9f9676]">
        {title}
      </h3>
      <ul className="mt-2 flex flex-col gap-1 text-sm text-[#d8ceb0]">
        {contacts.map((contact, index) => (
          <li key={`${contact.method}-${contact.value}-${index}`}>
            <span className="mr-2 text-[#78aea2]">
              {methodLabel(contact.method)}
            </span>
            <span className="[overflow-wrap:anywhere]">{contact.value}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}

/**
 * The connection request button on a member's page (Chunk 18): send one
 * with a note, see where it stands, answer one, see a connection's contact
 * details, block or unblock. The server decides everything; this only shows
 * its answer. Nothing is shown on a page the reader cannot see, and a block
 * made against the reader reads as "not open".
 */
export function ConnectionButton({
  slug,
  displayName,
}: {
  slug: string
  displayName: string
}) {
  const terms = useConnectionTerms()
  const auth = useOrgAuth()
  const [relation, setRelation] = useState<Relation>()
  const [attempt, setAttempt] = useState(0)
  const [writing, setWriting] = useState(false)
  const [blocking, setBlocking] = useState(false)
  const [note, setNote] = useState('')
  const [done, setDone] = useState<string>()
  const action = useOwnerAction()
  const id = useId()

  useEffect(() => {
    const closed = new AbortController()
    void (async () => {
      try {
        const token = await auth.getToken()
        if (!token) return
        const answer = await fetchRelation(token, slug)
        if (!closed.signal.aborted) setRelation(answer)
      } catch {
        // A page this reader cannot see, or no answer: no button at all.
      }
    })()
    return () => closed.abort()
  }, [auth, slug, attempt])

  const reload = useCallback(() => setAttempt((n) => n + 1), [])
  const act = async (
    work: (token: string) => Promise<unknown>,
    said: string,
  ) => {
    setDone(undefined)
    const answer = await action.run(work)
    if (answer === undefined) return
    setDone(said)
    setWriting(false)
    setBlocking(false)
    setNote('')
    reload()
  }

  if (!relation || relation.state === 'self') return null
  const one = `${article(terms.singular)} ${terms.singular}`
  const status = done && (
    <p role="status" className="mt-2 text-sm text-[#9dcf83]">
      {done}
    </p>
  )
  const problem = action.problem && (
    <p role="alert" className="mt-2 text-sm text-[#f1a07a]">
      {action.problem}
    </p>
  )
  const blockControls =
    relation.state !== 'blocked' &&
    (blocking ? (
      <div className="mt-3 max-w-xl">
        <p className="text-xs text-[#b8ad8d]">{BLOCK_EXPLAINED}</p>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            className={dangerStyle}
            disabled={action.busy}
            onClick={() =>
              void act(
                (token) => blockMember(token, { slug }),
                `You blocked ${displayName}.`,
              )
            }
          >
            Block {displayName}
          </button>
          <button
            type="button"
            className={buttonStyle}
            onClick={() => setBlocking(false)}
          >
            Cancel
          </button>
        </div>
      </div>
    ) : (
      <button
        type="button"
        className={buttonStyle}
        onClick={() => setBlocking(true)}
      >
        Block…
      </button>
    ))

  let body: ReactNode
  switch (relation.state) {
    case 'blocked':
      body = (
        <>
          <p className="text-sm text-[#d8ceb0]">You blocked this member.</p>
          <button
            type="button"
            className={buttonStyle}
            disabled={action.busy}
            onClick={() =>
              void act(
                (token) => unblockMember(token, relation.blockId),
                `You unblocked ${displayName}.`,
              )
            }
          >
            Unblock
          </button>
        </>
      )
      break
    case 'connected':
      body = (
        <>
          <p className="text-sm text-[#9dcf83]">You are connected.</p>
          <SharedContacts
            contacts={relation.contacts}
            title="Contact details for connections"
          />
          <button
            type="button"
            className={buttonStyle}
            disabled={action.busy}
            onClick={() =>
              void act(
                (token) => answerConnection(token, relation.id, 'disconnect'),
                `You are no longer connected with ${displayName}.`,
              )
            }
          >
            Disconnect
          </button>
        </>
      )
      break
    case 'outgoing':
      body = (
        <>
          <p className="text-sm text-[#d8ceb0]">
            {capitalised(terms.singular)} sent. Waiting for an answer.
          </p>
          <button
            type="button"
            className={buttonStyle}
            disabled={action.busy}
            onClick={() =>
              void act(
                (token) => answerConnection(token, relation.id, 'withdraw'),
                `You withdrew your ${terms.singular}.`,
              )
            }
          >
            Withdraw
          </button>
        </>
      )
      break
    case 'incoming':
      body = (
        <>
          <p className="text-sm text-[#d8ceb0]">
            This member sent you {one}.{' '}
            <Link
              to="/settings/connections"
              className="text-[#f1d78a] underline underline-offset-4"
            >
              See it with its note
            </Link>
          </p>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              className={primaryStyle}
              disabled={action.busy}
              onClick={() =>
                void act(
                  (token) => answerConnection(token, relation.id, 'accept'),
                  'You are now connected.',
                )
              }
            >
              Accept
            </button>
            <button
              type="button"
              className={buttonStyle}
              disabled={action.busy}
              onClick={() =>
                void act(
                  (token) => answerConnection(token, relation.id, 'decline'),
                  `You declined the ${terms.singular}.`,
                )
              }
            >
              Decline
            </button>
          </div>
        </>
      )
      break
    default:
      body = relation.canRequest ? (
        writing ? (
          <form
            aria-label={`Send ${one} to ${displayName}`}
            className="max-w-xl"
            onSubmit={(event) => {
              event.preventDefault()
              void (async () => {
                setDone(undefined)
                const answer = await action.run((token) =>
                  sendConnectionRequest(token, slug, note),
                )
                if (answer === undefined) return
                setDone(
                  answer.status === 'accepted'
                    ? `${displayName} had already sent you ${one}, so you are now connected.`
                    : `${capitalised(terms.singular)} sent.`,
                )
                setWriting(false)
                setNote('')
                reload()
              })()
            }}
          >
            <label htmlFor={`${id}-note`} className={labelStyle}>
              A note (optional)
            </label>
            <textarea
              id={`${id}-note`}
              rows={3}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              aria-describedby={`${id}-count`}
              className={fieldStyle}
            />
            <CharacterCount
              id={`${id}-count`}
              value={note}
              max={MAX_CONNECTION_NOTE_LENGTH}
            />
            <div className="flex flex-wrap gap-3">
              <button
                type="submit"
                className={primaryStyle}
                disabled={
                  action.busy || note.length > MAX_CONNECTION_NOTE_LENGTH
                }
              >
                Send
              </button>
              <button
                type="button"
                className={buttonStyle}
                onClick={() => setWriting(false)}
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <button
            type="button"
            className={primaryStyle}
            onClick={() => setWriting(true)}
          >
            Send {one}
          </button>
        )
      ) : (
        <>
          <button
            type="button"
            className={primaryStyle}
            disabled
            aria-describedby={`${id}-why`}
          >
            Send {one}
          </button>
          <p id={`${id}-why`} className="mt-2 text-xs text-[#9f9676]">
            {reasonText(relation.reason ?? 'not-open', terms, relation.until)}
          </p>
        </>
      )
  }

  return (
    <section
      aria-label={capitalised(terms.plural)}
      className="mt-6 max-w-xl border border-[rgba(236,226,196,0.16)] p-4"
    >
      {body}
      {relation.state === 'none' && relation.reason === 'not-eligible'
        ? null
        : blockControls}
      {problem}
      {status}
    </section>
  )
}
