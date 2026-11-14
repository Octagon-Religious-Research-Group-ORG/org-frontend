import { useEffect, useState } from 'react'
import { Link } from '@tanstack/react-router'
import {
  MAX_QUERY_LENGTH,
  MAX_RESULT_PAGE,
  resultLink,
  SEARCH_TYPE_LABELS,
  SEARCH_TYPES,
} from '#/lib/search-api'
import type { ArchiveResult, SearchType } from '#/lib/search-api'
import { useOrgAuth } from '#/lib/auth'
import { resultBadge, resultContext, ResultSnippet } from './ResultSnippet'
import { MIN_QUERY_LENGTH, useArchiveSearch } from './use-archive-search'

export interface SearchParams {
  q: string
  type: SearchType
  page: number
}

function ResultRow({
  result,
  query,
}: {
  result: ArchiveResult
  query: string
}) {
  return (
    <li className="border-l-2 border-[rgba(236,226,196,0.14)] py-3 pl-4 hover:border-[#d4a24a]">
      <Link
        {...(resultLink(result, query) as { to: string })}
        className="group block no-underline"
      >
        <span className="font-mono text-[10px] uppercase tracking-[0.26em] text-[#d4a24a]">
          {resultBadge(result)}
        </span>
        <span className="mt-1 block text-[15px] leading-snug text-[#ece2c4] [overflow-wrap:anywhere] group-hover:text-white">
          <ResultSnippet result={result} />
        </span>
        <span className="mt-1 block text-[11px] uppercase tracking-[0.2em] text-[#9f9676] [overflow-wrap:anywhere]">
          {resultContext(result)}
        </span>
      </Link>
    </li>
  )
}

/**
 * The full results page (Chunk 15): a search box, filters by kind, paging,
 * and a clear loading, empty and error state. A signed-in member gets
 * members-only results; a guest gets only what a guest may read.
 */
export function SearchResults({
  params,
  onChange,
}: {
  params: SearchParams
  onChange: (next: SearchParams) => void
}) {
  const auth = useOrgAuth()
  const [draft, setDraft] = useState(params.q)
  useEffect(() => setDraft(params.q), [params.q])
  const { state, retry } = useArchiveSearch(params.q, params.type, params.page)
  const data =
    state.status === 'ready' || state.status === 'loading'
      ? state.data
      : undefined
  const pages = data
    ? Math.min(MAX_RESULT_PAGE, Math.ceil(data.total / data.pageSize))
    : 0
  const tooShort = params.q.trim().length < MIN_QUERY_LENGTH

  return (
    <section aria-labelledby="search-heading" className="text-[#ece2c4]">
      <h1
        id="search-heading"
        className="text-[clamp(28px,6vw,52px)] font-thin uppercase tracking-[0.06em] text-[#f6efd9]"
      >
        The Perforated Index
      </h1>
      <form
        role="search"
        className="mt-6"
        onSubmit={(event) => {
          event.preventDefault()
          onChange({ q: draft.trim(), type: params.type, page: 1 })
        }}
      >
        <label
          htmlFor="archive-search"
          className="block text-[10px] uppercase tracking-[0.34em] text-[#9f9676]"
        >
          Search the archive
        </label>
        <div className="mt-2 flex gap-3">
          <input
            id="archive-search"
            type="search"
            value={draft}
            maxLength={MAX_QUERY_LENGTH}
            onChange={(event) => setDraft(event.target.value)}
            className="min-w-0 flex-1 border-0 border-b border-dashed border-[#d4a24a]/60 bg-transparent pb-2 text-[17px] font-light text-[#f3ead0] placeholder:text-[#9f9676] focus:border-[#d4a24a] focus:outline-none"
            placeholder="Names, beliefs, ORG pages…"
            spellCheck={false}
          />
          <button
            type="submit"
            className="border border-[rgba(236,226,196,0.28)] px-4 py-1 text-[11px] uppercase tracking-[0.24em] text-[#d8ceb0] hover:border-[#d4a24a]"
          >
            Search
          </button>
        </div>
      </form>

      <div role="group" aria-label="Show" className="mt-5 flex flex-wrap gap-2">
        {SEARCH_TYPES.map((type) => (
          <button
            key={type}
            type="button"
            aria-pressed={type === params.type}
            onClick={() => onChange({ q: params.q, type, page: 1 })}
            className={`border px-3 py-1 text-[11px] uppercase tracking-[0.2em] transition-colors ${
              type === params.type
                ? 'border-[#d4a24a] text-[#f0e6d0]'
                : 'border-[rgba(236,226,196,0.22)] text-[#b8ad8d] hover:border-[#d4a24a]'
            }`}
          >
            {SEARCH_TYPE_LABELS[type]}
          </button>
        ))}
      </div>

      {!auth.isLoading && !auth.isAuthenticated && (
        <p className="mt-4 text-xs text-[#9f9676]">
          Signed out: members-only pages are not searched.
        </p>
      )}

      <div aria-live="polite" className="mt-6">
        {tooShort && (
          <p className="text-sm text-[#9f9676]">
            Type at least {MIN_QUERY_LENGTH} characters to search.
          </p>
        )}
        {state.status === 'loading' && (
          <p role="status" className="text-sm text-[#9f9676]">
            Searching…
          </p>
        )}
        {state.status === 'error' && (
          <div>
            <p role="alert" className="text-sm text-[#f1a07a]">
              {state.error}
            </p>
            <button
              type="button"
              onClick={retry}
              className="mt-3 border border-[rgba(236,226,196,0.28)] px-3 py-1 text-[11px] uppercase tracking-[0.2em] text-[#d8ceb0]"
            >
              Try again
            </button>
          </div>
        )}
        {state.status === 'ready' && state.data.total === 0 && (
          <p className="text-sm text-[#b8ad8d]">
            No matches in the records for “{state.data.query}”.
          </p>
        )}
        {data && data.total > 0 && (
          <>
            <p className="text-[10px] uppercase tracking-[0.32em] text-[#9f9676]">
              {data.total} result{data.total === 1 ? '' : 's'}
            </p>
            <ol
              aria-label="Search results"
              className="mt-3 flex flex-col gap-1"
            >
              {data.results.map((result, index) => (
                <ResultRow
                  key={`${data.page}-${index}`}
                  result={result}
                  query={data.query}
                />
              ))}
            </ol>
            {pages > 1 && (
              <nav
                aria-label="Result pages"
                className="mt-6 flex items-center gap-3 text-[11px] uppercase tracking-[0.2em]"
              >
                <button
                  type="button"
                  disabled={params.page <= 1}
                  onClick={() => onChange({ ...params, page: params.page - 1 })}
                  className="border border-[rgba(236,226,196,0.28)] px-3 py-1 disabled:opacity-40"
                >
                  Previous
                </button>
                <span className="text-[#9f9676]">
                  Page {params.page} of {pages}
                </span>
                <button
                  type="button"
                  disabled={params.page >= pages}
                  onClick={() => onChange({ ...params, page: params.page + 1 })}
                  className="border border-[rgba(236,226,196,0.28)] px-3 py-1 disabled:opacity-40"
                >
                  Next
                </button>
              </nav>
            )}
          </>
        )}
      </div>
    </section>
  )
}
