// @vitest-environment jsdom

import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type * as SearchApi from '#/lib/search-api'
import type { ArchiveSearch } from '#/lib/search-api'
import { DEFAULT_SUGGESTIONS, SearchOverlay } from './SearchOverlay'

const mocks = vi.hoisted(() => ({
  auth: {
    isLoading: false,
    isAuthenticated: false,
    getToken: vi.fn<() => Promise<string | undefined>>(),
  },
  navigate: vi.fn(),
  searchArchive: vi.fn(),
  fetchFragments: vi.fn(),
  loadPublishedPages: vi.fn(),
}))

vi.mock('#/lib/auth', () => ({ useOrgAuth: () => mocks.auth }))
vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => mocks.navigate,
}))
vi.mock('#/lib/content-api', () => ({
  loadPublishedPages: mocks.loadPublishedPages,
}))
vi.mock('#/lib/search-api', async (original) => ({
  ...(await original<typeof SearchApi>()),
  searchArchive: mocks.searchArchive,
  fetchFragments: mocks.fetchFragments,
}))

const ANSWER: ArchiveSearch = {
  query: 'lamp',
  type: 'all',
  page: 1,
  pageSize: 10,
  total: 12,
  results: [
    {
      kind: 'belief',
      slug: 'quiet-fern',
      displayName: 'Quiet Fern',
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
      part: 'title',
      snippet: 'Lamp research',
      highlights: [{ start: 0, end: 4 }],
    },
  ],
}

const dialog = () =>
  screen.getByRole('dialog', { name: 'Search the ORG archive' })
const openOverlay = () =>
  act(() => {
    window.dispatchEvent(new CustomEvent('org:open-search'))
  })
const box = () => screen.getByLabelText('What vision do you seek?')

beforeEach(() => {
  mocks.auth.isAuthenticated = false
  mocks.auth.getToken.mockReset().mockResolvedValue('tok')
  mocks.navigate.mockReset()
  // Only the full word answers: a call for a prefix typed on the way
  // ("la", "lam") finds nothing, so it can never stand in for "lamp".
  mocks.searchArchive
    .mockReset()
    .mockImplementation(({ q }: { q: string }) =>
      Promise.resolve(
        q === 'lamp' ? ANSWER : { ...ANSWER, query: q, total: 0, results: [] },
      ),
    )
  mocks.fetchFragments.mockReset().mockResolvedValue({ fragments: [] })
  mocks.loadPublishedPages.mockReset().mockResolvedValue([])
})
afterEach(cleanup)

