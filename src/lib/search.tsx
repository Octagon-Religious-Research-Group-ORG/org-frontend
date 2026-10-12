import type { ReactNode } from 'react'
import { DEFAULT_WEBSITE_PAGES } from '#/lib/content-defaults'
import type {
  AboutOutlineNode,
  AboutPageContent,
  WebsitePageContent,
  WebsitePageId,
} from '#/lib/content-types'

export type SearchPageId = WebsitePageId

export interface SearchResult {
  pageId: SearchPageId
  title: string
  href: string
  snippet: string
  score: number
  lineIndex?: number // for reference pages, enables deep highlight/scroll
}

const PAGE_TITLES: Record<SearchPageId, string> = {
  community: 'Community',
  beliefs: 'Beliefs',
  infrastructure: 'Infrastructure',
  research: 'Research',
  legal: 'Legal',
  future: 'Future Ideas',
  donations: 'Gifts & Contributions',
  membership: 'Membership',
  about: 'About Us',
}

const PAGE_HREFS: Record<SearchPageId, string> = {
  community: '/community',
  beliefs: '/beliefs',
  infrastructure: '/infrastructure',
  research: '/research',
  legal: '/legal',
  future: '/future-ideas',
  donations: '/gifts-contributions',
  membership: '/membership',
  about: '/about',
}

function escapeReg(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function withHighlight(text: string, term?: string): ReactNode[] {
  if (!term || !term.trim()) return [text]
  const q = term.trim()
  const re = new RegExp(`(${escapeReg(q)})`, 'gi')
  const parts = text.split(re)
  return parts.map((part, i) =>
    re.test(part) ? (
      <mark
        key={`h-${i}`}
        className="rounded-[1px] bg-[#d4a24a] px-0.5 text-[#0b0d12] font-medium"
      >
        {part}
      </mark>
    ) : (
      part
    ),
  )
}

function makeSnippet(text: string, term: string, max = 118): string {
  const idx = text.toLowerCase().indexOf(term.toLowerCase())
  const start = Math.max(0, idx - 42)
  const end = Math.min(text.length, idx + term.length + 52)
  let snip = text.slice(start, end)
  if (start > 0) snip = '…' + snip
  if (end < text.length) snip = snip + '…'
  return snip.length > max ? snip.slice(0, max - 1) + '…' : snip
}

function scoreMatch(
  text: string,
  q: string,
  base: number,
  positionBoost = 0,
): number {
  if (!text.toLowerCase().includes(q)) return 0
  let s = base
  // slight boost for earlier occurrence or title-like
  const pos = text.toLowerCase().indexOf(q)
  if (pos < 20) s += 12 + positionBoost
  // whole word-ish bonus
  const wordRe = new RegExp(`\\b${escapeReg(q)}\\b`, 'i')
  if (wordRe.test(text)) s += 8
  return s
}

function flattenAboutForSearch(
  page: AboutPageContent,
): Array<{ text: string; articleId?: string }> {
  const out: Array<{ text: string; articleId?: string }> = []
  page.articles.forEach((article) => {
    out.push({ text: article.lead, articleId: article.id })
    const walk = (nodes: ReadonlyArray<AboutOutlineNode>) => {
      nodes.forEach((node) => {
        out.push({ text: node.text, articleId: article.id })
        if (node.children.length) walk(node.children)
      })
    }
    if (article.body.length) walk(article.body)
  })
  return out
}

export function search(
  query: string,
  pages: WebsitePageContent[] = Object.values(DEFAULT_WEBSITE_PAGES),
): SearchResult[] {
  const q = (query || '').trim()
  if (!q) return []

  const ql = q.toLowerCase()
  const results: SearchResult[] = []

  // Reference pages (primary)
  pages
    .filter((page) => page.kind === 'reference')
    .forEach((page) => {
      let pageScore = 0
      let bestLineIdx: number | undefined
      let bestSnippet = ''

      // Title
      const tScore = scoreMatch(page.title, ql, 110)
      if (tScore) {
        pageScore += tScore
        bestSnippet = page.title
      }

      // Subtitle
      const subScore = scoreMatch(page.subtitle, ql, 45)
      pageScore += subScore
      if (subScore && !bestSnippet) bestSnippet = page.subtitle

      // Lines
      page.blocks.forEach((block, idx) => {
        const lineScore = scoreMatch(
          block.text,
          ql,
          28,
          Math.max(0, 12 - Math.floor(idx / 3)),
        )
        if (lineScore > 0) {
          pageScore += lineScore
          if (bestLineIdx === undefined) {
            bestLineIdx = idx
            bestSnippet = makeSnippet(block.text, q)
          }
        }
      })

      if (pageScore > 0) {
        const title = PAGE_TITLES[page.id]
        results.push({
          pageId: page.id,
          title,
          href: PAGE_HREFS[page.id],
          snippet: bestSnippet,
          score: pageScore,
          lineIndex: bestLineIdx,
        })
      }
    })

  // About (synthesized)
  const about = pages.find(
    (page): page is AboutPageContent => page.kind === 'about',
  )
  if (about) {
    let aboutScore = 0
    let aboutSnippet = ''
    const aboutBlocks = flattenAboutForSearch(about)
    const titleScore = scoreMatch(about.title, ql, 95)
    if (titleScore) {
      aboutScore += titleScore
      aboutSnippet = `${about.title} — founding document`
    }
    aboutBlocks.forEach((block) => {
      const score = scoreMatch(block.text, ql, 22)
      if (score > 0) {
        aboutScore += score
        if (!aboutSnippet) aboutSnippet = makeSnippet(block.text, q)
      }
    })
    if (aboutScore > 0) {
      results.push({
        pageId: 'about',
        title: about.title,
        href: '/about',
        snippet: aboutSnippet,
        score: aboutScore,
      })
    }
  }

  // Sort: higher score first, stable
  results.sort((a, b) => b.score - a.score)

  // Light cap for UI density (still show strong matches)
  return results.slice(0, 14)
}

export const PAGE_META: Record<
  SearchPageId,
  { short: string; accent: string }
> = {
  community: { short: 'COMMUNITY', accent: '#5800FF' },
  beliefs: { short: 'BELIEFS', accent: '#5800FF' },
  infrastructure: { short: 'INFRASTRUCTURE', accent: '#5800FF' },
  research: { short: 'RESEARCH', accent: '#5800FF' },
  legal: { short: 'LEGAL', accent: '#5800FF' },
  future: { short: 'FUTURE IDEAS', accent: '#5800FF' },
  donations: { short: 'GIFTS & CONTRIBUTIONS', accent: '#5800FF' },
  membership: { short: 'MEMBERSHIP', accent: '#5800FF' },
  about: { short: 'ABOUT US', accent: '#5800FF' },
}
