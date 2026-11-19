import { useEffect, useId, useState } from 'react'
import { useOrgAuth } from '#/lib/auth'
import {
  article,
  capitalised,
  fetchConnections,
  MAX_CONNECTION_CONTACT_ROWS,
  saveConnectionSettings,
} from '#/lib/connections-api'
import type {
  ConnectionsOverview,
  ConnectionTerms,
  OpenTo,
} from '#/lib/connections-api'
import type { ContactEntry } from '#/lib/membership-api'
import { ConnectionLists } from './ConnectionLists'
import { ContactRows } from './ContactRows'
import { buttonStyle, primaryStyle } from './editor-styles'
import { useOwnerAction } from './use-owner-action'

export const SESSION_EXPIRED = 'Your sign-in session has expired.'

const boxStyle =
  'mt-6 border border-[rgba(236,226,196,0.16)] bg-[rgba(11,13,18,0.85)] p-6'

/** What a connection is, in the admins' name for it. */
export function explained(terms: ConnectionTerms) {
  return `${capitalised(article(terms.singular))} ${terms.singular} asks a member to share contact details with you. If they accept, each of you sees the other's contact details, including the ones kept for connections only. Nothing else changes: your page stays exactly as visible as it is. ORG's private backup contacts are never shared.`
}

export function openToOptions(terms: ConnectionTerms) {
  return [
    {
      value: 'any-member' as const,
      label: 'Any member',
      hint: `Every member with an approved page may send you ${terms.plural}.`,
    },
    {
      value: 'public-members' as const,
      label: 'Public members only',
      hint: 'Only members whose own page is Public.',
    },
    {
      value: 'nobody' as const,
      label: 'Nobody',
      hint: `No one can send you ${terms.plural}. You can still send them, and answer the ones already waiting.`,
    },
  ]
}

export const DEFAULT_FOLLOWS_PAGE =
  'Until you choose, this follows your page: nobody for a Private page, any member for every other page.'
export const CONTACTS_EXPLAINED =
  'Shown only to members you are connected with, never on your page. Your page’s own contact details are shared with them too.'
export const SAVED = 'Saved.'

/** For a Private member: their page cannot be found, so nobody can ask. */
export function PRIVATE_PAGE_NOTE(terms: ConnectionTerms) {
  return `Your page is Private, so nobody can find it, and nobody can send you ${terms.plural}. They happen only when you send one, to a member whose page is Public. This setting applies if you make your page visible.`
}

/**
 * "Who may send me requests" and the contact rows kept for connections,
 * each saved on its own.
 */
