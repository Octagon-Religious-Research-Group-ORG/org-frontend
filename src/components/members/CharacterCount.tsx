import { MAX_SAVED_TEXT, normaliseMemberText } from '#/lib/members-api'

/**
 * How much of one save a text uses, updated as the member types. Counted the
 * way the server counts: after the same cleaning (`normaliseMemberText`) and
 * in UTF-16 units, so the number never disagrees with a refusal. Over the
 * limit it says so before anything is sent.
 */
export function CharacterCount({
  id,
  value,
  max = MAX_SAVED_TEXT,
}: {
  id: string
  value: string
  /** The limit; one save of page text unless said otherwise. */
  max?: number
}) {
  const length = normaliseMemberText(value).length
  const over = length > max
  return (
    <p
      id={id}
      aria-live="polite"
      className={`mt-1 font-mono text-[11px] ${over ? 'text-[#f1a07a]' : 'text-[#9f9676]'}`}
    >
      {length.toLocaleString('en-US')} / {max.toLocaleString('en-US')}{' '}
      characters
      {over && ' (too long for one save)'}
    </p>
  )
}
