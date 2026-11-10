import { MAX_SAVED_TEXT } from '#/lib/members-api'

/**
 * How much of one save a text uses, updated as the member types. Counted the
 * way the server counts (UTF-16 units), so the number never disagrees with a
 * refusal. Over the limit it says so before anything is sent.
 */
export function CharacterCount({ id, value }: { id: string; value: string }) {
  const over = value.length > MAX_SAVED_TEXT
  return (
    <p
      id={id}
      aria-live="polite"
      className={`mt-1 font-mono text-[11px] ${over ? 'text-[#f1a07a]' : 'text-[#9f9676]'}`}
    >
      {value.length.toLocaleString('en-US')} /{' '}
      {MAX_SAVED_TEXT.toLocaleString('en-US')} characters
      {over && ' (too long for one save)'}
    </p>
  )
}
