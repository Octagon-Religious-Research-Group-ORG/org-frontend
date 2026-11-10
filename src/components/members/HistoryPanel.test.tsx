// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type * as MembersApi from '#/lib/members-api'
import type { HistoryEntry } from '#/lib/members-api'
import { HistoryPanel, formatSavedAt } from './HistoryPanel'

const mocks = vi.hoisted(() => ({
  auth: {
    isLoading: false,
    isAuthenticated: false,
    getToken: vi.fn(),
  },
  fetchHistory: vi.fn(),
}))

vi.mock('#/lib/auth', () => ({ useOrgAuth: () => mocks.auth }))
vi.mock('#/lib/members-api', async (original) => ({
  ...(await original<typeof MembersApi>()),
  fetchHistory: mocks.fetchHistory,
}))

const entry = (overrides: Partial<HistoryEntry> = {}): HistoryEntry => ({
  seq: 2,
  savedAt: '2026-11-01T12:30:00.000Z',
  text: 'A synthetic belief, edited.',
  hash: 'abcdef012345',
  source: 'member',
  beforeFirstEdit: false,
  ...overrides,
})

const onClose = vi.fn()

beforeEach(() => {
  mocks.auth.isLoading = false
  mocks.auth.isAuthenticated = false
  mocks.auth.getToken.mockReset().mockResolvedValue('tok')
  mocks.fetchHistory.mockReset().mockResolvedValue({
    entries: [entry()],
    page: 1,
    hasMore: false,
  })
  onClose.mockClear()
})

afterEach(cleanup)

