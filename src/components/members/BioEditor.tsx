import { useState } from 'react'
import type { FormEvent } from 'react'
import {
  BIO_TOO_LONG,
  MAX_SAVED_TEXT,
  editBio,
  editorText,
} from '#/lib/members-api'
import type { ParagraphView } from '#/lib/members-api'
import { CharacterCount } from './CharacterCount'
import { useOwnerAction } from './use-owner-action'
import {
  buttonStyle,
  fieldStyle,
  labelStyle,
  primaryStyle,
} from './editor-styles'

/** The owner's bio, edited in place; every save is a new version. */
export function BioEditor({
  bio,
  baseSeq,
  onDone,
}: {
  bio: Array<ParagraphView>
  /** The version the page showed; the server refuses a save on anything newer. */
  baseSeq: number
  onDone: (changed: boolean) => void
}) {
  const [text, setText] = useState(() => editorText(bio))
  const { busy, problem, run, fail } = useOwnerAction()

  const save = async (event: FormEvent) => {
    event.preventDefault()
    // Nothing typed: nothing sent, so a long imported bio never errors.
    if (text === editorText(bio)) {
      onDone(false)
      return
    }
    if (text.length > MAX_SAVED_TEXT) {
      fail(BIO_TOO_LONG)
      return
    }
    const saved = await run((token) => editBio(token, text, baseSeq))
    if (saved) onDone(saved.changed)
  }

  return (
    <form onSubmit={(event) => void save(event)} className="mt-4">
      <label className={labelStyle}>
        Your bio
        <textarea
          required
          rows={8}
          value={text}
          aria-describedby="bio-count"
          onChange={(event) => setText(event.target.value)}
          className={fieldStyle}
        />
      </label>
      <CharacterCount id="bio-count" value={text} />
      <p className="mt-2 text-xs leading-5 text-[#9f9676]">
        Separate paragraphs with a blank line. Every save is kept in the
        history.
      </p>
      <div className="flex flex-wrap gap-3">
        <button type="submit" disabled={busy} className={primaryStyle}>
          Save bio
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => onDone(false)}
          className={buttonStyle}
        >
          Cancel
        </button>
      </div>
      {problem && (
        <p role="alert" className="mt-3 text-sm text-[#f1a07a]">
          {problem}
        </p>
      )}
    </form>
  )
}
