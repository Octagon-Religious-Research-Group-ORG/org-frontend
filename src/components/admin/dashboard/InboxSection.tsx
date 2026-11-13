import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { useOrgAuth } from '#/lib/auth'
import {
  adminTime,
  fetchInbox,
  markInboxHandled,
  resetEamRequest,
} from '#/lib/admin-api'
import type { InboxEntry, InboxStatus } from '#/lib/admin-api'
import { buttonStyle, primaryStyle } from '#/components/members/editor-styles'
import {
  cardStyle,
  LoadState,
  noteStyle,
  Pager,
  sectionHeading,
  useAdminAction,
  useAdminLoad,
} from './admin-shared'

export const KIND_LABELS: Record<InboxEntry['kind'], string> = {
  'page-submitted': 'New page waiting for approval',
  'eam-request': 'EaM request',
  report: 'Reported',
}

export const OWN_NOTICE =
  'This notice is about you, so another admin handles it.'

/**
 * The admins' inbox (Chunk 12): a new page waiting, or a member asking for
 * EaM. "Notify the admins" happens here for now; emails come in Chunk 14.
 */
export function InboxSection({
  onReviewPages,
  onOpenModeration,
}: {
  onReviewPages: () => void
  /** Opens the moderation queue, for a report notice (Chunk 13). */
  onOpenModeration: () => void
}) {
  const [status, setStatus] = useState<InboxStatus>('open')
  const [page, setPage] = useState(1)
  const inbox = useAdminLoad(
    (token) => fetchInbox(token, status, page),
    `${status}:${page}`,
  )

  return (
    <section aria-labelledby="inbox-heading">
      <h2 id="inbox-heading" className={sectionHeading}>
        Inbox
      </h2>
      <p className={noteStyle}>
        New member pages, EaM requests and reports land here. Mark a notice
        handled once you have dealt with it; approving or rejecting a page, or
        acting on a report in the moderation queue, handles its notice for you.
      </p>
      <div role="tablist" aria-label="Notices" className="mt-4 flex gap-2">
        {(['open', 'handled'] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={tab === status}
            className={tab === status ? primaryStyle : buttonStyle}
            onClick={() => {
              setStatus(tab)
              setPage(1)
            }}
          >
            {tab === 'open' ? 'Open' : 'Handled'}
          </button>
        ))}
      </div>
      <LoadState
        denied={inbox.denied}
        error={inbox.error}
        loading={!inbox.data}
        onRetry={inbox.reload}
      >
        {inbox.data?.entries.length === 0 && (
          <p className="mt-6 text-sm text-[#9f9676]">Nothing here.</p>
        )}
        <ul className="mt-6 flex flex-col gap-4">
          {inbox.data?.entries.map((entry) => (
            <li key={entry.entryId}>
              <InboxCard
                entry={entry}
                onChanged={inbox.reload}
                onReviewPages={onReviewPages}
                onOpenModeration={onOpenModeration}
              />
            </li>
          ))}
        </ul>
        <Pager
          page={page}
          hasMore={inbox.data?.hasMore ?? false}
          onPage={setPage}
        />
      </LoadState>
    </section>
  )
}

/** What a report notice is about, in words. */
export function reportSubject(entry: InboxEntry) {
  const what =
    entry.target?.type === 'member-page' ? 'A member page' : 'A comment'
  return entry.page ? `${what} on ${entry.page.displayName}` : what
}

function InboxCard({
  entry,
  onChanged,
  onReviewPages,
  onOpenModeration,
}: {
  entry: InboxEntry
  onChanged: () => void
  onReviewPages: () => void
  onOpenModeration: () => void
}) {
  const auth = useOrgAuth()
  const action = useAdminAction()
  const own = auth.user?.sub === entry.subjectUserId
  const pageName =
    entry.kind === 'report'
      ? reportSubject(entry)
      : (entry.page?.displayName ?? 'A member without a live page')

  return (
    <article aria-label={KIND_LABELS[entry.kind]} className={cardStyle}>
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#9dcf83]">
        {KIND_LABELS[entry.kind]}
      </p>
      <h3 className="mt-2 text-lg text-[#f6efd9]">
        {entry.page && entry.kind !== 'report' ? (
          <Link
            to="/$slug"
            params={{ slug: entry.page.slug }}
            className="underline underline-offset-4"
          >
            {pageName}
          </Link>
        ) : (
          pageName
        )}
      </h3>
      <p className="mt-1 text-xs text-[#9f9676]">
        {adminTime(entry.createdAt)}
        {entry.handledAt && ` · handled ${adminTime(entry.handledAt)}`}
      </p>
      {entry.note && (
        <p className="mt-3 whitespace-pre-wrap text-sm leading-7 [overflow-wrap:anywhere]">
          {entry.note}
        </p>
      )}
      {action.error && (
        <p role="alert" className="mt-2 text-sm text-[#f1a07a]">
          {action.error}
        </p>
      )}
      {own && <p className="mt-3 text-xs text-[#f1d78a]">{OWN_NOTICE}</p>}
      <div className="flex flex-wrap gap-3">
        {entry.kind === 'page-submitted' &&
          entry.status === 'open' &&
          entry.page?.reviewStatus === 'pending' && (
            <button
              type="button"
              className={primaryStyle}
              onClick={onReviewPages}
            >
              Review waiting pages
            </button>
          )}
        {entry.kind === 'report' && entry.status === 'open' && (
          <button
            type="button"
            className={primaryStyle}
            onClick={onOpenModeration}
          >
            Open the moderation queue
          </button>
        )}
        {!own && entry.status === 'open' && (
          <button
            type="button"
            className={buttonStyle}
            disabled={action.busy}
            onClick={() =>
              void action.run(
                (token) => markInboxHandled(token, entry.entryId),
                onChanged,
                onChanged,
              )
            }
          >
            Mark handled
          </button>
        )}
        {!own && entry.kind === 'eam-request' && entry.blocksNewRequest && (
          <button
            type="button"
            className={buttonStyle}
            disabled={action.busy}
            onClick={() =>
              void action.run(
                (token) => resetEamRequest(token, entry.entryId),
                onChanged,
                onChanged,
              )
            }
          >
            Let them ask again
          </button>
        )}
      </div>
    </article>
  )
}
