// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '#/lib/api'
import type * as AdminApi from '#/lib/admin-api'
import {
  InboxSection,
  KIND_LABELS,
  OWN_NOTICE,
  reportSubject,
} from './InboxSection'

const mocks = vi.hoisted(() => ({
  auth: {
    isLoading: false,
    isAuthenticated: true,
    user: { sub: 'user_admin' },
    getToken: vi.fn<() => Promise<string | undefined>>(),
  },
  fetchInbox: vi.fn(),
  markInboxHandled: vi.fn(),
  resetEamRequest: vi.fn(),
}))

vi.mock('#/lib/auth', () => ({ useOrgAuth: () => mocks.auth }))
vi.mock('#/lib/admin-api', async (original) => ({
  ...(await original<typeof AdminApi>()),
  fetchInbox: mocks.fetchInbox,
  markInboxHandled: mocks.markInboxHandled,
  resetEamRequest: mocks.resetEamRequest,
}))
vi.mock('@tanstack/react-router', async () => ({
  Link: (await import('./test-helpers')).FakeLink,
}))

const entry = (overrides: Record<string, unknown> = {}) => ({
  entryId: 'e1',
  kind: 'page-submitted',
  status: 'open',
  subjectUserId: 'user_m',
  page: {
    slug: 'quiet-fern',
    displayName: 'Quiet Fern',
    reviewStatus: 'pending',
  },
  createdAt: '2026-11-13T10:00:00Z',
  ...overrides,
})

beforeEach(() => {
  mocks.auth.user = { sub: 'user_admin' }
  mocks.auth.getToken.mockReset().mockResolvedValue('tok')
  mocks.fetchInbox.mockReset().mockResolvedValue({
    entries: [entry()],
    hasMore: false,
  })
  mocks.markInboxHandled.mockReset().mockResolvedValue({ handled: true })
  mocks.resetEamRequest.mockReset().mockResolvedValue({ reset: true })
})
afterEach(cleanup)

