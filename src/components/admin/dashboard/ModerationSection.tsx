import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import {
  adminTime,
  dismissReports,
  fetchModerationQueue,
  MAX_REMOVAL_REASON_LENGTH,
  moderateComment,
} from '#/lib/admin-api'
import type {
  CommentModeration,
  QueueEntry,
  ReportedComment,
  ReportResolution,
  ReportStatus,
} from '#/lib/admin-api'
import { REPORT_REASONS } from '#/lib/comments-api'
import { authorLabel } from '#/components/members/CommentAuthorName'
import {
  buttonStyle,
  dangerStyle,
  fieldStyle,
  labelStyle,
  primaryStyle,
} from '#/components/members/editor-styles'
import { MemberText } from '#/components/members/MemberText'
import {
  cardStyle,
  LoadState,
  noteStyle,
  Pager,
  sectionHeading,
  useAdminAction,
  useAdminLoad,
} from './admin-shared'

export const MODERATION_EXPLAINED =
  'Reports from members, one card per comment or page. Hiding or removing a comment keeps its place in the thread and keeps its text for the admins; restoring undoes either. Every action closes the reports on it and is written to the log.'
export const OWN_CONTENT_NOTE =
  'These reports are about your own words or page: another admin decides.'
/** Review L-2: hiding an accepted suggestion leaves the belief as it is. */
export const ACCEPTED_SUGGESTION_NOTE =
  "This suggestion was accepted, so its wording is already the belief's text. Hiding or removing the suggestion does not change the belief; only the belief's owner can."
export const PAGE_REPORT_NOTE =
  'A page is taken off from the Members section. Removing it there closes these reports.'

const REASON_LABEL = new Map<string, string>(
  REPORT_REASONS.map((reason) => [reason.value, reason.label]),
)

export const RESOLUTION_LABELS: Record<ReportResolution, string> = {
  hidden: 'Hidden',
  removed: 'Removed',
  restored: 'Restored',
  dismissed: 'Dismissed',
  'member-removed': 'Page removed',
}

export const STATE_LABELS = {
  hidden: 'Hidden by a moderator',
  removed: 'Removed by a moderator',
} as const

type Decision = CommentModeration | 'dismiss'

const DECISIONS: Record<
  Decision,
  { label: string; submit: string; danger: boolean }
> = {
  hide: { label: 'Hide…', submit: 'Hide the comment', danger: true },
  remove: { label: 'Remove…', submit: 'Remove the comment', danger: true },
  restore: { label: 'Restore…', submit: 'Restore the comment', danger: false },
  dismiss: {
    label: 'Dismiss the reports…',
    submit: 'Dismiss the reports',
    danger: false,
  },
}

/**
 * The moderation queue (Chunk 13): reported comments and member pages, with
 * the text and where it is, and the moderator's actions.
 */
export function ModerationSection({
  onOpenMember,
}: {
  /** Opens the Members section on a page, where it can be removed. */
  onOpenMember: (slug: string) => void
}) {
  const [status, setStatus] = useState<ReportStatus>('open')
  const [page, setPage] = useState(1)
  const queue = useAdminLoad(
    (token) => fetchModerationQueue(token, status, page),
    `${status}:${page}`,
  )

  return (
    <section aria-labelledby="moderation-heading">
      <h2 id="moderation-heading" className={sectionHeading}>
        Moderation queue
      </h2>
      <p className={noteStyle}>{MODERATION_EXPLAINED}</p>
      <div role="tablist" aria-label="Reports" className="mt-4 flex gap-2">
        {(['open', 'resolved'] as const).map((tab) => (
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
            {tab === 'open' ? 'Open' : 'Closed'}
          </button>
        ))}
      </div>
      <LoadState
        denied={queue.denied}
        error={queue.error}
        loading={!queue.data}
        onRetry={queue.reload}
      >
        {queue.data?.entries.length === 0 && (
          <p className="mt-6 text-sm text-[#9f9676]">Nothing here.</p>
        )}
        <ul className="mt-6 flex flex-col gap-4">
          {queue.data?.entries.map((entry) => (
            <li key={`${entry.targetType}:${entry.targetId}`}>
              <QueueCard
                entry={entry}
                open={status === 'open'}
                onChanged={queue.reload}
                onOpenMember={onOpenMember}
              />
            </li>
          ))}
        </ul>
        <Pager
          page={page}
          hasMore={queue.data?.hasMore ?? false}
          onPage={setPage}
        />
      </LoadState>
    </section>
  )
}

