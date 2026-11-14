import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { SearchResults } from '#/components/search/SearchResults'
import type { SearchParams } from '#/components/search/SearchResults'
import { ShopShell } from '#/components/shop/ShopShell'
import { MAX_RESULT_PAGE, SEARCH_TYPES } from '#/lib/search-api'
import type { SearchType } from '#/lib/search-api'

/** Reads the address bar leniently: anything odd falls back to the defaults. */
export function readSearchParams(raw: Record<string, unknown>): SearchParams {
  const q = typeof raw.q === 'string' ? raw.q.slice(0, 100) : ''
  const type = SEARCH_TYPES.includes(raw.type as SearchType)
    ? (raw.type as SearchType)
    : 'all'
  const page = Number(raw.page)
  return {
    q,
    type,
    page:
      Number.isInteger(page) && page >= 1 && page <= MAX_RESULT_PAGE ? page : 1,
  }
}

export const Route = createFileRoute('/search')({
  validateSearch: readSearchParams,
  head: () => ({
    meta: [
      { title: 'Search — ORG' },
      {
        name: 'description',
        content: 'Search ORG pages, member names and beliefs.',
      },
    ],
  }),
  component: SearchPage,
})

function SearchPage() {
  const params = Route.useSearch()
  const navigate = useNavigate()
  return (
    <ShopShell>
      <main className="relative z-[1] mx-auto max-w-[880px] px-[clamp(16px,4vw,40px)] pb-24 pt-[clamp(132px,16vh,176px)]">
        <SearchResults
          params={params}
          onChange={(next) =>
            void navigate({
              to: '/search',
              search: {
                q: next.q,
                ...(next.type !== 'all' ? { type: next.type } : {}),
                ...(next.page > 1 ? { page: next.page } : {}),
              } as never,
            })
          }
        />
      </main>
    </ShopShell>
  )
}
