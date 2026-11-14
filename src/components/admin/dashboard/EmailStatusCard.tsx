import { adminTime } from '#/lib/admin-api'
import { fetchNotificationStatus } from '#/lib/notifications-api'
import { cardStyle, LoadState, noteStyle, useAdminLoad } from './admin-shared'

export const BUDGET_EXPLAINED =
  'ORG has one free email account for the test site and the live site together: 100 emails a day, 3,000 a month. Each site keeps to its own share; part of it is kept for claim and moderation emails, and the daily summaries stop short of that. What does not fit goes out the next day.'
export const NOT_SENDING =
  'Emails are not being sent: the email service is not set up on this server. Notifications are kept, and expire after 30 days.'

/** Email delivery today (Chunk 14), in the dashboard's Settings. */
export function EmailStatusCard() {
  const status = useAdminLoad(fetchNotificationStatus, 'email-status')
  return (
    <div className={`${cardStyle} mt-6`}>
      <h3 className="text-lg text-[#f6efd9]">Email notifications</h3>
      <p className={noteStyle}>{BUDGET_EXPLAINED}</p>
      <LoadState
        denied={status.denied}
        error={status.error}
        loading={!status.data}
        onRetry={status.reload}
      >
        {status.data && !status.data.enabled && (
          <p role="alert" className="mt-3 text-sm text-[#f1a07a]">
            {NOT_SENDING}
          </p>
        )}
        {status.data && (
          <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm text-[#ece2c4]">
            <dt>Sent today (UTC)</dt>
            <dd>
              {status.data.budget.sent} of {status.data.budget.dailyLimit} (
              {status.data.budget.immediateReserve} kept for claims and
              moderation)
            </dd>
            {status.data.budget.limitHitAt && (
              <>
                <dt>Limit reached</dt>
                <dd className="text-[#f1a07a]">
                  {adminTime(status.data.budget.limitHitAt)}: the rest waits for
                  tomorrow
                </dd>
              </>
            )}
            <dt>Waiting</dt>
            <dd>
              {status.data.waiting.digest} for the daily summary,{' '}
              {status.data.waiting.immediate} to send now,{' '}
              {status.data.waiting.adminNotices} admin notices
            </dd>
            <dt>Failed (7 days)</dt>
            <dd>{status.data.failedLast7Days}</dd>
            <dt>Daily summary</dt>
            <dd>from {status.data.digestHourUtc}:00 UTC</dd>
          </dl>
        )}
      </LoadState>
    </div>
  )
}
