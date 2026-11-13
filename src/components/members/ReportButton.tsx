import { useId, useState } from 'react'
import {
  MAX_REPORT_NOTE_LENGTH,
  REPORT_REASONS,
  reportContent,
} from '#/lib/comments-api'
import type { ReportReason, ReportTarget } from '#/lib/comments-api'
import {
  buttonStyle,
  dangerStyle,
  fieldStyle,
  labelStyle,
} from './editor-styles'
import { useOwnerAction } from './use-owner-action'

export const REPORT_SENT =
  'Thank you. An admin will look at it. Nobody else is told who reported it.'
export const REPORT_EXPLAINED =
  'Only the admins see reports. The person you report is not told who you are.'

/**
 * "Report" on a comment or a member page (Chunk 13): a short reason from a
 * list and an optional note. The server decides who may report and answers
 * only that it arrived.
 *
 * @param label - the button's accessible name, e.g. "Report comment 3, by …"
 */
export function ReportButton({
  target,
  label,
  text = 'Report',
}: {
  target: ReportTarget
  label: string
  text?: string
}) {
  const [open, setOpen] = useState(false)
  const [sent, setSent] = useState(false)
  const [reason, setReason] = useState<ReportReason>('harassment')
  const [note, setNote] = useState('')
  const { busy, problem, run } = useOwnerAction()
  const id = useId()

  if (sent) {
    return (
      <p role="status" className="mt-2 text-xs text-[#9dcf83]">
        {REPORT_SENT}
      </p>
    )
  }
  if (!open) {
    return (
      <button
        type="button"
        aria-label={label}
        onClick={() => setOpen(true)}
        className={buttonStyle}
      >
        {text}
      </button>
    )
  }
  return (
    <form
      aria-label={label}
      className="mt-3 max-w-xl"
      onSubmit={(event) => {
        event.preventDefault()
        void (async () => {
          const answer = await run((token) =>
            reportContent(token, target, reason, note),
          )
          if (answer !== undefined) setSent(true)
        })()
      }}
    >
      <p className="text-xs text-[#b8ad8d]">{REPORT_EXPLAINED}</p>
      <label htmlFor={`${id}-reason`} className={labelStyle}>
        What is wrong
      </label>
      <select
        id={`${id}-reason`}
        value={reason}
        onChange={(event) => setReason(event.target.value as ReportReason)}
        className={fieldStyle}
      >
        {REPORT_REASONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <label htmlFor={`${id}-note`} className={labelStyle}>
        Anything the admins should know (optional)
      </label>
      <textarea
        id={`${id}-note`}
        rows={2}
        maxLength={MAX_REPORT_NOTE_LENGTH}
        value={note}
        onChange={(event) => setNote(event.target.value)}
        className={fieldStyle}
      />
      <div className="flex flex-wrap gap-3">
        <button type="submit" disabled={busy} className={dangerStyle}>
          Send report
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => setOpen(false)}
          className={buttonStyle}
        >
          Cancel
        </button>
      </div>
      {problem && (
        <p role="alert" className="mt-2 text-sm text-[#f1a07a]">
          {problem}
        </p>
      )}
    </form>
  )
}