describe('SearchOverlay', () => {
  it('opens on the event with the default fragments, and searches the server', async () => {
    const user = userEvent.setup()
    render(<SearchOverlay />)
    expect(screen.queryByRole('dialog')).toBeNull()
    openOverlay()
    expect(dialog()).toBeTruthy()
    for (const suggestion of DEFAULT_SUGGESTIONS) {
      expect(
        screen.getByRole('button', { name: suggestion.label }),
      ).toBeTruthy()
    }
    await user.type(box(), 'lamp')
    await waitFor(() =>
      expect(mocks.searchArchive).toHaveBeenLastCalledWith(
        { q: 'lamp', type: 'all', page: 1 },
        undefined,
      ),
    )
    expect(await screen.findByText(/12 FRAGMENTS/)).toBeTruthy()
    expect(screen.getByText('Synthetic belief · Quiet Fern')).toBeTruthy()
    expect(screen.getAllByRole('option')).toHaveLength(2)
    await user.keyboard('{ArrowDown}{ArrowDown}{ArrowUp}{ArrowUp}{Enter}')
    expect(mocks.navigate).toHaveBeenCalledWith({
      to: '/$slug',
      params: { slug: 'quiet-fern' },
    })
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('follows the frequent searches once there are any', async () => {
    const user = userEvent.setup()
    mocks.fetchFragments.mockResolvedValue({ fragments: ['octagon'] })
    mocks.loadPublishedPages.mockResolvedValue([
      {
        pageId: 'legal',
        revision: 1,
        publishedAt: '2026-11-01T00:00:00Z',
        content: {
          kind: 'reference',
          id: 'legal',
          title: 'Legal',
          subtitle: 'Synthetic',
          blocks: [],
        },
      },
    ])
    mocks.searchArchive.mockResolvedValue({
      ...ANSWER,
      total: 1,
      results: ANSWER.results.slice(0, 1),
    })
    render(<SearchOverlay />)
    openOverlay()
    await user.click(await screen.findByRole('button', { name: 'octagon' }))
    expect((box() as HTMLInputElement).value).toBe('octagon')
    await waitFor(() =>
      expect(mocks.searchArchive).toHaveBeenLastCalledWith(
        { q: 'octagon', type: 'all', page: 1 },
        undefined,
      ),
    )
    expect(await screen.findByText(/1 FRAGMENT —/)).toBeTruthy()
  })

  it('opens a page result with the query, and shows all results on the results page', async () => {
    const user = userEvent.setup()
    render(<SearchOverlay />)
    openOverlay()
    await user.type(box(), 'lamp')
    const options = await screen.findAllByRole('option')
    fireEvent.mouseEnter(options[1])
    expect(options[1].getAttribute('aria-selected')).toBe('true')
    await user.click(options[1])
    expect(mocks.navigate).toHaveBeenCalledWith({
      to: '/research',
      search: { q: 'lamp' },
    })
    openOverlay()
    await user.type(box(), 'lamp')
    await user.click(
      await screen.findByRole('button', { name: 'See all 12 results' }),
    )
    expect(mocks.navigate).toHaveBeenLastCalledWith({
      to: '/search',
      search: { q: 'lamp' },
    })
  })

  it('says when nothing matched and while it is searching', async () => {
    const user = userEvent.setup()
    let finish: (value: unknown) => void = () => undefined
    mocks.searchArchive.mockReturnValue(
      new Promise((resolve) => (finish = resolve)),
    )
    render(<SearchOverlay />)
    openOverlay()
    await user.type(box(), 'zz')
    expect(screen.getByRole('status').textContent).toContain('Searching')
    await act(async () => {
      finish({ ...ANSWER, total: 0, results: [] })
      await Promise.resolve()
    })
    expect(await screen.findByText('No matches in the records.')).toBeTruthy()
  })

  it('searches the ORG pages it has when the server cannot be reached', async () => {
    const user = userEvent.setup()
    mocks.searchArchive.mockRejectedValue(new Error('offline'))
    // Offline, so the published pages cannot load either: the bundled ones stay.
    mocks.loadPublishedPages.mockRejectedValue(new Error('offline'))
    render(<SearchOverlay />)
    openOverlay()
    await user.type(box(), 'community')
    expect((await screen.findByRole('alert')).textContent).toContain(
      'showing ORG pages only',
    )
    const [first] = await screen.findAllByRole('option')
    await user.click(first)
    expect(mocks.navigate).toHaveBeenCalledWith(
      expect.objectContaining({ search: { q: 'community' } }),
    )
    expect(screen.queryByRole('button', { name: /See all/ })).toBeNull()
  })

  it('closes on Escape, the close button, the backdrop and Ctrl+K, and reopens with Ctrl+K', async () => {
    const user = userEvent.setup()
    render(<SearchOverlay />)
    await user.keyboard('{Control>}k{/Control}')
    expect(dialog()).toBeTruthy()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).toBeNull()
    await user.keyboard('{Meta>}K{/Meta}')
    fireEvent.click(screen.getByText('THE ORG ARCHIVE'))
    expect(dialog()).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Close search' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    openOverlay()
    fireEvent.click(dialog())
    expect(screen.queryByRole('dialog')).toBeNull()
    openOverlay()
    await user.keyboard('{Control>}k{/Control}')
    expect(screen.queryByRole('dialog')).toBeNull()
    // Keys do nothing while closed.
    await user.keyboard('{Escape}{ArrowDown}')
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('refreshes the ORG pages when they are published, and survives failed loads', async () => {
    mocks.loadPublishedPages.mockRejectedValue(new Error('down'))
    mocks.fetchFragments.mockRejectedValue(new Error('down'))
    render(<SearchOverlay />)
    act(() => {
      window.dispatchEvent(new CustomEvent('org:content-published'))
    })
    openOverlay()
    await waitFor(() =>
      expect(mocks.loadPublishedPages).toHaveBeenCalledTimes(2),
    )
    mocks.loadPublishedPages.mockResolvedValue([
      {
        pageId: 'legal',
        revision: 1,
        publishedAt: '2026-11-01T00:00:00Z',
        content: {
          kind: 'reference',
          id: 'legal',
          title: 'Legal',
          subtitle: 'Synthetic',
          blocks: [],
        },
      },
    ])
    act(() => {
      window.dispatchEvent(new CustomEvent('org:content-published'))
    })
    await waitFor(() =>
      expect(mocks.loadPublishedPages).toHaveBeenCalledTimes(3),
    )
    expect(
      screen.getByRole('button', { name: DEFAULT_SUGGESTIONS[0].label }),
    ).toBeTruthy()
  })

  it('does nothing on Enter with no results', async () => {
    const user = userEvent.setup()
    render(<SearchOverlay />)
    openOverlay()
    await user.keyboard('{Enter}')
    expect(mocks.navigate).not.toHaveBeenCalled()
  })
})