describe('HistoryPanel', () => {
  it('reads a bio history as a guest, without a token', async () => {
    render(<HistoryPanel slug="quiet-fern" label="the bio" onClose={onClose} />)
    expect(screen.getByRole('status').textContent).toMatch(/Opening/)
    expect(await screen.findByText('A synthetic belief, edited.')).toBeTruthy()
    expect(mocks.fetchHistory).toHaveBeenCalledWith(
      'quiet-fern',
      { kind: 'bio' },
      { page: 1, token: undefined },
    )
    expect(mocks.auth.getToken).not.toHaveBeenCalled()
  })

  it('shows server time, the short hash, and no note for a whole member version', async () => {
    render(<HistoryPanel slug="quiet-fern" label="the bio" onClose={onClose} />)
    const time = await screen.findByText('Nov 1, 2026, 12:30 PM UTC')
    expect(time.getAttribute('dateTime')).toBe('2026-11-01T12:30:00.000Z')
    expect(screen.getByText('abcdef012345')).toBeTruthy()
    expect(screen.queryByText(/Imported/)).toBeNull()
  })

  it('reads a belief title history with the token when signed in', async () => {
    mocks.auth.isAuthenticated = true
    render(
      <HistoryPanel
        slug="quiet-fern"
        tabId="tab_1"
        field="title"
        label="the title"
        onClose={onClose}
      />,
    )
    await screen.findByText('A synthetic belief, edited.')
    expect(mocks.fetchHistory).toHaveBeenCalledWith(
      'quiet-fern',
      { kind: 'tab', tabId: 'tab_1', field: 'title' },
      { page: 1, token: 'tok' },
    )
  })

  it('reads a belief text history by default', async () => {
    render(
      <HistoryPanel
        slug="quiet-fern"
        tabId="tab_1"
        label="x"
        onClose={onClose}
      />,
    )
    await screen.findByText('A synthetic belief, edited.')
    expect(mocks.fetchHistory.mock.calls[0][1]).toEqual({
      kind: 'tab',
      tabId: 'tab_1',
      field: 'text',
    })
  })

  it('labels imported text with the import date only, never an older one', async () => {
    mocks.fetchHistory.mockResolvedValue({
      entries: [
        entry({
          source: 'imported',
          beforeFirstEdit: true,
          savedAt: '2026-10-11T08:00:00.000Z',
          partHashes: ['aaaaaaaaaaaa', 'bbbbbbbbbbbb'],
        }),
        entry({ source: 'title-before-history', seq: 1, hash: 'ffff' }),
      ],
      page: 1,
      hasMore: false,
    })
    render(<HistoryPanel slug="quiet-fern" label="x" onClose={onClose} />)
    expect(
      await screen.findByText(
        'Imported from Apple Pages; originally written before Oct 11, 2026. The text before its first edit here.',
      ),
    ).toBeTruthy()
    // Each paragraph's own fingerprint, in reading order.
    expect(screen.getByText('aaaaaaaaaaaa · bbbbbbbbbbbb')).toBeTruthy()
    expect(
      screen.getByText('The title before its first edit here.'),
    ).toBeTruthy()
  })

  it('shows member text with HTML in it as the characters it is, never as markup', async () => {
    const hostile =
      '<script>window.hacked = 1</script><img src=x onerror="window.hacked = 2"><b>bold</b>'
    mocks.fetchHistory.mockResolvedValue({
      entries: [entry({ text: hostile })],
      page: 1,
      hasMore: false,
    })
    const { container } = render(
      <HistoryPanel slug="quiet-fern" label="x" onClose={onClose} />,
    )
    await screen.findByText(hostile)
    expect(container.querySelector('script')).toBeNull()
    expect(container.querySelector('img')).toBeNull()
    expect(container.querySelector('b')).toBeNull()
  })

  it('says when there is nothing yet', async () => {
    mocks.fetchHistory.mockResolvedValue({
      entries: [],
      page: 1,
      hasMore: false,
    })
    render(<HistoryPanel slug="quiet-fern" label="x" onClose={onClose} />)
    expect(await screen.findByText('No saved versions yet.')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Older' })).toBeNull()
  })

  it('pages older and newer', async () => {
    mocks.fetchHistory.mockResolvedValueOnce({
      entries: [entry()],
      page: 1,
      hasMore: true,
    })
    mocks.fetchHistory.mockResolvedValueOnce({
      entries: [entry({ seq: 1, text: 'Older text' })],
      page: 2,
      hasMore: false,
    })
    render(<HistoryPanel slug="quiet-fern" label="x" onClose={onClose} />)
    await screen.findByText('A synthetic belief, edited.')
    expect(
      screen.getByRole<HTMLButtonElement>('button', { name: 'Newer' }).disabled,
    ).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Older' }))
    await screen.findByText('Older text')
    expect(mocks.fetchHistory.mock.calls[1][2]).toEqual({
      page: 2,
      token: undefined,
    })
    expect(
      screen.getByRole<HTMLButtonElement>('button', { name: 'Older' }).disabled,
    ).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Newer' }))
    await waitFor(() => expect(mocks.fetchHistory).toHaveBeenCalledTimes(3))
    expect(mocks.fetchHistory.mock.calls[2][2]).toEqual({
      page: 1,
      token: undefined,
    })
  })

  it('shows the server’s refusal in its own words', async () => {
    mocks.fetchHistory.mockRejectedValue(new Error('That page does not exist.'))
    render(<HistoryPanel slug="quiet-fern" label="x" onClose={onClose} />)
    expect((await screen.findByRole('alert')).textContent).toBe(
      'That page does not exist.',
    )
  })

  it('has a plain message for anything that is not an error', async () => {
    mocks.fetchHistory.mockRejectedValue('odd')
    render(<HistoryPanel slug="quiet-fern" label="x" onClose={onClose} />)
    expect((await screen.findByRole('alert')).textContent).toBe(
      'This history is unavailable.',
    )
  })

  it('refuses to ask as a guest when the sign-in cannot be confirmed', async () => {
    mocks.auth.isAuthenticated = true
    mocks.auth.getToken.mockResolvedValue(null)
    render(<HistoryPanel slug="quiet-fern" label="x" onClose={onClose} />)
    expect((await screen.findByRole('alert')).textContent).toMatch(
      /couldn't confirm/,
    )
    expect(mocks.fetchHistory).not.toHaveBeenCalled()
  })

  it('waits for the sign-in check before asking', () => {
    mocks.auth.isLoading = true
    render(<HistoryPanel slug="quiet-fern" label="x" onClose={onClose} />)
    expect(mocks.fetchHistory).not.toHaveBeenCalled()
  })

  it('ignores an answer that arrives after it closed', async () => {
    let finish: (value: unknown) => void = () => undefined
    let fail: (error: unknown) => void = () => undefined
    mocks.fetchHistory
      .mockReturnValueOnce(new Promise((resolve) => (finish = resolve)))
      .mockReturnValueOnce(new Promise((_, reject) => (fail = reject)))
    const first = render(
      <HistoryPanel slug="quiet-fern" label="x" onClose={onClose} />,
    )
    first.unmount()
    finish({ entries: [entry()], page: 1, hasMore: false })
    const second = render(
      <HistoryPanel slug="quiet-fern" label="x" onClose={onClose} />,
    )
    second.unmount()
    fail(new Error('late'))
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('closes', async () => {
    render(<HistoryPanel slug="quiet-fern" label="x" onClose={onClose} />)
    await screen.findByText('A synthetic belief, edited.')
    fireEvent.click(screen.getByRole('button', { name: 'Close history' }))
    expect(onClose).toHaveBeenCalled()
  })

  it('formats any time in UTC', () => {
    expect(formatSavedAt('2026-01-02T23:05:00.000Z')).toBe(
      'Jan 2, 2026, 11:05 PM UTC',
    )
  })
})
