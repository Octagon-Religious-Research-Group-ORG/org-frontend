import { snippetParts } from '#/lib/search-api'
import type { ArchiveResult } from '#/lib/search-api'

/** Badge text for each kind of result. */
export function resultBadge(result: ArchiveResult) {
  if (result.kind === 'member') {
    return result.membersOnly ? 'MEMBER · NAME ONLY' : 'MEMBER'
  }
  if (result.kind === 'belief') return 'BELIEF'
  return 'ORG PAGE'
}

/** The line under a result: whose belief, which page. */
export function resultContext(result: ArchiveResult) {
  if (result.kind === 'member') {
    return result.membersOnly
      ? 'Members only: sign in as a member to read this page'
      : 'Member page'
  }
  if (result.kind === 'belief') {
    return `${result.title} · ${result.displayName}`
  }
  return result.title
}

/**
 * A snippet with the server's highlights. The server cuts it only from text
 * this reader may see, so nothing here can show more than that.
 */
export function ResultSnippet({ result }: { result: ArchiveResult }) {
  return (
    <>
      {snippetParts(result.snippet, result.highlights).map((part, index) =>
        part.marked ? (
          <mark
            key={index}
            className="rounded-[1px] bg-[#d4a24a] px-0.5 font-medium text-[#0b0d12]"
          >
            {part.text}
          </mark>
        ) : (
          <span key={index}>{part.text}</span>
        ),
      )}
    </>
  )
}
