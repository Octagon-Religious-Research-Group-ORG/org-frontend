// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type * as SearchApi from '#/lib/search-api'
import type { ArchiveSearch } from '#/lib/search-api'
import { SearchResults } from './SearchResults'
import type { SearchParams } from './SearchResults'

const mocks = vi.hoisted(() => ({
  auth: {
    isLoading: false,
    isAuthenticated: false,
    getToken: vi.fn<() => Promise<string | undefined>>(),
  },
  searchArchive: vi.fn(),
}))

vi.mock('#/lib/auth', () => ({ useOrgAuth: () => mocks.auth }))
vi.mock('#/lib/search-api', async (original) => ({
  ...(await original<typeof SearchApi>()),
  searchArchive: mocks.searchArchive,
}))
vi.mock('@tanstack/react-router', () => ({
  Link: ({
    children,
    to,
    params,
    search,
  }: {
    children: ReactNode
    to: string
    params?: { slug: string }
    search?: { q: string }
  }) => (
    <a
      href={`${params ? `/${params.slug}` : to}${search ? `?q=${search.q}` : ''}`}
    >
      {children}
    </a>
  ),
}))

const ANSWER: ArchiveSearch = {
  query: 'lamp',
  type: 'all',
  page: 1,
  pageSize: 10,
  total: 23,
  results: [
    {
      kind: 'member',
      slug: 'quiet-fern',
      displayName: 'Lamp Fern',
      membersOnly: true,
      snippet: 'Lamp Fern',
      highlights: [{ start: 0, end: 4 }],
    },
    {
      kind: 'member',
      slug: 'open-fern',
      displayName: 'Open Lamp',
      membersOnly: false,
      snippet: 'Open Lamp',
      highlights: [],
    },
    {
      kind: 'belief',
      slug: 'quiet-fern',
      displayName: 'Lamp Fern',
      tabId: 't1',
      title: 'Synthetic belief',
      matched: 'text',
      snippet: 'A lamp burns.',
      highlights: [{ start: 2, end: 6 }],
    },
    {
      kind: 'page',
      pageId: 'research',
      title: 'Research',
      part: 'block:r1',
      snippet: 'A lamp study.',
      highlights: [{ start: 2, end: 6 }],
    },
  ],
}

const params = (extra: Partial<SearchParams> = {}): SearchParams => ({
  q: 'lamp',
  type: 'all',
  page: 1,
  ...extra,
})

beforeEach(() => {
  mocks.auth.isLoading = false
  mocks.auth.isAuthenticated = false
  mocks.auth.getToken.mockReset().mockResolvedValue('tok')
  mocks.searchArchive.mockReset().mockResolvedValue(ANSWER)
})
afterEach(cleanup)

