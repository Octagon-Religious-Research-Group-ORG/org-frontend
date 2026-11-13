import { useState } from 'react'
import { adminTime, fetchModerationLog } from '#/lib/admin-api'
import type { LogEntry } from '#/lib/admin-api'
import {
  LoadState,
  noteStyle,
  Pager,
  sectionHeading,
  useAdminLoad,
} from './admin-shared'

/** Details worth a line on screen; anything else stays in the record. */
const DETAIL_KEYS = [
  'slug',
  'as',
  'from',
  'to',
  'previousStatus',
  'restoredTo',
  'kind',
  'error',
] as const

export function detailText(details: LogEntry['details']) {
  if (!details) return ''
  return DETAIL_KEYS.flatMap((key) =>
    key in details ? [`${key}: ${String(details[key] ?? 'none')}`] : [],
  ).join(' · ')
}

/** The moderation log (Chunk 12): every admin action, newest first. Read-only. */
export function LogSection() {
  const [page, setPage] = useState(1)
  const log = useAdminLoad(
    (token) => fetchModerationLog(token, page),
    String(page),
  )

  return (
    <section aria-labelledby="log-heading">
      <h2 id="log-heading" className={sectionHeading}>
        Moderation log
      </h2>
      <p className={noteStyle}>
        Every admin action, newest first. Entries can never be changed or
        removed.
      </p>
      <LoadState
        denied={log.denied}
        error={log.error}
        loading={!log.data}
        onRetry={log.reload}
      >
        {log.data?.entries.length === 0 && (
          <p className="mt-6 text-sm text-[#9f9676]">Nothing logged yet.</p>
        )}
        <ol className="mt-6 flex flex-col divide-y divide-[rgba(236,226,196,0.12)]">
          {log.data?.entries.map((entry) => (
            <li key={entry.entryId} className="py-3 text-sm">
              <p className="text-[#f6efd9]">
                <span className="font-mono text-xs text-[#9dcf83]">
                  {entry.action}
                </span>{' '}
                · {entry.actorName ?? entry.actorUserId}
              </p>
              <p className="mt-1 text-xs text-[#9f9676] [overflow-wrap:anywhere]">
                {adminTime(entry.at)} · {entry.targetType} {entry.targetId}
                {detailText(entry.details) && ` · ${detailText(entry.details)}`}
              </p>
              <p className="mt-1 text-[#b8ad8d] [overflow-wrap:anywhere]">
                {entry.reason}
              </p>
            </li>
          ))}
        </ol>
        <Pager
          page={page}
          hasMore={log.data?.hasMore ?? false}
          onPage={setPage}
        />
      </LoadState>
    </section>
  )
}
