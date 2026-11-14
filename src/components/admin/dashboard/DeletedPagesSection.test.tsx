// @vitest-environment jsdom

import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '#/lib/api'
import type * as MemberDataApi from '#/lib/member-data-api'
import { DeletedPagesSection, RESTORED } from './DeletedPagesSection'

const mocks = vi.hoisted(() => ({
  auth: {
    isLoading: false,
    isAuthenticated: true,
    getToken: vi.fn<() => Promise<string | undefined>>(),
  },
  fetchDeletedPages: vi.fn(),
  fetchPurgeDue: vi.fn(),
  restoreDeletedPage: vi.fn(),
}))

vi.mock('#/lib/auth', () => ({ useOrgAuth: () => mocks.auth }))
vi.mock('#/lib/member-data-api', async (original) => ({
  ...(await original<typeof MemberDataApi>()),
  fetchDeletedPages: mocks.fetchDeletedPages,
  fetchPurgeDue: mocks.fetchPurgeDue,
  restoreDeletedPage: mocks.restoreDeletedPage,
}))

const future = new Date(Date.now() + 86_400_000 * 365).toISOString()
const row = (extra: Record<string, unknown> = {}) => ({
  slug: 'quiet-fern',
  displayName: 'Quiet Fern',
  source: 'member',
  deletedAt: '2026-11-14T12:00:00Z',
  undoUntil: '2026-12-14T12:00:00Z',
  purgeAfter: future,
  ownerAccountGone: false,
  // An older or careless server could still send one (round 2, #7).
  ownerUserId: 'user_synthetic',
  ...extra,
})
const due = {
  pages: [],
  accounts: [],
  hasMore: false,
  visitAddresses: 3,
  retentionYears: 5,
}

beforeEach(() => {
  mocks.auth.getToken.mockReset().mockResolvedValue('tok')
  mocks.fetchDeletedPages
    .mockReset()
    .mockResolvedValue({ pages: [row()], hasMore: false })
  mocks.fetchPurgeDue.mockReset().mockResolvedValue(due)
  mocks.restoreDeletedPage.mockReset().mockResolvedValue({ restored: true })
})

afterEach(cleanup)

