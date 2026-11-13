import { useEffect, useId, useRef, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { MAX_COMMENT_LENGTH } from '#/lib/comments-api'
import { normaliseMemberText } from '#/lib/members-api'
import { CharacterCount } from './CharacterCount'
import {
  buttonStyle,
  fieldStyle,
  labelStyle,
  primaryStyle,
} from './editor-styles'

/**
 * One text box for a comment, a reply or an edit. It sends the text cleaned
 * as the server stores it (`normaliseMemberText`), and refuses empty or
 * too-long text before sending, with the server's own limit.
 *
 * @param onSubmit - resolves true when it was saved, so the box can empty
 */
export function CommentForm({
  label,
  submitLabel,
  initial = '',
  max = MAX_COMMENT_LENGTH,
  busy,
  onSubmit,
  onCancel,
  focusKey,
  note,
}: {
  label: string
  submitLabel: string
  initial?: string
  max?: number
  busy: boolean
  onSubmit: (text: string) => Promise<boolean>
  onCancel?: () => void
  /** A new value moves the focus into the box ("…and comment", Chunk 10). */
  focusKey?: number
  /** Shown above the buttons, e.g. the stance badge the comment will carry. */
  note?: ReactNode
}) {
  const id = useId()
  const box = useRef<HTMLTextAreaElement>(null)
  useEffect(() => {
    if (focusKey) box.current?.focus()
  }, [focusKey])
  const [text, setText] = useState(initial)
  const [problem, setProblem] = useState<string>()

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const cleaned = normaliseMemberText(text)
    if (cleaned === '') {
      setProblem('Please write something first.')
      return
    }
    if (cleaned.length > max) {
      setProblem(
        `This is longer than ${max.toLocaleString('en-US')} characters. Please shorten it.`,
      )
      return
    }
    setProblem(undefined)
    if (await onSubmit(cleaned)) setText('')
  }

  return (
    <form onSubmit={(event) => void submit(event)} className="mt-3">
      <label htmlFor={`${id}-text`} className={labelStyle}>
        {label}
      </label>
      <textarea
        id={`${id}-text`}
        ref={box}
        value={text}
        rows={4}
        aria-describedby={`${id}-count`}
        onChange={(event) => setText(event.target.value)}
        className={fieldStyle}
      />
      <CharacterCount id={`${id}-count`} value={text} max={max} />
      {problem && (
        <p role="alert" className="mt-2 text-sm text-[#f1a07a]">
          {problem}
        </p>
      )}
      {note}
      <div className="flex flex-wrap gap-3">
        <button type="submit" disabled={busy} className={primaryStyle}>
          {submitLabel}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className={buttonStyle}>
            Cancel
          </button>
        )}
      </div>
    </form>
  )
}
