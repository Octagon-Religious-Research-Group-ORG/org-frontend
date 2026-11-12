import { MAX_SAVED_TEXT, normaliseMemberText } from '#/lib/members-api'

/** From this share of the limit on, a screen reader is told the count. */
export const ANNOUNCE_FROM = 0.9

/**
 * How much of one save a text uses, updated as the member types. Counted the
 * way the server counts: after the same cleaning (`normaliseMemberText`) and
 * in UTF-16 units, so the number never disagrees with a refusal. Over the
 * limit it says so before anything is sent.
 *
 * The visible count changes on every keystroke, so it is not a live region:
 * a screen reader hears the count only near the limit and over it, in a
 * separate polite region (Chunk 9 review item 8).
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
  const near = length >= Math.floor(max * ANNOUNCE_FROM)
  const count = `${length.toLocaleString('en-US')} / ${max.toLocaleString('en-US')} characters`
  return (
    <>
      <p
        id={id}
        className={`mt-1 font-mono text-[11px] ${over ? 'text-[#f1a07a]' : 'text-[#9f9676]'}`}
      >
        {count}
        {over && ' (too long for one save)'}
      </p>
      <span aria-live="polite" className="sr-only">
        {over
          ? `Too long: ${count}.`
          : near
            ? `Close to the limit: ${count}.`
            : ''}
      </span>
    </>
  )
}
