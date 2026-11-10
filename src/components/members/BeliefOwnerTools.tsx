import { useState } from 'react'
import type { FormEvent } from 'react'
import {
  editBeliefText,
  editBeliefTitle,
  editorText,
  moveBelief,
  removeBelief,
} from '#/lib/members-api'
import type { BeliefTab } from '#/lib/members-api'
import {
  buttonStyle,
  dangerStyle,
  fieldStyle,
  labelStyle,
  primaryStyle,
} from './editor-styles'
import { useOwnerAction } from './use-owner-action'

export const REMOVE_EXPLAINED =
  'It disappears from your page for everyone. ORG keeps its text and its whole history for at least five years, and you and the admins can still open that history.'

type Mode = 'idle' | 'editing' | 'confirm-remove'

/**
 * The owner's tools under one belief: edit its title and text, move it, or
 * take it off the page. Each change is checked by the server against the
 * version the page showed, so a stale window is told to reload instead of
 * overwriting a newer save.
 */
export function BeliefOwnerTools({
  tab,
  revision,
  isFirst,
  isLast,
  isOnly,
  onChanged,
}: {
  tab: BeliefTab
  /** What the page showed of this belief; 0 for a title never edited. */
  revision: { text: number; title: number }
  isFirst: boolean
  isLast: boolean
  /** The last belief on the page cannot be removed. */
  isOnly: boolean
  onChanged: () => void
}) {
  const [mode, setMode] = useState<Mode>('idle')
  const [title, setTitle] = useState(tab.title)
  const [text, setText] = useState(() => editorText(tab.paragraphs))
  const [notice, setNotice] = useState<string>()
  const { busy, problem, run } = useOwnerAction()

  const startEditing = () => {
    setTitle(tab.title)
    setText(editorText(tab.paragraphs))
    setNotice(undefined)
    setMode('editing')
  }

  const save = async (event: FormEvent) => {
    event.preventDefault()
    const titled = await run((token) =>
      editBeliefTitle(token, tab.tabId, title, revision.title),
    )
    if (!titled) return
    const written = await run((token) =>
      editBeliefText(token, tab.tabId, text, revision.text),
    )
    if (!written) {
      if (titled.changed) onChanged()
      return
    }
    setMode('idle')
    if (titled.changed || written.changed) {
      setNotice('Saved. The earlier version is in the history.')
      onChanged()
    } else {
      setNotice('Nothing changed, so nothing new was saved.')
    }
  }

  const move = async (direction: 'up' | 'down') => {
    if (await run((token) => moveBelief(token, tab.tabId, direction))) {
      onChanged()
    }
  }

  const remove = async () => {
    if (await run((token) => removeBelief(token, tab.tabId))) {
      setMode('idle')
      onChanged()
    }
  }

  return (
    <div className="mt-6">
      {mode === 'editing' ? (
        <form onSubmit={(event) => void save(event)}>
          <label className={labelStyle}>
            Title
            <input
              required
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className={fieldStyle}
            />
          </label>
          <label className={`${labelStyle} mt-3`}>
            Belief
            <textarea
              required
              rows={8}
              value={text}
              onChange={(event) => setText(event.target.value)}
              className={fieldStyle}
            />
          </label>
          <p className="mt-2 text-xs leading-5 text-[#9f9676]">
            Separate paragraphs with a blank line. Every save is kept in the
            history.
          </p>
          <div className="flex flex-wrap gap-3">
            <button type="submit" disabled={busy} className={primaryStyle}>
              Save belief
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => setMode('idle')}
              className={buttonStyle}
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            disabled={busy}
            onClick={startEditing}
            className={buttonStyle}
          >
            Edit belief
          </button>
          <button
            type="button"
            disabled={busy || isFirst}
            onClick={() => void move('up')}
            className={buttonStyle}
          >
            Move earlier
          </button>
          <button
            type="button"
            disabled={busy || isLast}
            onClick={() => void move('down')}
            className={buttonStyle}
          >
            Move later
          </button>
          <button
            type="button"
            disabled={busy || isOnly}
            title={isOnly ? 'A page needs at least one belief.' : undefined}
            onClick={() => setMode('confirm-remove')}
            className={dangerStyle}
          >
            Remove belief
          </button>
        </div>
      )}
      {mode === 'confirm-remove' && (
        <div
          role="alertdialog"
          aria-labelledby={`remove-${tab.tabId}`}
          aria-describedby={`remove-${tab.tabId}-why`}
          className="mt-4 border border-[#f1a07a] p-4"
        >
          <p
            id={`remove-${tab.tabId}`}
            className="text-sm text-[#ece2c4] [overflow-wrap:anywhere]"
          >
            Remove “{tab.title}” from your page?
          </p>
          <p
            id={`remove-${tab.tabId}-why`}
            className="mt-2 text-xs leading-5 text-[#b8ad8d]"
          >
            {REMOVE_EXPLAINED}
          </p>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              disabled={busy}
              onClick={() => void remove()}
              className={dangerStyle}
            >
              Yes, remove it
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => setMode('idle')}
              className={buttonStyle}
            >
              Keep it
            </button>
          </div>
        </div>
      )}
      {isOnly && mode === 'idle' && (
        <p className="mt-2 text-xs text-[#9f9676]">
          This is your only belief. A page needs at least one, so add another
          before removing it.
        </p>
      )}
      {notice && (
        <p role="status" className="mt-3 text-sm text-[#78aea2]">
          {notice}
        </p>
      )}
      {problem && (
        <p role="alert" className="mt-3 text-sm text-[#f1a07a]">
          {problem}
        </p>
      )}
    </div>
  )
}