function cardTitle(entry: QueueEntry) {
  if (entry.comment) {
    const what =
      entry.comment.kind === 'suggestion' ? 'Suggested rewording' : 'Comment'
    return `${what} by ${authorLabel(entry.comment.author)}`
  }
  if (entry.page) return `Member page ${entry.page.displayName}`
  return entry.targetType === 'comment'
    ? 'A comment that no longer exists'
    : 'A page that no longer exists'
}

/** Where a reported comment is, with a link to it. */
function Place({ comment }: { comment: ReportedComment }) {
  const place = comment.place
  if (place.kind === 'org-page') {
    return (
      <p className="mt-1 text-xs text-[#9f9676]">
        On ORG’s page{' '}
        <a href={`/${place.pageId}`} className="underline underline-offset-4">
          /{place.pageId}
        </a>
      </p>
    )
  }
  return (
    <p className="mt-1 text-xs text-[#9f9676]">
      On{' '}
      {place.slug ? (
        <Link
          to="/$slug"
          params={{ slug: place.slug }}
          className="underline underline-offset-4"
        >
          {place.displayName}
        </Link>
      ) : (
        'a page that no longer exists'
      )}
      {place.belief
        ? ` · belief “${place.belief.title}”${place.belief.removed ? ' (removed by its owner)' : ''}`
        : ' · About this page'}
    </p>
  )
}