describe('InboxSection', () => {
  it('shows a waiting page and sends the admin to review it', async () => {
    const user = userEvent.setup()
    const review = vi.fn()
    render(<InboxSection onReviewPages={review} onOpenModeration={vi.fn()} />)
    const card = await screen.findByRole('article', {
      name: KIND_LABELS['page-submitted'],
    })
    expect(card.querySelector('a')?.getAttribute('href')).toBe('/quiet-fern')
    expect(mocks.fetchInbox).toHaveBeenCalledWith('tok', 'open', 1)
    await user.click(
      screen.getByRole('button', { name: 'Review waiting pages' }),
    )
    expect(review).toHaveBeenCalled()
  })

  it('marks a notice handled and reloads', async () => {
    const user = userEvent.setup()
    render(<InboxSection onReviewPages={vi.fn()} onOpenModeration={vi.fn()} />)
    await user.click(
      await screen.findByRole('button', { name: 'Mark handled' }),
    )
    expect(mocks.markInboxHandled).toHaveBeenCalledWith('tok', 'e1')
    await waitFor(() => expect(mocks.fetchInbox).toHaveBeenCalledTimes(2))
  })

  it('shows an EaM request with its note, and lets the member ask again', async () => {
    const user = userEvent.setup()
    mocks.fetchInbox.mockResolvedValue({
      entries: [
        entry({
          kind: 'eam-request',
          note: 'Synthetic note',
          page: undefined,
          blocksNewRequest: true,
        }),
      ],
      hasMore: false,
    })
    render(<InboxSection onReviewPages={vi.fn()} onOpenModeration={vi.fn()} />)
    expect(await screen.findByText('Synthetic note')).toBeTruthy()
    expect(screen.getByText('A member without a live page')).toBeTruthy()
    expect(
      screen.queryByRole('button', { name: 'Review waiting pages' }),
    ).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Let them ask again' }))
    expect(mocks.resetEamRequest).toHaveBeenCalledWith('tok', 'e1')
  })

  it('offers nothing on a notice about the admin themselves', async () => {
    mocks.auth.user = { sub: 'user_m' }
    mocks.fetchInbox.mockResolvedValue({
      entries: [entry({ kind: 'eam-request', blocksNewRequest: true })],
      hasMore: false,
    })
    render(<InboxSection onReviewPages={vi.fn()} onOpenModeration={vi.fn()} />)
    expect(await screen.findByText(OWN_NOTICE)).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Mark handled' })).toBeNull()
    expect(
      screen.queryByRole('button', { name: 'Let them ask again' }),
    ).toBeNull()
  })

  it('lists handled notices, with when, and pages through them', async () => {
    const user = userEvent.setup()
    render(<InboxSection onReviewPages={vi.fn()} onOpenModeration={vi.fn()} />)
    await screen.findByRole('article')
    mocks.fetchInbox.mockResolvedValue({
      entries: [
        entry({
          status: 'handled',
          handledAt: '2026-11-13T11:00:00Z',
          page: {
            slug: 'quiet-fern',
            displayName: 'Quiet Fern',
            reviewStatus: 'approved',
          },
        }),
        entry({
          entryId: 'e2',
          kind: 'eam-request',
          status: 'handled',
          blocksNewRequest: false,
        }),
      ],
      hasMore: true,
    })
    await user.click(screen.getByRole('tab', { name: 'Handled' }))
    expect(
      await screen.findByText(/handled Nov 13, 2026, 11:00 AM/),
    ).toBeTruthy()
    expect(mocks.fetchInbox).toHaveBeenLastCalledWith('tok', 'handled', 1)
    expect(screen.queryByRole('button', { name: 'Mark handled' })).toBeNull()
    expect(
      screen.queryByRole('button', { name: 'Let them ask again' }),
    ).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Older' }))
    await waitFor(() =>
      expect(mocks.fetchInbox).toHaveBeenLastCalledWith('tok', 'handled', 2),
    )
    mocks.fetchInbox.mockResolvedValue({ entries: [], hasMore: false })
    await user.click(screen.getByRole('button', { name: 'Newer' }))
    expect(await screen.findByText('Nothing here.')).toBeTruthy()
    await user.click(screen.getByRole('tab', { name: 'Open' }))
    await waitFor(() =>
      expect(mocks.fetchInbox).toHaveBeenLastCalledWith('tok', 'open', 1),
    )
  })

  it('says what went wrong, and refreshes when someone else got there first', async () => {
    const user = userEvent.setup()
    mocks.markInboxHandled.mockRejectedValueOnce(
      new ApiError('That notice has already been handled.', 409),
    )
    render(<InboxSection onReviewPages={vi.fn()} onOpenModeration={vi.fn()} />)
    await user.click(
      await screen.findByRole('button', { name: 'Mark handled' }),
    )
    expect((await screen.findByRole('alert')).textContent).toContain(
      'already been handled',
    )
    await waitFor(() => expect(mocks.fetchInbox).toHaveBeenCalledTimes(2))
    mocks.markInboxHandled.mockRejectedValueOnce('raw')
    await user.click(screen.getByRole('button', { name: 'Mark handled' }))
    expect((await screen.findByRole('alert')).textContent).toBe(
      'That did not work.',
    )
    expect(mocks.fetchInbox).toHaveBeenCalledTimes(2)
  })

  it('shows "admins only" when the server refuses', async () => {
    mocks.fetchInbox.mockRejectedValue(new ApiError('Forbidden', 403))
    render(<InboxSection onReviewPages={vi.fn()} onOpenModeration={vi.fn()} />)
    expect((await screen.findByRole('alert')).textContent).toBe(
      'This page is for ORG admins.',
    )
  })
})

describe('InboxSection: report notices (Chunk 13)', () => {
  it('names what was reported and opens the moderation queue', async () => {
    const user = userEvent.setup()
    const open = vi.fn()
    mocks.fetchInbox.mockResolvedValue({
      entries: [
        entry({
          entryId: 'r1',
          kind: 'report',
          target: { type: 'comment', id: 'cmt_1' },
          page: {
            slug: 'quiet-fern',
            displayName: 'Quiet Fern',
            reviewStatus: 'approved',
          },
        }),
        entry({
          entryId: 'r2',
          kind: 'report',
          target: { type: 'member-page', id: 'p1' },
          page: undefined,
          status: 'handled',
        }),
      ],
      hasMore: false,
    })
    render(<InboxSection onReviewPages={vi.fn()} onOpenModeration={open} />)
    const cards = await screen.findAllByRole('article', {
      name: KIND_LABELS.report,
    })
    expect(cards[0].textContent).toContain('A comment on Quiet Fern')
    // Not a link to the page: the queue holds the detail.
    expect(cards[0].querySelector('a')).toBeNull()
    expect(cards[1].textContent).toContain('A member page')
    expect(
      screen.getAllByRole('button', { name: 'Open the moderation queue' }),
    ).toHaveLength(1)
    await user.click(
      screen.getByRole('button', { name: 'Open the moderation queue' }),
    )
    expect(open).toHaveBeenCalled()
    expect(
      reportSubject(entry({ kind: 'report', page: undefined }) as never),
    ).toBe('A comment')
  })
})