function Preferences({
  overview,
  terms,
  onChanged,
}: {
  overview: ConnectionsOverview
  terms: ConnectionTerms
  onChanged: () => void
}) {
  const [openTo, setOpenTo] = useState<OpenTo>(overview.me.openTo)
  const [contacts, setContacts] = useState<Array<ContactEntry>>(
    overview.me.contacts,
  )
  const [saved, setSaved] = useState<string>()
  const action = useOwnerAction()
  const id = useId()

  const save = async (change: Parameters<typeof saveConnectionSettings>[1]) => {
    setSaved(undefined)
    const answer = await action.run((token) =>
      saveConnectionSettings(token, change),
    )
    if (answer === undefined) return
    setSaved(SAVED)
    onChanged()
  }

  return (
    <>
      <form
        className={boxStyle}
        onSubmit={(event) => {
          event.preventDefault()
          void save({ openTo })
        }}
      >
        <fieldset>
          <legend className="text-lg text-[#f6efd9]">
            Who may send you {terms.plural}
          </legend>
          {overview.me.visibility === 'unlisted' && (
            <p className="mt-1 text-xs text-[#f1d78a]">
              {PRIVATE_PAGE_NOTE(terms)}
            </p>
          )}
          {!overview.me.openToChosen && (
            <p className="mt-1 text-xs text-[#9f9676]">
              {DEFAULT_FOLLOWS_PAGE}
            </p>
          )}
          {openToOptions(terms).map((option) => (
            <div key={option.value} className="mt-3 flex items-start gap-3">
              <input
                id={`${id}-${option.value}`}
                type="radio"
                name={`${id}-open-to`}
                value={option.value}
                checked={openTo === option.value}
                onChange={() => setOpenTo(option.value)}
                aria-describedby={`${id}-${option.value}-hint`}
                className="mt-1 h-4 w-4 accent-[#9dcf83]"
              />
              <div>
                <label
                  htmlFor={`${id}-${option.value}`}
                  className="text-sm text-[#f6efd9]"
                >
                  {option.label}
                </label>
                <p
                  id={`${id}-${option.value}-hint`}
                  className="text-xs leading-6 text-[#9f9676]"
                >
                  {option.hint}
                </p>
              </div>
            </div>
          ))}
        </fieldset>
        <button type="submit" className={primaryStyle} disabled={action.busy}>
          Save
        </button>
      </form>

      <form
        className={boxStyle}
        onSubmit={(event) => {
          event.preventDefault()
          void save({ contacts })
        }}
      >
        <h2 className="text-lg text-[#f6efd9]">
          Contact details for your connections
        </h2>
        <p className="mb-3 mt-1 text-xs text-[#9f9676]">{CONTACTS_EXPLAINED}</p>
        <ContactRows
          label="Contact for connections"
          rows={contacts}
          onChange={setContacts}
          max={MAX_CONNECTION_CONTACT_ROWS}
        />
        <button type="submit" className={primaryStyle} disabled={action.busy}>
          Save contact details
        </button>
      </form>
      {action.problem && (
        <p role="alert" className="mt-4 text-sm text-[#f1a07a]">
          {action.problem}
        </p>
      )}
      {saved && (
        <p role="status" className="mt-4 text-sm text-[#9dcf83]">
          {saved}
        </p>
      )}
    </>
  )
}

/**
 * `/settings/connections` (Chunk 18): who may send the member requests,
 * the contact rows kept for connections, and the four lists. There is no
 * sending by address: a page a member cannot see is never reachable. Every name on it is the admins' name for the feature.
 */
export function ConnectionsSettings() {
  const auth = useOrgAuth()
  const [overview, setOverview] = useState<ConnectionsOverview>()
  const [loadError, setLoadError] = useState<string>()
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    const closed = new AbortController()
    setLoadError(undefined)
    void (async () => {
      try {
        const token = await auth.getToken()
        if (!token) throw new Error(SESSION_EXPIRED)
        const answer = await fetchConnections(token)
        if (!closed.signal.aborted) setOverview(answer)
      } catch (err) {
        if (closed.signal.aborted) return
        setLoadError(err instanceof Error ? err.message : 'That did not load.')
      }
    })()
    return () => closed.abort()
  }, [auth, attempt])

  const reload = () => setAttempt((n) => n + 1)

  if (loadError) {
    return (
      <div className={boxStyle}>
        <p role="alert" className="text-sm text-[#f1a07a]">
          {loadError}
        </p>
        <button type="button" className={buttonStyle} onClick={reload}>
          Try again
        </button>
      </div>
    )
  }
  if (!overview) {
    return (
      <p className="mt-6 font-mono text-[10px] uppercase tracking-[0.2em] text-[#9f9676]">
        Loading…
      </p>
    )
  }
  const terms = overview.terms
  return (
    <>
      <p className="mt-4 max-w-2xl text-sm leading-7 text-[#b8ad8d]">
        {explained(terms)}
      </p>
      {!overview.me.eligible && (
        <p role="note" className="mt-4 text-sm text-[#f1d78a]">
          Only members with an approved page can send or receive {terms.plural}.
        </p>
      )}
      {overview.me.eligible && (
        <>
          <p className="mt-4 text-xs text-[#9f9676]">
            {overview.me.pendingSent} of {overview.me.maxPendingSent}{' '}
            {terms.plural} you sent are waiting for an answer.
          </p>
          <Preferences overview={overview} terms={terms} onChanged={reload} />
        </>
      )}
      <ConnectionLists overview={overview} terms={terms} onChanged={reload} />
    </>
  )
}
