import { memberRequest } from './membership-api'
import type { WebsitePageId } from './content-types'

/** What the server searches (Chunk 15); comments are not searched. */
export const SEARCH_TYPES = ['all', 'members', 'beliefs', 'pages'] as const
export type SearchType = (typeof SEARCH_TYPES)[number]

export const SEARCH_TYPE_LABELS: Record<SearchType, string> = {
  all: 'Everything',
  members: 'Members',
  beliefs: 'Beliefs',
  pages: 'ORG pages',
}

/** The server's limits: a longer query is refused, a later page too. */
export const MAX_QUERY_LENGTH = 100
export const MAX_RESULT_PAGE = 50

export interface Highlight {
  start: number
  end: number
}

interface Snippet {
  snippet: string
  highlights: Array<Highlight>
}

export type ArchiveResult =
  | ({
      kind: 'member'
      slug: string
      displayName: string
      /** This reader may see only the name, as in the directory. */
      membersOnly: boolean
    } & Snippet)
  | ({
      kind: 'belief'
      slug: string
      displayName: string
      tabId: string
      title: string
      matched: 'title' | 'text'
    } & Snippet)
  | ({
      kind: 'page'
      pageId: WebsitePageId
      title: string
      part: string
    } & Snippet)

export interface ArchiveSearch {
  query: string
  type: SearchType
  page: number
  pageSize: number
  total: number
  results: Array<ArchiveResult>
}

/**
 * One page of results as this reader may see them: the server decides from
 * the token, so a signed-out call gets only what a guest may read.
 */
export function searchArchive(
  query: { q: string; type?: SearchType; page?: number },
  token?: string,
) {
  const params = new URLSearchParams({ q: query.q })
  if (query.type && query.type !== 'all') params.set('type', query.type)
  if (query.page && query.page > 1) params.set('page', String(query.page))
  return memberRequest<ArchiveSearch>(`/search?${params.toString()}`, {
    ...(token ? { token } : {}),
  })
}

/** The Perforated Index's Suggested Fragments, most searched first. */
export function fetchFragments() {
  return memberRequest<{ fragments: Array<string> }>('/search/fragments')
}

export interface AdminFragment {
  term: string
  searchers: number
  hidden: boolean
  /** Readers see it now. */
  shown: boolean
}

export function fetchAdminFragments(token: string) {
  return memberRequest<{ fragments: Array<AdminFragment> }>(
    '/admin/search-fragments',
    { token },
  )
}

export function setFragmentHidden(
  token: string,
  term: string,
  hidden: boolean,
  reason?: string,
) {
  return memberRequest<{ term: string; hidden: boolean }>(
    '/admin/search-fragments',
    {
      token,
      method: 'POST',
      body: JSON.stringify({ term, hidden, ...(reason ? { reason } : {}) }),
    },
  )
}

const PAGE_HREFS: Record<WebsitePageId, string> = {
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

/** Where a result opens: a member's page, or an ORG page highlighting the query. */
export function resultLink(
  result: ArchiveResult,
  query: string,
):
  | { to: '/$slug'; params: { slug: string } }
  | { to: string; search: { q: string } } {
  if (result.kind === 'page') {
    return { to: PAGE_HREFS[result.pageId], search: { q: query } }
  }
  return { to: '/$slug', params: { slug: result.slug } }
}

/** A snippet cut into plain and highlighted runs, from the server's offsets. */
export function snippetParts(
  snippet: string,
  highlights: Array<Highlight>,
): Array<{ text: string; marked: boolean }> {
  const parts: Array<{ text: string; marked: boolean }> = []
  let at = 0
  for (const { start, end } of highlights) {
    if (start < at || end > snippet.length || end <= start) continue
    if (start > at)
      parts.push({ text: snippet.slice(at, start), marked: false })
    parts.push({ text: snippet.slice(start, end), marked: true })
    at = end
  }
  if (at < snippet.length)
    parts.push({ text: snippet.slice(at), marked: false })
  return parts
}
