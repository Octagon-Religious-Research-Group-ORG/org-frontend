import type { ReactNode } from 'react'

/** A bracket no odd run of backslashes has escaped, then the link's parts. */
const LINK = /(?<!(?:^|[^\\])(?:\\\\)*\\)\[((?:\\.|[^\\\]])*)\]\(([^)\s]+)\)/g

const SAFE_TARGET = /^(?:https?:\/\/|mailto:|\/(?!\/))/i

function unescape(text: string) {
  return text.replace(/\\([\\[\]])/g, '$1')
}

/**
 * Member text as plain text. The only structure it reads is the
 * `[label](address)` form the importer wrote for links; anything else, HTML
 * included, is shown as the characters it is. Text never becomes markup: the
 * pieces are React strings, and an address that isn't http(s), mailto or a
 * path on this site stays visible text.
 */
export function MemberText({ text }: { text: string }) {
  const parts: Array<ReactNode> = []
  let cursor = 0
  for (const match of text.matchAll(LINK)) {
    if (!SAFE_TARGET.test(match[2])) continue
    if (match.index > cursor) {
      parts.push(unescape(text.slice(cursor, match.index)))
    }
    parts.push(
      <a
        key={match.index}
        href={match[2]}
        rel="noopener noreferrer nofollow"
        className="text-[#f1d78a] underline underline-offset-4 [overflow-wrap:anywhere]"
      >
        {unescape(match[1])}
      </a>,
    )
    cursor = match.index + match[0].length
  }
  parts.push(unescape(text.slice(cursor)))
  return <>{parts}</>
}
