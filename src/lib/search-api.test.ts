import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  fetchAdminFragments,
  fetchFragments,
  resultLink,
  searchArchive,
  setFragmentHidden,
  snippetParts,
} from './search-api'
import type { ArchiveResult } from './search-api'

const mocks = vi.hoisted(() => ({ memberRequest: vi.fn() }))
vi.mock('./membership-api', () => ({ memberRequest: mocks.memberRequest }))

beforeEach(() => {
  mocks.memberRequest.mockReset().mockResolvedValue({})
})

describe('search api', () => {
  it('asks as a guest unless given a token, and sends only what differs from the defaults', async () => {
    await searchArchive({ q: 'lamp light' })
    expect(mocks.memberRequest).toHaveBeenLastCalledWith(
      '/search?q=lamp+light',
      {},
    )
    await searchArchive({ q: 'lamp', type: 'beliefs', page: 2 }, 'tok')
    expect(mocks.memberRequest).toHaveBeenLastCalledWith(
      '/search?q=lamp&type=beliefs&page=2',
      { token: 'tok' },
    )
    await searchArchive({ q: 'lamp', type: 'all', page: 1 })
    expect(mocks.memberRequest).toHaveBeenLastCalledWith('/search?q=lamp', {})
  })

  it('reads and sets the fragments', async () => {
    await fetchFragments()
    expect(mocks.memberRequest).toHaveBeenLastCalledWith('/search/fragments')
    await fetchAdminFragments('tok')
    expect(mocks.memberRequest).toHaveBeenLastCalledWith(
      '/admin/search-fragments',
      { token: 'tok' },
    )
    await setFragmentHidden('tok', 'lamp', true, 'why')
    expect(mocks.memberRequest).toHaveBeenLastCalledWith(
      '/admin/search-fragments',
      {
        token: 'tok',
        method: 'POST',
        body: JSON.stringify({ term: 'lamp', hidden: true, reason: 'why' }),
      },
    )
    await setFragmentHidden('tok', 'lamp', false)
    expect(
      JSON.parse(
        (mocks.memberRequest.mock.lastCall?.[1] as { body: string }).body,
      ),
    ).toEqual({ term: 'lamp', hidden: false })
  })

  it('links a member or belief to its page and an ORG page with the query', () => {
    const base = { snippet: 's', highlights: [] }
    expect(
      resultLink(
        {
          ...base,
          kind: 'member',
          slug: 'quiet-fern',
          displayName: 'Quiet Fern',
          membersOnly: false,
        },
        'fern',
      ),
    ).toEqual({ to: '/$slug', params: { slug: 'quiet-fern' } })
    const page: ArchiveResult = {
      ...base,
      kind: 'page',
      pageId: 'future',
      title: 'Future Ideas',
      part: 'title',
    }
    expect(resultLink(page, 'idea')).toEqual({
      to: '/future-ideas',
      search: { q: 'idea' },
    })
  })

  it('cuts a snippet into marked runs, ignoring bad offsets', () => {
    expect(
      snippetParts('a lamp and a lamp', [
        { start: 2, end: 6 },
        { start: 3, end: 5 },
        { start: 13, end: 17 },
        { start: 15, end: 99 },
        { start: 17, end: 99 },
        { start: 17, end: 17 },
      ]),
    ).toEqual([
      { text: 'a ', marked: false },
      { text: 'lamp', marked: true },
      { text: ' and a ', marked: false },
      { text: 'lamp', marked: true },
    ])
    expect(snippetParts('lamp', [{ start: 0, end: 4 }])).toEqual([
      { text: 'lamp', marked: true },
    ])
  })
})