function QueueCard({
  entry,
  open,
  onChanged,
  onOpenMember,
}: {
  entry: QueueEntry
  /** The open list: reports can still be dismissed. */
  open: boolean
  onChanged: () => void
  onOpenMember: (slug: string) => void
}) {
  const action = useAdminAction()
  const [deciding, setDeciding] = useState<Decision>()
  const [reason, setReason] = useState('')
  const comment = entry.comment
  const pageSlug = entry.page?.slug
  const close = () => {
    setDeciding(undefined)
    setReason('')
  }

  const offered: Array<Decision> = []
  if (comment) {
    if (comment.moderation !== 'hidden') offered.push('hide')
    if (comment.moderation !== 'removed') offered.push('remove')
    if (comment.moderation !== null) offered.push('restore')
  }
  if (open) offered.push('dismiss')
  const title = cardTitle(entry)

  return (
    <article aria-label={title} className={cardStyle}>
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#9dcf83]">
        {entry.count === 1 ? '1 report' : `${entry.count} reports`}
        {comment?.moderation && ` · ${STATE_LABELS[comment.moderation]}`}
        {comment?.removedByAuthor && ' · removed by its author'}
      </p>
      <h3 className="mt-2 text-lg text-[#f6efd9]">{title}</h3>
      {comment && (
        <>
          <Place comment={comment} />
          <p className="mt-1 text-xs text-[#9f9676]">
            Posted {adminTime(comment.postedAt)}
            {comment.authorUserId && ` · account ${comment.authorUserId}`}
            {comment.stance && ` · ${comment.stance}`}
          </p>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-7 [overflow-wrap:anywhere]">
            <MemberText text={comment.body} />
          </p>
          {comment.suggestionStatus === 'accepted' && (
            <p className="mt-2 text-xs text-[#f1d78a]">
              {ACCEPTED_SUGGESTION_NOTE}
            </p>
          )}
          {comment.proposedText !== undefined && (
            <p className="mt-2 whitespace-pre-wrap border-l-2 border-[#78aea2] pl-3 text-sm leading-7 [overflow-wrap:anywhere]">
              <MemberText text={comment.proposedText} />
            </p>
          )}
        </>
      )}
      {entry.page && (
        <p className="mt-1 text-xs text-[#9f9676]">
          <Link
            to="/$slug"
            params={{ slug: entry.page.slug }}
            className="underline underline-offset-4"
          >
            /{entry.page.slug}
          </Link>{' '}
          · {entry.page.reviewStatus}
          {entry.page.ownerUserId
            ? ` · account ${entry.page.ownerUserId}`
            : ' · imported, unclaimed'}
        </p>
      )}
      <ol aria-label="Reports" className="mt-3 flex flex-col gap-2">
        {entry.reports.map((report, index) => (
          <li
            key={`${report.reporterUserId}-${report.reportedAt}-${index}`}
            className="text-xs text-[#d8ceb0]"
          >
            <span className="text-[#f1d78a]">
              {REASON_LABEL.get(report.reason) ?? report.reason}
            </span>{' '}
            · by {authorLabel(report.reporter)} ({report.reporterUserId}) ·{' '}
            {adminTime(report.reportedAt)}
            {report.resolution &&
              ` · ${RESOLUTION_LABELS[report.resolution]}${report.resolvedAt ? ` ${adminTime(report.resolvedAt)}` : ''}`}
            {report.note && (
              <span className="mt-1 block whitespace-pre-wrap [overflow-wrap:anywhere]">
                {report.note}
              </span>
            )}
          </li>
        ))}
      </ol>
      {entry.count > entry.reports.length && (
        <p className="mt-1 text-xs text-[#9f9676]">
          Showing the first {entry.reports.length}.
        </p>
      )}
      {action.error && (
        <p role="alert" className="mt-2 text-sm text-[#f1a07a]">
          {action.error}
        </p>
      )}
      {entry.ownContent ? (
        <p className="mt-3 text-xs text-[#f1d78a]">{OWN_CONTENT_NOTE}</p>
      ) : (
        <>
          {entry.page && <p className="mt-3 text-xs">{PAGE_REPORT_NOTE}</p>}
          {!deciding && (
            <div className="flex flex-wrap gap-3">
              {pageSlug !== undefined && (
                <button
                  type="button"
                  className={buttonStyle}
                  onClick={() => onOpenMember(pageSlug)}
                >
                  Open in Members
                </button>
              )}
              {offered.map((decision) => (
                <button
                  key={decision}
                  type="button"
                  className={
                    DECISIONS[decision].danger ? dangerStyle : buttonStyle
                  }
                  disabled={action.busy}
                  onClick={() => setDeciding(decision)}
                >
                  {DECISIONS[decision].label}
                </button>
              ))}
            </div>
          )}
          {deciding && (
            <form
              className="mt-3"
              onSubmit={(event) => {
                event.preventDefault()
                void action.run(
                  (token) =>
                    deciding === 'dismiss'
                      ? dismissReports(
                          token,
                          entry.targetType,
                          entry.targetId,
                          reason,
                        )
                      : moderateComment(
                          token,
                          entry.targetId,
                          deciding,
                          reason,
                        ),
                  () => {
                    close()
                    onChanged()
                  },
                  // A failed write keeps the form and its reason.
                  onChanged,
                )
              }}
            >
              <label
                htmlFor={`reason-${entry.targetType}-${entry.targetId}`}
                className={labelStyle}
              >
                Why (for the admins and the log)
              </label>
              <textarea
                id={`reason-${entry.targetType}-${entry.targetId}`}
                rows={2}
                required
                maxLength={MAX_REMOVAL_REASON_LENGTH}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                className={fieldStyle}
              />
              <div className="flex flex-wrap gap-3">
                <button
                  type="submit"
                  className={
                    DECISIONS[deciding].danger ? dangerStyle : primaryStyle
                  }
                  disabled={action.busy || !reason.trim()}
                >
                  {DECISIONS[deciding].submit}
                </button>
                <button
                  type="button"
                  className={buttonStyle}
                  disabled={action.busy}
                  onClick={close}
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </>
      )}
    </article>
  )
}
