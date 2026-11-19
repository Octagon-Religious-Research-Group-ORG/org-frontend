import { useEffect, useState } from 'react'
import {
  buttonStyle,
  fieldStyle,
  labelStyle,
  primaryStyle,
} from '#/components/members/editor-styles'
import {
  forgetConnectionTerms,
  useConnectionTerms,
} from '#/components/members/use-connection-terms'
import { DEFAULT_TERMS, saveConnectionTerms } from '#/lib/connections-api'
import { cardStyle, noteStyle, useAdminAction } from './admin-shared'

export const NAME_EXPLAINED =
  'What the site calls a connection request, everywhere members see it. Write it in lower case, one name and its plural; empty both to go back to the default. Emails use it too.'
export const NAME_FORMAT =
  'Each name is 1 to 40 letters, spaces, hyphens or apostrophes.'

/** Letters (any alphabet), spaces, hyphens and apostrophes. */
const TERM = /^[\p{L}\p{M}][\p{L}\p{M} '’-]{0,39}$/u

/**
 * The feature's name (Chunk 18): an admin may rename "connection request"
 * without a code change. The server checks it again.
 */
export function ConnectionNameCard() {
  const current = useConnectionTerms()
  const [singular, setSingular] = useState(current.singular)
  const [plural, setPlural] = useState(current.plural)
  const [saved, setSaved] = useState<string>()
  const save = useAdminAction()

  // The name arrives after the first render; show it once it does.
  useEffect(() => {
    setSingular(current.singular)
    setPlural(current.plural)
  }, [current])

  const one = singular.trim()
  const many = plural.trim()
  const reset = one === '' && many === ''
  const invalid = !reset && !(TERM.test(one) && TERM.test(many))

  return (
    <form
      className={`${cardStyle} mt-6`}
      onSubmit={(event) => {
        event.preventDefault()
        setSaved(undefined)
        void save.run(
          (token) =>
            saveConnectionTerms(token, { singular: one, plural: many }),
          () => {
            forgetConnectionTerms()
            setSaved(reset ? 'The default name is back.' : 'Name saved.')
          },
        )
      }}
    >
      <h3 className="text-lg text-[#f6efd9]">Connection request name</h3>
      <p className={noteStyle}>{NAME_EXPLAINED}</p>
      <label className="mt-3 block">
        <span className={labelStyle}>
          One (default “{DEFAULT_TERMS.singular}”)
        </span>
        <input
          value={singular}
          maxLength={40}
          onChange={(event) => setSingular(event.target.value)}
          aria-invalid={invalid}
          aria-describedby="connection-name-format"
          className={fieldStyle}
        />
      </label>
      <label className="mt-3 block">
        <span className={labelStyle}>
          Several (default “{DEFAULT_TERMS.plural}”)
        </span>
        <input
          value={plural}
          maxLength={40}
          onChange={(event) => setPlural(event.target.value)}
          aria-invalid={invalid}
          aria-describedby="connection-name-format"
          className={fieldStyle}
        />
      </label>
      <p
        id="connection-name-format"
        className={`mt-2 text-xs ${invalid ? 'text-[#f1a07a]' : 'text-[#9f9676]'}`}
      >
        {NAME_FORMAT}
      </p>
      {save.error && (
        <p role="alert" className="mt-2 text-sm text-[#f1a07a]">
          {save.error}
        </p>
      )}
      {saved && (
        <p role="status" className="mt-2 text-sm text-[#9dcf83]">
          {saved}
        </p>
      )}
      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          className={primaryStyle}
          disabled={save.busy || invalid}
        >
          Save the name
        </button>
        <button
          type="button"
          className={buttonStyle}
          disabled={save.busy}
          onClick={() => {
            setSingular('')
            setPlural('')
          }}
        >
          Clear both
        </button>
      </div>
    </form>
  )
}