describe('DeletedPagesSection', () => {
  it('lists deleted pages with who deleted them and until when they are kept', async () => {
    mocks.fetchDeletedPages.mockResolvedValue({
      pages: [
        row(),
        row({
          slug: 'gone-account',
          displayName: 'Gone Account',
          source: 'account-deleted',
          undoUntil: undefined,
        }),
      ],
      hasMore: false,
    })
    render(<DeletedPagesSection />)
    const items = await screen.findAllByRole('listitem')
    expect(items[0].textContent).toContain('deleted by the member')
    expect(items[0].textContent).toContain('the member can undo until')
    // Review #9: the page's name and address, never a Clerk id.
    expect(items[0].textContent).toContain('Quiet Fern')
    expect(items[0].textContent).toContain('/quiet-fern')
    expect(document.body.textContent).not.toContain('user_synthetic')
    expect(items[1].textContent).toContain(
      'removed when the account was deleted',
    )
    expect(items[1].textContent).not.toContain('can undo')
    expect(await screen.findByText('Nothing is due.')).toBeTruthy()
    expect(
      screen.getByText(/visitors’ addresses older than 5 years \(3 now\)/),
    ).toBeTruthy()
  })

  it('says when the owner account is gone, in the row and before restoring (#6)', async () => {
    mocks.fetchDeletedPages.mockResolvedValue({
      pages: [
        row({
          source: 'account-deleted',
          undoUntil: undefined,
          ownerAccountGone: true,
        }),
      ],
      hasMore: false,
    })
    render(<DeletedPagesSection />)
    expect(await screen.findByText(/the owner’s account is gone/)).toBeTruthy()
    await userEvent.click(screen.getByRole('button', { name: 'Restore…' }))
    expect(screen.getByText(/no one able to sign in to it/)).toBeTruthy()
  })

  it('restores with a reason, then says so and reloads', async () => {
    render(<DeletedPagesSection />)
    await userEvent.click(
      await screen.findByRole('button', { name: 'Restore…' }),
    )
    const submit = screen.getByRole('button', { name: 'Restore the page' })
    expect((submit as HTMLButtonElement).disabled).toBe(true)
    await userEvent.type(
      screen.getByLabelText(/Why are you restoring it/),
      'Asked by the member.',
    )
    mocks.fetchDeletedPages.mockResolvedValue({ pages: [], hasMore: false })
    await userEvent.click(submit)
    expect(mocks.restoreDeletedPage).toHaveBeenCalledWith(
      'tok',
      'quiet-fern',
      'Asked by the member.',
    )
    expect(await screen.findByText(RESTORED('Quiet Fern'))).toBeTruthy()
    expect(await screen.findByText('No deleted pages.')).toBeTruthy()
  })

  it('keeps the form and shows the refusal, re-reading on a conflict', async () => {
    mocks.restoreDeletedPage.mockRejectedValue(new ApiError('Too late.', 409))
    render(<DeletedPagesSection />)
    await userEvent.click(
      await screen.findByRole('button', { name: 'Restore…' }),
    )
    await userEvent.type(screen.getByLabelText(/Why are you restoring it/), 'x')
    await userEvent.click(
      screen.getByRole('button', { name: 'Restore the page' }),
    )
    expect((await screen.findByRole('alert')).textContent).toBe('Too late.')
    expect(mocks.fetchDeletedPages).toHaveBeenCalledTimes(2)
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.getByRole('button', { name: 'Restore…' })).toBeTruthy()
  })

  it('offers no restore once purged or past the five years', async () => {
    mocks.fetchDeletedPages.mockResolvedValue({
      pages: [
        row({ purgedAt: '2031-11-15T03:00:00Z' }),
        row({ slug: 'due-page', purgeAfter: '2020-01-01T00:00:00Z' }),
      ],
      hasMore: false,
    })
    render(<DeletedPagesSection />)
    const items = await screen.findAllByRole('listitem')
    expect(items[0].textContent).toContain('purged')
    expect(within(items[0]).queryByRole('button')).toBeNull()
    expect(within(items[1]).queryByRole('button')).toBeNull()
  })

  it('shows the dry run, and that there is more', async () => {
    mocks.fetchPurgeDue.mockResolvedValue({
      ...due,
      pages: [
        {
          slug: 'old-page',
          displayName: 'Old Page',
          source: 'member',
          deletedAt: '2021-01-01T00:00:00Z',
          purgeAfter: '2026-01-01T00:00:00Z',
        },
      ],
      hasMore: true,
    })
    render(<DeletedPagesSection />)
    expect(
      await screen.findByText(/Old Page \(\/old-page\), due since/),
    ).toBeTruthy()
    expect(screen.getByText('And more.')).toBeTruthy()
  })

  it('counts the deleted accounts due, naming no one (review #6)', async () => {
    mocks.fetchPurgeDue.mockResolvedValue({
      ...due,
      accounts: [
        {
          deletedAt: '2021-01-01T00:00:00Z',
          purgeAfter: '2026-01-01T00:00:00Z',
          hadPage: false,
        },
      ],
    })
    render(<DeletedPagesSection />)
    expect(
      await screen.findByText(/1 deleted account\(s\) are due/),
    ).toBeTruthy()
  })

  it('pages the list', async () => {
    mocks.fetchDeletedPages.mockResolvedValue({ pages: [row()], hasMore: true })
    render(<DeletedPagesSection />)
    await userEvent.click(await screen.findByRole('button', { name: 'Older' }))
    expect(mocks.fetchDeletedPages).toHaveBeenLastCalledWith('tok', 2)
  })
})
