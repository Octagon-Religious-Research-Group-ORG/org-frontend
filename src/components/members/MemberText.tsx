import type { ReactNode } from 'react'

const SAFE_TARGET = /^(?:https?:\/\/|mailto:|\/(?!\/))/i

/**
 * Backslashes, spaces and control characters have no place in an address, and
 * browsers treat the first as a slash: `/\host` would leave the site.
 */
const UNSAFE_TARGET_CHARACTER = /[\\\s\p{C}]/u

function isSafeTarget(target: string) {
  return !UNSAFE_TARGET_CHARACTER.test(target) && SAFE_TARGET.test(target)
}

function unescape(text: string) {
  return text.replace(/\\([\\[\]])/g, '$1')
}

interface FoundLink {
  index: number
  end: number
  label: string
  target: string
}

/**
 * Finds `[label](address)` links, left to right, in one pass over the text. A
 * backslash escapes the next character. Each search for a closing bracket or
 * the end of an address resumes where the last one stopped, so the work is
 * proportional to the length of the text whatever it contains.
 */
function findLinks(text: string): Array<FoundLink> {
  const links: Array<FoundLink> = []
  let close = -1
  let targetEnd = -1
  let i = 0
  while (i < text.length) {
    if (text[i] === '\\') {
      i += 2
      continue
    }
    if (text[i] !== '[') {
      i += 1
      continue
    }
    if (close <= i) {
      close = i + 1
      while (close < text.length && text[close] !== ']') {
        close += text[close] === '\\' ? 2 : 1
      }
    }
    if (close >= text.length) break
    if (text[close + 1] !== '(') {
      i += 1
      continue
    }
    const start = close + 2
    if (targetEnd < start) {
      targetEnd = start
      while (
        targetEnd < text.length &&
        text[targetEnd] !== ')' &&
        !/\s/.test(text[targetEnd])
      ) {
        targetEnd += 1
      }
    }
    if (targetEnd === start || text[targetEnd] !== ')') {
      i += 1
      continue
    }
    links.push({
      index: i,
      end: targetEnd + 1,
      label: text.slice(i + 1, close),
      target: text.slice(start, targetEnd),
    })
    i = targetEnd + 1
  }
  return links
}

/**
 * Member text as plain text. The only structure it reads is the
 * `[label](address)` form the importer wrote for links; anything else, HTML
 * included, is shown as the characters it is. Text never becomes markup: the
 * pieces are React strings, and an address that isn't http(s), mailto or a
 * path that stays on this site remains visible text.
 */
export function MemberText({ text }: { text: string }) {
  const parts: Array<ReactNode> = []
  let cursor = 0
  for (const link of findLinks(text)) {
    if (!isSafeTarget(link.target)) continue
    if (link.index > cursor) {
      parts.push(unescape(text.slice(cursor, link.index)))
    }
    parts.push(
      <a
        key={link.index}
        href={link.target}
        rel="noopener noreferrer nofollow"
        className="text-[#f1d78a] underline underline-offset-4 [overflow-wrap:anywhere]"
      >
        {unescape(link.label)}
      </a>,
    )
    cursor = link.end
  }
  parts.push(unescape(text.slice(cursor)))
  return <>{parts}</>
}
