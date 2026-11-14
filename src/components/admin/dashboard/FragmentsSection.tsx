import { useId, useState } from 'react'
import { fetchAdminFragments, setFragmentHidden } from '#/lib/search-api'
import type { AdminFragment } from '#/lib/search-api'
import { buttonStyle, fieldStyle } from '#/components/members/editor-styles'
import {
  LoadState,
  noteStyle,
  sectionHeading,
  useAdminAction,
  useAdminLoad,
} from './admin-shared'

export const FRAGMENTS_EXPLAINED =
  'The Perforated Index suggests terms many different people searched for, counted only as totals, never with who searched; a person counts once however often they search. A term is suggested only while every word of it is in something a signed-out visitor can read. Hide any term that should not be suggested; it stays searchable.'

function status(fragment: AdminFragment) {
  if (fragment.hidden) return 'Hidden'
  return fragment.shown ? 'Suggested now' : 'Not suggested'
}

function FragmentRow({
  fragment,
  onChanged,
}: {
  fragment: AdminFragment
  onChanged: () => void
}) {
  const [reason, setReason] = useState('')
  const action = useAdminAction()
  // A term holds spaces; an id must not.
  const reasonId = useId()
  const verb = fragment.hidden ? 'Show again' : 'Hide'
  return (
    <li className="flex flex-wrap items-center gap-3 py-3 text-sm">
      <span className="min-w-[10rem] font-mono text-[#f6efd9] [overflow-wrap:anywhere]">
        {fragment.term}
      </span>
      <span className="text-xs text-[#9f9676]">
        {fragment.searchers} searchers · {status(fragment)}
      </span>
      <label className="sr-only" htmlFor={reasonId}>
        Reason for “{fragment.term}” (optional)
      </label>
      <input
        id={reasonId}
        className={`${fieldStyle} max-w-[16rem]`}
        value={reason}
        maxLength={500}
        placeholder="Reason (optional)"
        onChange={(event) => setReason(event.target.value)}
      />
      <button
        type="button"
        className={buttonStyle}
        disabled={action.busy}
        onClick={() =>
          void action.run(
            (token) =>
              setFragmentHidden(
                token,
                fragment.term,
                !fragment.hidden,
                reason.trim() || undefined,
              ),
            onChanged,
          )
        }
      >
        {verb} “{fragment.term}”
      </button>
      {action.error && (
        <p role="alert" className="w-full text-xs text-[#f1a07a]">
          {action.error}
        </p>
      )}
    </li>
  )
}

/**
 * Hiding a term before anyone has searched it enough to be listed, so an
 * admin can keep a word out of the suggestions ahead of time.
 */
function HideAnyTerm({ onChanged }: { onChanged: () => void }) {
  const [term, setTerm] = useState('')
  const [reason, setReason] = useState('')
  const action = useAdminAction()
  const termId = useId()
  const reasonId = useId()
  return (
    <form
      className="mt-6 flex flex-wrap items-end gap-3 text-sm"
      onSubmit={(event) => {
        event.preventDefault()
        void action.run(
          (token) =>
            setFragmentHidden(
              token,
              term.trim(),
              true,
              reason.trim() || undefined,
            ),
          () => {
            setTerm('')
            setReason('')
            onChanged()
          },
        )
      }}
    >
      <div>
        <label htmlFor={termId} className="block text-xs text-[#9f9676]">
          Term to hide
        </label>
        <input
          id={termId}
          required
          className={`${fieldStyle} max-w-[16rem]`}
          value={term}
          maxLength={80}
          onChange={(event) => setTerm(event.target.value)}
        />
      </div>
      <div>
        <label htmlFor={reasonId} className="block text-xs text-[#9f9676]">
          Reason (optional)
        </label>
        <input
          id={reasonId}
          className={`${fieldStyle} max-w-[16rem]`}
          value={reason}
          maxLength={500}
          onChange={(event) => setReason(event.target.value)}
        />
      </div>
      <button type="submit" className={buttonStyle} disabled={action.busy}>
        Hide term
      </button>
      {action.error && (
        <p role="alert" className="w-full text-xs text-[#f1a07a]">
          {action.error}
        </p>
      )}
    </form>
  )
}

/** Suggested Fragments (Chunk 15): what is suggested, and hiding a term. */
export function FragmentsSection() {
  const list = useAdminLoad(fetchAdminFragments, 'fragments')
  return (
    <section aria-labelledby="fragments-heading">
      <h2 id="fragments-heading" className={sectionHeading}>
        Suggested fragments
      </h2>
      <p className={noteStyle}>{FRAGMENTS_EXPLAINED}</p>
      <LoadState
        denied={list.denied}
        error={list.error}
        loading={!list.data}
        onRetry={list.reload}
      >
        {list.data?.fragments.length === 0 && (
          <p className="mt-6 text-sm text-[#9f9676]">
            No term has enough searchers yet; the defaults are shown.
          </p>
        )}
        <HideAnyTerm onChanged={list.reload} />
        <ul className="mt-6 flex flex-col divide-y divide-[rgba(236,226,196,0.12)]">
          {list.data?.fragments.map((fragment) => (
            <FragmentRow
              key={`${fragment.term}-${fragment.hidden}`}
              fragment={fragment}
              onChanged={list.reload}
            />
          ))}
        </ul>
      </LoadState>
    </section>
  )
}
