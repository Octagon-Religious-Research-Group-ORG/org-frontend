import { Link } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import {
  answerConnection,
  blockMember,
  capitalised,
  unblockMember,
} from '#/lib/connections-api'
import type {
  ConnectionsOverview,
  ConnectionTerms,
  MemberCard,
} from '#/lib/connections-api'
import { SharedContacts } from './ConnectionButton'
import { buttonStyle, dangerStyle, primaryStyle } from './editor-styles'
import { ReportButton } from './ReportButton'
import { useOwnerAction } from './use-owner-action'

const boxStyle =
  'mt-6 border border-[rgba(236,226,196,0.16)] bg-[rgba(11,13,18,0.85)] p-6'

/** A member's name, linked only when the server gave their page's address. */
export function MemberName({ member }: { member: MemberCard }) {
  return member.slug ? (
    <Link
      to="/$slug"
      params={{ slug: member.slug }}
      className="text-[#f6efd9] underline underline-offset-4"
    >
      {member.name}
    </Link>
  ) : (
    <span className="text-[#f6efd9]">{member.name}</span>
  )
}

const day = (iso: string) => iso.slice(0, 10)

function List({
  title,
  empty,
  children,
}: {
  title: string
  empty: boolean
  children: ReactNode
}) {
  return (
    <section aria-label={title} className={boxStyle}>
      <h2 className="text-lg text-[#f6efd9]">{title}</h2>
      {empty ? (
        <p className="mt-2 text-sm text-[#9f9676]">None.</p>
      ) : (
        <ul className="mt-3 flex flex-col gap-5">{children}</ul>
      )}
    </section>
  )
}

/**
 * The four lists of `/settings/connections` (Chunk 18), each row with its
 * own actions. After any action the page reloads the lists from the server.
 */
export function ConnectionLists({
  overview,
  terms,
  onChanged,
}: {
  overview: ConnectionsOverview
  terms: ConnectionTerms
  onChanged: () => void
}) {
  const action = useOwnerAction()
  const act = async (work: (token: string) => Promise<unknown>) => {
    const answer = await action.run(work)
    if (answer !== undefined) onChanged()
  }
  const block = (connectionId: string, name: string) => (
    <button
      type="button"
      aria-label={`Block ${name}`}
      className={dangerStyle}
      disabled={action.busy}
      onClick={() => void act((token) => blockMember(token, { connectionId }))}
    >
      Block
    </button>
  )

  return (
    <>
      {action.problem && (
        <p role="alert" className="mt-4 text-sm text-[#f1a07a]">
          {action.problem}
        </p>
      )}

      <List
        title={`${capitalised(terms.plural)} you received`}
        empty={overview.incoming.length === 0}
      >
        {overview.incoming.map((row) => (
          <li key={row.id}>
            <p className="text-sm text-[#d8ceb0]">
              <MemberName member={row.member} /> · {day(row.sentAt)}
            </p>
            {row.note && (
              <p className="mt-1 whitespace-pre-wrap text-sm text-[#b8ad8d] [overflow-wrap:anywhere]">
                {row.note}
              </p>
            )}
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                aria-label={`Accept ${row.member.name}`}
                className={primaryStyle}
                disabled={action.busy}
                onClick={() =>
                  void act((token) => answerConnection(token, row.id, 'accept'))
                }
              >
                Accept
              </button>
              <button
                type="button"
                aria-label={`Decline ${row.member.name}`}
                className={buttonStyle}
                disabled={action.busy}
                onClick={() =>
                  void act((token) =>
                    answerConnection(token, row.id, 'decline'),
                  )
                }
              >
                Decline
              </button>
              {block(row.id, row.member.name)}
            </div>
            {row.note && (
              <ReportButton
                target={{ targetType: 'connection-note', connectionId: row.id }}
                label={`Report the note from ${row.member.name}`}
                text="Report this note"
              />
            )}
          </li>
        ))}
      </List>

      <List
        title={`${capitalised(terms.plural)} you sent`}
        empty={overview.outgoing.length === 0}
      >
        {overview.outgoing.map((row) => (
          <li key={row.id}>
            <p className="text-sm text-[#d8ceb0]">
              <MemberName member={row.member} /> · {day(row.sentAt)}
              {row.unavailable && (
                <span className="text-[#f1a07a]"> · no longer available</span>
              )}
            </p>
            {row.note && (
              <p className="mt-1 whitespace-pre-wrap text-sm text-[#b8ad8d] [overflow-wrap:anywhere]">
                {row.note}
              </p>
            )}
            <button
              type="button"
              aria-label={`Withdraw your ${terms.singular} to ${row.member.name}`}
              className={buttonStyle}
              disabled={action.busy}
              onClick={() =>
                void act((token) => answerConnection(token, row.id, 'withdraw'))
              }
            >
              Withdraw
            </button>
          </li>
        ))}
      </List>

      <List title="Connected" empty={overview.connected.length === 0}>
        {overview.connected.map((row) => (
          <li key={row.id}>
            <p className="text-sm text-[#d8ceb0]">
              <MemberName member={row.member} /> · since {day(row.since)}
            </p>
            <SharedContacts
              contacts={row.contacts}
              title={`Contact details of ${row.member.name}`}
            />
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                aria-label={`Disconnect from ${row.member.name}`}
                className={buttonStyle}
                disabled={action.busy}
                onClick={() =>
                  void act((token) =>
                    answerConnection(token, row.id, 'disconnect'),
                  )
                }
              >
                Disconnect
              </button>
              {block(row.id, row.member.name)}
            </div>
          </li>
        ))}
      </List>

      <List title="Blocked" empty={overview.blocked.length === 0}>
        {overview.blocked.map((row) => (
          <li key={row.id}>
            <p className="text-sm text-[#d8ceb0]">
              <MemberName member={row.member} /> · since {day(row.since)}
            </p>
            <button
              type="button"
              aria-label={`Unblock ${row.member.name}`}
              className={buttonStyle}
              disabled={action.busy}
              onClick={() => void act((token) => unblockMember(token, row.id))}
            >
              Unblock
            </button>
          </li>
        ))}
      </List>
    </>
  )
}
