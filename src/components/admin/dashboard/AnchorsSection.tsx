import { useState } from 'react'
import { fetchAnchors, runAnchorsNow } from '#/lib/receipts-api'
import type {
  AnchorRow,
  AnchorRunReport,
  Check,
  CheckOutcome,
} from '#/lib/receipts-api'
import { primaryStyle } from '#/components/members/editor-styles'
import {
  LoadState,
  noteStyle,
  Pager,
  sectionHeading,
  useAdminAction,
  useAdminLoad,
} from './admin-shared'

export const ANCHORS_EXPLAINED =
  'Once a day the server puts every new belief and comment version into one fingerprint (a Merkle root) and has it time-stamped twice: by FreeTSA and by OpenTimestamps (Bitcoin). Every check below is run again each time this page loads. "Cannot check" is never counted as a pass: it means the check could not be made, for example a time-stamp not received yet, or the Bitcoin block itself, which this server has no way to read.'

export const OUTCOME_LABEL: Record<CheckOutcome, string> = {
  pass: 'Pass',
  fail: 'FAIL',
  'cannot-measure': 'Cannot check',
}

const OUTCOME_STYLE: Record<CheckOutcome, string> = {
  pass: 'text-[#78aea2]',
  fail: 'text-[#f1a07a]',
  'cannot-measure': 'text-[#f1d78a]',
}

const CHECKS = [
  ['root', 'Root'],
  ['versions', 'Versions'],
  ['tsa', 'FreeTSA'],
  ['ots', 'OpenTimestamps'],
  ['bitcoin', 'Bitcoin block'],
] as const

function CheckLine({ name, check }: { name: string; check: Check }) {
  return (
    <li className="text-xs leading-5">
      <span className="text-[#9f9676]">{name}: </span>
      <span className={OUTCOME_STYLE[check.outcome]}>
        {OUTCOME_LABEL[check.outcome]}
      </span>
      <span className="text-[#9f9676]"> · {check.detail}</span>
    </li>
  )
}

function when(iso: string) {
  return `${new Date(iso).toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'UTC',
  })} UTC`
}

function AnchorCard({ anchor }: { anchor: AnchorRow }) {
  const answered = anchor.ots.calendars.filter((c) => c.ok).length
  return (
    <li className="border-t border-[rgba(236,226,196,0.12)] py-4">
      <h3 className="font-mono text-sm text-[#f6efd9]">
        {anchor.anchorId} · {anchor.status} · {anchor.leaves} version
        {anchor.leaves === 1 ? '' : 's'}
      </h3>
      {anchor.merkleRoot && (
        <p className="mt-1 font-mono text-[10px] text-[#9f9676] [overflow-wrap:anywhere]">
          Root {anchor.merkleRoot}
        </p>
      )}
      <p className="mt-2 text-xs text-[#d8ceb0]">
        FreeTSA: {anchor.tsa.status ?? 'not started'} after{' '}
        {anchor.tsa.attempts} attempt{anchor.tsa.attempts === 1 ? '' : 's'}
        {anchor.tsa.genTime ? `, stamped ${when(anchor.tsa.genTime)}` : ''}
        {anchor.tsa.nextAttemptAt
          ? `; next try ${when(anchor.tsa.nextAttemptAt)}`
          : ''}
        {anchor.tsa.lastError ? `; last error: ${anchor.tsa.lastError}` : ''}
      </p>
      <p className="mt-1 text-xs text-[#d8ceb0]">
        OpenTimestamps: {anchor.ots.status ?? 'not started'}; {answered} of{' '}
        {anchor.ots.calendars.length} calendars answered
        {anchor.ots.bitcoinHeights.length > 0
          ? `; Bitcoin block ${anchor.ots.bitcoinHeights.join(', ')}`
          : ''}
        {anchor.ots.nextAttemptAt
          ? `; next check ${when(anchor.ots.nextAttemptAt)}`
          : ''}
        {anchor.ots.lastError ? `; last error: ${anchor.ots.lastError}` : ''}
      </p>
      <ul className="mt-2">
        {CHECKS.map(([key, name]) => (
          <CheckLine key={key} name={name} check={anchor.verify[key]} />
        ))}
      </ul>
    </li>
  )
}