describe('SearchResults', () => {
  it('searches as a guest and shows each kind of result with its highlight', async () => {
    render(<SearchResults params={params()} onChange={vi.fn()} />)
    expect(screen.getByRole('status').textContent).toBe('Searching…')
    expect(await screen.findByText('23 results')).toBeTruthy()
    expect(mocks.searchArchive).toHaveBeenCalledWith(
      { q: 'lamp', type: 'all', page: 1 },
      undefined,
    )
    expect(mocks.auth.getToken).not.toHaveBeenCalled()
    expect(screen.getByText(/members-only pages are not searched/)).toBeTruthy()
    expect(screen.getByText('MEMBER · NAME ONLY')).toBeTruthy()
    expect(screen.getByText('MEMBER')).toBeTruthy()
    expect(screen.getByText('BELIEF')).toBeTruthy()
    expect(screen.getByText('ORG PAGE')).toBeTruthy()
    expect(screen.getByText(/Members only: sign in/)).toBeTruthy()
    expect(screen.getByText('Synthetic belief · Lamp Fern')).toBeTruthy()
    expect(
      screen.getAllByText('lamp', { selector: 'mark' }).length,
    ).toBeGreaterThan(0)
    const links = screen.getAllByRole('link').map((a) => a.getAttribute('href'))
    expect(links).toContain('/quiet-fern')
    expect(links).toContain('/research?q=lamp')
  })

  it('searches as the signed-in member', async () => {
    mocks.auth.isAuthenticated = true
    const { rerender } = render(
      <SearchResults params={params()} onChange={vi.fn()} />,
    )
    await screen.findByText('23 results')
    expect(mocks.searchArchive).toHaveBeenCalledWith(
      { q: 'lamp', type: 'all', page: 1 },
      'tok',
    )
    expect(screen.queryByText(/members-only pages are not searched/)).toBeNull()
    // A new query keeps the old results on screen until its answer arrives.
    mocks.searchArchive.mockReturnValue(new Promise(() => undefined))
    rerender(
      <SearchResults params={params({ q: 'light' })} onChange={vi.fn()} />,
    )
    expect(await screen.findByText('Searching…')).toBeTruthy()
    expect(screen.getByText('23 results')).toBeTruthy()
  })

  it('waits for the sign-in to be known', () => {
    mocks.auth.isLoading = true
    render(<SearchResults params={params()} onChange={vi.fn()} />)
    expect(mocks.searchArchive).not.toHaveBeenCalled()
  })

  it('pages, filters and searches again', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<SearchResults params={params({ page: 2 })} onChange={onChange} />)
    expect(await screen.findByText('Page 2 of 3')).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Next' }))
    expect(onChange).toHaveBeenLastCalledWith(params({ page: 3 }))
    await user.click(screen.getByRole('button', { name: 'Previous' }))
    expect(onChange).toHaveBeenLastCalledWith(params({ page: 1 }))
    await user.click(screen.getByRole('button', { name: 'Beliefs' }))
    expect(onChange).toHaveBeenLastCalledWith(params({ type: 'beliefs' }))
    expect(
      screen
        .getByRole('button', { name: 'Everything' })
        .getAttribute('aria-pressed'),
    ).toBe('true')
    const box = screen.getByRole('searchbox', { name: 'Search the archive' })
    await user.clear(box)
    await user.type(box, ' light {Enter}')
    expect(onChange).toHaveBeenLastCalledWith(params({ q: 'light' }))
  })

  it('has no pager for one page', async () => {
    mocks.searchArchive.mockResolvedValue({
      ...ANSWER,
      total: 1,
      results: ANSWER.results.slice(0, 1),
    })
    render(<SearchResults params={params()} onChange={vi.fn()} />)
    expect(await screen.findByText('1 result')).toBeTruthy()
    expect(screen.queryByRole('navigation')).toBeNull()
  })

  it('says when nothing matched, and when the query is too short', async () => {
    mocks.searchArchive.mockResolvedValue({ ...ANSWER, total: 0, results: [] })
    const { rerender } = render(
      <SearchResults params={params()} onChange={vi.fn()} />,
    )
    expect(
      await screen.findByText('No matches in the records for “lamp”.'),
    ).toBeTruthy()
    rerender(<SearchResults params={params({ q: 'l' })} onChange={vi.fn()} />)
    expect(screen.getByText(/at least 2 characters/)).toBeTruthy()
  })

  it('shows an error and tries again', async () => {
    const user = userEvent.setup()
    mocks.searchArchive
      .mockRejectedValueOnce(new Error('The ORG server is having trouble.'))
      .mockRejectedValueOnce('raw')
    render(<SearchResults params={params()} onChange={vi.fn()} />)
    expect((await screen.findByRole('alert')).textContent).toBe(
      'The ORG server is having trouble.',
    )
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toBe(
        'Search is unavailable.',
      ),
    )
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByText('23 results')).toBeTruthy()
  })

  it('drops the answer of a query it has moved on from', async () => {
    let finish: (value: unknown) => void = () => undefined
    let fail: (value: unknown) => void = () => undefined
    mocks.searchArchive
      .mockReturnValueOnce(new Promise((resolve) => (finish = resolve)))
      .mockReturnValueOnce(new Promise((_, reject) => (fail = reject)))
    const { rerender, unmount } = render(
      <SearchResults params={params()} onChange={vi.fn()} />,
    )
    await waitFor(() => expect(mocks.searchArchive).toHaveBeenCalledTimes(1))
    rerender(
      <SearchResults params={params({ q: 'light' })} onChange={vi.fn()} />,
    )
    await waitFor(() => expect(mocks.searchArchive).toHaveBeenCalledTimes(2))
    finish(ANSWER)
    unmount()
    fail(new Error('late'))
    await Promise.resolve()
    expect(screen.queryByText('23 results')).toBeNull()
    expect(screen.queryByRole('alert')).toBeNull()
  })
})
