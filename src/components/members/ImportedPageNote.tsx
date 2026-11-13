/**
 * Shown wherever a signed-in person without a member page is invited to
 * create one. Member pages from ORG's old Pages profiles were imported but
 * belong to no login until their owner claims them (plan D5, Chunk 11), so an
 * imported member would otherwise create a duplicate. The way to claim is on
 * the page itself ("This is my page", `ClaimPanel`). Wording is provisional
 * until the owner (Tripp) confirms it.
 */
export const IMPORTED_PAGE_NOTE =
  "Already had a member page in ORG's old Pages profiles? It has been brought over to this site. Please don't create a new one: find your page in the Members Community, open it and choose “This is my page” to claim it."

export function ImportedPageNote() {
  return (
    <p
      role="note"
      className="mt-4 max-w-2xl border-l-2 border-[#f1d78a] pl-3 text-sm leading-7 text-[#ece2c4]"
    >
      {IMPORTED_PAGE_NOTE}
    </p>
  )
}