function runSummary(report: AnchorRunReport) {
  const build =
    report.build.state === 'built'
      ? `Anchored ${report.build.leaves} version(s) for ${report.build.anchorId}.`
      : `Today's anchor: ${report.build.state}.`
  const steps = [...report.tsa, ...report.ots]
    .map((step) => `${step.anchorId} ${step.outcome}`)
    .join(', ')
  return steps ? `${build} Steps: ${steps}.` : build
}

/**
 * The admin dashboard's Anchors view (Chunk 16): each day's anchor, both
 * providers' states, every check with its own outcome, and "run now".
 */
export function AnchorsSection() {
  const [attempt, setAttempt] = useState(0)
  const [page, setPage] = useState(1)
  const anchors = useAdminLoad(
    (token) => fetchAnchors(token, page),
    `anchors-${page}-${attempt}`,
  )
  const action = useAdminAction()
  const [ran, setRan] = useState<string>()
  const view = anchors.data
  return (
    <section aria-label="Anchors">
      <h2 className={sectionHeading}>Anchors</h2>
      <p className={noteStyle}>{ANCHORS_EXPLAINED}</p>
      <LoadState
        denied={anchors.denied}
        error={anchors.error}
        loading={!view}
        onRetry={anchors.reload}
      >
        {view && (
          <>
            {!view.enabled && (
              <p role="alert" className="mt-4 text-sm text-[#f1a07a]">
                Anchoring is switched off on this server
                (ANCHORING_ENABLED=false): no version is being time-stamped.
              </p>
            )}
            <ul className="mt-4">
              <CheckLine name="Every version anchored" check={view.coverage} />
            </ul>
            <p className="mt-2 text-xs text-[#9f9676]">
              All {view.global.anchors} anchors: {view.global.unfinished}{' '}
              unfinished, {view.global.failedWhenLastChecked} failed a check
              when last checked, {view.global.cannotMeasureWhenLastChecked}{' '}
              could not be checked when last checked, {view.global.neverChecked}{' '}
              never checked;{' '}
              {view.global.oldestCheck
                ? `oldest check: ${when(view.global.oldestCheck)}.`
                : 'no check stored yet.'}
            </p>
            <p className="mt-1 text-xs text-[#9f9676]">
              Checked {when(view.checkedAt)}. On this page:{' '}
              {CHECKS.map(
                ([key, name]) =>
                  `${name}: ${view.totals[key].pass} pass, ${view.totals[key].fail} fail, ${view.totals[key]['cannot-measure']} cannot check.`,
              ).join(' ')}
            </p>
            <button
              type="button"
              className={primaryStyle}
              disabled={action.busy || !view.enabled}
              onClick={() =>
                void action.run(
                  async (token) =>
                    setRan(runSummary(await runAnchorsNow(token))),
                  () => setAttempt((n) => n + 1),
                )
              }
            >
              Run now
            </button>
            {ran && (
              <p role="status" className="mt-2 text-xs text-[#78aea2]">
                {ran}
              </p>
            )}
            {action.error && (
              <p role="alert" className="mt-2 text-xs text-[#f1a07a]">
                {action.error}
              </p>
            )}
            {view.anchors.length === 0 ? (
              <p className="mt-6 text-sm text-[#b8ad8d]">No anchor yet.</p>
            ) : (
              <ol className="mt-6">
                {view.anchors.map((anchor) => (
                  <AnchorCard key={anchor.anchorId} anchor={anchor} />
                ))}
              </ol>
            )}
            <Pager page={page} hasMore={view.hasMore} onPage={setPage} />
          </>
        )}
      </LoadState>
    </section>
  )
}
