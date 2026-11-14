import { useState } from 'react'
import { adminTime, MAX_REMOVAL_REASON_LENGTH } from '#/lib/admin-api'
import {
  fetchDeletedPages,
  fetchPurgeDue,
  restoreDeletedPage,
} from '#/lib/member-data-api'
import type { DeletedPage } from '#/lib/member-data-api'
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

export const RESTORED = (name: string) => `${name} is back on the site.`

const SOURCE_WORDS: Record<DeletedPage['source'], string> = {
  member: 'deleted by the member',
  'account-deleted': 'removed when the account was deleted',
}

/**
 * Deleted pages (Chunk 17): who deleted each one and when, until when ORG
 * keeps it, restore (with a reason, logged), and the purge's dry run.
 */
export function DeletedPagesSection() {
  const [page, setPage] = useState(1)
  const [news, setNews] = useState<string>()
  const list = useAdminLoad(
    (token) => fetchDeletedPages(token, page),
    String(page),
  )
  const due = useAdminLoad(fetchPurgeDue, 'due')

  return (
    <section aria-labelledby="deleted-heading">
      <h2 id="deleted-heading" className={sectionHeading}>
        Deleted pages
      </h2>
      <p className={noteStyle}>
        A deleted page is off the site but kept for five years from its
        deletion. Until then an admin can bring it back. After that its personal
        content is removed for good, and it can no longer be restored.
      </p>
      <div aria-live="polite">
        {news && <p className="mt-3 text-sm text-[#9dcf83]">{news}</p>}
      </div>
      <LoadState
        denied={list.denied}
        error={list.error}
        loading={!list.data}
        onRetry={list.reload}
      >
        {list.data?.pages.length === 0 && (
          <p className="mt-6 text-sm text-[#9f9676]">No deleted pages.</p>
        )}
        <ul className="mt-6 flex flex-col gap-4">
          {list.data?.pages.map((row) => (
            <DeletedRow
              key={row.slug}
              row={row}
              onRestored={() => {
                setNews(RESTORED(row.displayName))
                list.reload()
                due.reload()
              }}
              onStale={list.reload}
            />
          ))}
        </ul>
        <Pager
          page={page}
          hasMore={list.data?.hasMore ?? false}
          onPage={setPage}
        />
      </LoadState>

      <h3 className="mt-10 font-mono text-[11px] uppercase tracking-[0.2em] text-[#9dcf83]">
        Due for the five-year purge
      </h3>
      <LoadState
        denied={due.denied}
        error={due.error}
        loading={!due.data}
        onRetry={due.reload}
      >
        <p className={noteStyle}>
          A dry run: nothing here has been removed. The daily purge removes
          these pages’ personal content, and visitors’ addresses older than{' '}
          {due.data?.retentionYears} years ({due.data?.visitAddresses} now).
        </p>
        {due.data?.pages.length === 0 ? (
          <p className="mt-3 text-sm text-[#9f9676]">Nothing is due.</p>
        ) : (
          <ul className="mt-3 list-disc pl-5 text-sm text-[#d8cfb0]">
            {due.data?.pages.map((row) => (
              <li key={row.slug}>
                {row.displayName} (/{row.slug}), due since{' '}
                {adminTime(row.purgeAfter)}
              </li>
            ))}
          </ul>
        )}
        {(due.data?.accounts.length ?? 0) > 0 && (
          <p className="mt-3 text-sm text-[#d8cfb0]">
            {due.data?.accounts.length} deleted account(s) are due for the
            person-wide purge (their comments, votes and the rest).
          </p>
        )}
        {due.data?.hasMore && (
          <p className="mt-2 text-xs text-[#9f9676]">And more.</p>
        )}
      </LoadState>
    </section>
  )
}

function DeletedRow({
  row,
  onRestored,
  onStale,
}: {
  row: DeletedPage
  onRestored: () => void
  onStale: () => void
}) {
  const action = useAdminAction()
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const restorable = !row.purgedAt && new Date(row.purgeAfter) > new Date()
  const reasonId = `restore-reason-${row.slug}`

  return (
    <li className={cardStyle}>
      <p className="text-[#f6efd9]">
        {row.displayName}{' '}
        <span className="font-mono text-xs text-[#9f9676]">/{row.slug}</span>
      </p>
      <p className="mt-1 text-xs text-[#9f9676] [overflow-wrap:anywhere]">
        {SOURCE_WORDS[row.source]} on {adminTime(row.deletedAt)}
        {row.undoUntil
          ? ` · the member can undo until ${adminTime(row.undoUntil)}`
          : ''}
        {row.purgedAt
          ? ` · purged ${adminTime(row.purgedAt)}`
          : ` · kept until ${adminTime(row.purgeAfter)}`}
        {row.ownerAccountGone ? ' · the owner’s account is gone' : ''}
      </p>
      {restorable && !open && (
        <button
          type="button"
          className={`${buttonStyle} mt-3`}
          onClick={() => setOpen(true)}
        >
          Restore…
        </button>
      )}
      {restorable && open && (
        <form
          className="mt-3"
          onSubmit={(event) => {
            event.preventDefault()
            void action.run(
              (token) => restoreDeletedPage(token, row.slug, reason),
              onRestored,
              onStale,
            )
          }}
        >
          <label htmlFor={reasonId} className="block text-sm text-[#f6efd9]">
            Why are you restoring it? (kept in the log)
          </label>
          {row.ownerAccountGone && (
            <p className="mt-2 text-xs text-[#f1a07a]">
              The owner’s account was deleted. The page comes back with no one
              able to sign in to it, and it is still removed five years after
              the account was deleted.
            </p>
          )}
          <textarea
            id={reasonId}
            value={reason}
            maxLength={MAX_REMOVAL_REASON_LENGTH}
            onChange={(event) => setReason(event.target.value)}
            className="mt-2 w-full border border-[rgba(236,226,196,0.3)] bg-transparent px-3 py-2 text-sm text-[#f6efd9]"
          />
          <div className="mt-3 flex flex-wrap gap-3">
            <button
              type="submit"
              className={primaryStyle}
              disabled={action.busy || reason.trim() === ''}
            >
              Restore the page
            </button>
            <button
              type="button"
              className={buttonStyle}
              onClick={() => setOpen(false)}
            >
              Cancel
            </button>
          </div>
        </form>
      )}
      {action.error && (
        <p role="alert" className="mt-3 text-sm text-[#f1a07a]">
          {action.error}
        </p>
      )}
    </li>
  )
}
