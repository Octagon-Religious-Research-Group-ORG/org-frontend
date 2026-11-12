import { useId, useState } from 'react'
import type { FormEvent } from 'react'
import { MAX_COMMENT_LENGTH } from '#/lib/comments-api'
import { MAX_SAVED_TEXT, normaliseMemberText } from '#/lib/members-api'
import { CharacterCount } from './CharacterCount'
import {
  buttonStyle,
  fieldStyle,
  labelStyle,
  primaryStyle,
} from './editor-styles'

/**
 * "Suggest a rewording": the whole belief as the member would word it, and
 * an optional note for its owner. Each is cleaned as the server stores it
 * and checked against its own limit before anything is sent.
 *
 * @param onSubmit - resolves true when it was sent
 */
export function SuggestForm({
  initial,
  busy,
  onSubmit,
  onCancel,
}: {
  initial: string
  busy: boolean
  onSubmit: (text: string, note: string) => Promise<boolean>
  onCancel: () => void
}) {
  const id = useId()
  const [text, setText] = useState(initial)
  const [note, setNote] = useState('')
  const [problem, setProblem] = useState<string>()

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const cleanedText = normaliseMemberText(text)
    const cleanedNote = normaliseMemberText(note)
    if (cleanedText === '') {
      setProblem('Please write the belief as you would word it.')
      return
    }
    if (cleanedText.length > MAX_SAVED_TEXT) {
      setProblem(
        `The belief is longer than ${MAX_SAVED_TEXT.toLocaleString('en-US')} characters. Please shorten it.`,
      )
      return
    }
    if (cleanedNote.length > MAX_COMMENT_LENGTH) {
      setProblem(
        `The note is longer than ${MAX_COMMENT_LENGTH.toLocaleString('en-US')} characters. Please shorten it.`,
      )
      return
    }
    setProblem(undefined)
    await onSubmit(cleanedText, cleanedNote)
  }

  return (
    <form onSubmit={(event) => void submit(event)} className="mt-3">
      <label htmlFor={`${id}-text`} className={labelStyle}>
        Your wording of the whole belief
      </label>
      <textarea
        id={`${id}-text`}
        value={text}
        rows={6}
        aria-describedby={`${id}-text-count`}
        onChange={(event) => setText(event.target.value)}
        className={fieldStyle}
      />
      <CharacterCount id={`${id}-text-count`} value={text} />
      <label htmlFor={`${id}-note`} className={`${labelStyle} mt-3`}>
        A note for the owner (optional)
      </label>
      <textarea
        id={`${id}-note`}
        value={note}
        rows={3}
        aria-describedby={`${id}-note-count`}
        onChange={(event) => setNote(event.target.value)}
        className={fieldStyle}
      />
      <CharacterCount
        id={`${id}-note-count`}
        value={note}
        max={MAX_COMMENT_LENGTH}
      />
      {problem && (
        <p role="alert" className="mt-2 text-sm text-[#f1a07a]">
          {problem}
        </p>
      )}
      <div className="flex flex-wrap gap-3">
        <button type="submit" disabled={busy} className={primaryStyle}>
          Send suggestion
        </button>
        <button type="button" onClick={onCancel} className={buttonStyle}>
          Cancel
        </button>
      </div>
    </form>
  )
}
