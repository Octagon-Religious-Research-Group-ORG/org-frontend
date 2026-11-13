// @vitest-environment jsdom

import {
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type * as AdminApi from '#/lib/admin-api'
import { MembersSection, OWN_PAGE_NOTE } from './MembersSection'

const mocks = vi.hoisted(() => {
  const user: { sub?: string } = { sub: 'user_admin' }
  return {
    auth: {
      isLoading: false,
      isAuthenticated: true,
      user,
      getToken: vi.fn<() => Promise<string | undefined>>(),
    },
    fetchAdminMembers: vi.fn(),
    fetchAdmins: vi.fn(),
    decideOnPage: vi.fn(),
    promoteToAdmin: vi.fn(),
  }
})

vi.mock('#/lib/auth', () => ({ useOrgAuth: () => mocks.auth }))
vi.mock('#/lib/admin-api', async (original) => ({
  ...(await original<typeof AdminApi>()),
  fetchAdminMembers: mocks.fetchAdminMembers,
  fetchAdmins: mocks.fetchAdmins,
  decideOnPage: mocks.decideOnPage,
  promoteToAdmin: mocks.promoteToAdmin,
}))
vi.mock('@tanstack/react-router', async () => ({
  Link: (await import('./test-helpers')).FakeLink,
}))

const member = (overrides: Record<string, unknown> = {}) => ({
  slug: 'quiet-fern',
  displayName: 'Quiet Fern',
  reviewStatus: 'pending',
  visibility: 'public',
  anonymous: false,
  source: 'native',
  ownerUserId: 'user_m',
  createdAt: '2026-11-01T00:00:00Z',
  ...overrides,
})

function listOf(...members: Array<ReturnType<typeof member>>) {
  mocks.fetchAdminMembers.mockResolvedValue({ members, hasMore: false })
}

beforeEach(() => {
  mocks.auth.user = { sub: 'user_admin' }
  mocks.auth.getToken.mockReset().mockResolvedValue('tok')
  mocks.fetchAdminMembers.mockReset()
  listOf(member())
  mocks.fetchAdmins.mockReset().mockResolvedValue({
    admins: [{ userId: 'user_admin', isYou: true }],
    complete: true,
  })
  mocks.decideOnPage.mockReset().mockResolvedValue({})
  mocks.promoteToAdmin.mockReset().mockResolvedValue({ role: 'admin' })
})
afterEach(cleanup)

const card = (name: string) => screen.findByRole('article', { name })

describe('MembersSection', () => {
  it('opens on the waiting pages and approves one', async () => {
    const user = userEvent.setup()
    render(<MembersSection />)
    const page = await card('Quiet Fern')
    expect(mocks.fetchAdminMembers).toHaveBeenCalledWith(
      'tok',
      'pending',
      '',
      1,
    )
    expect(within(page).getByText(/Waiting for approval/)).toBeTruthy()
    expect(within(page).queryByRole('button', { name: 'Remove…' })).toBeNull()
    await user.click(within(page).getByRole('button', { name: 'Approve' }))
    expect(mocks.decideOnPage).toHaveBeenCalledWith(
      'tok',
      'quiet-fern',
      'approve',
    )
    await waitFor(() =>
      expect(mocks.fetchAdminMembers).toHaveBeenCalledTimes(2),
    )
  })

  it('rejects a waiting page only with a reason', async () => {
    const user = userEvent.setup()
    listOf(member({ similarNameOf: ['quiet-fem'] }))
    render(<MembersSection />)
    const page = await card('Quiet Fern')
    expect(within(page).getByText('Name reads like: /quiet-fem')).toBeTruthy()
    await user.click(within(page).getByRole('button', { name: 'Reject…' }))
    const submit = within(page).getByRole('button', { name: 'Reject the page' })
    expect((submit as HTMLButtonElement).disabled).toBe(true)
    await user.type(
      within(page).getByLabelText('Why (for the admins only)'),
      'Synthetic spam',
    )
    await user.click(submit)
    expect(mocks.decideOnPage).toHaveBeenCalledWith(
      'tok',
      'quiet-fern',
      'reject',
      'Synthetic spam',
    )
    await waitFor(() =>
      expect(
        within(page).queryByRole('button', { name: 'Reject the page' }),
      ).toBeNull(),
    )
  })

  it('removes a live page, and can cancel', async () => {
    const user = userEvent.setup()
    listOf(member({ reviewStatus: 'approved', source: 'migrated' }))
    render(<MembersSection />)
    const page = await card('Quiet Fern')
    expect(within(page).getByText(/imported, claimed/)).toBeTruthy()
    await user.click(within(page).getByRole('button', { name: 'Remove…' }))
    await user.click(within(page).getByRole('button', { name: 'Cancel' }))
    await user.click(within(page).getByRole('button', { name: 'Remove…' }))
    await user.type(within(page).getByRole('textbox'), 'Synthetic')
    await user.click(
      within(page).getByRole('button', { name: 'Remove the page' }),
    )
    expect(mocks.decideOnPage).toHaveBeenCalledWith(
      'tok',
      'quiet-fern',
      'remove',
      'Synthetic',
    )
  })

  it('shows why a page was removed, and restores it', async () => {
    const user = userEvent.setup()
    listOf(
      member({
        reviewStatus: 'removed',
        anonymous: true,
        ownerUserId: undefined,
        source: 'migrated',
        createdAt: undefined,
        removal: {
          at: '2026-11-12T00:00:00Z',
          by: 'user_other',
          reason: 'Synthetic reason',
          previousStatus: 'approved',
        },
      }),
    )
    render(<MembersSection />)
    const page = await card('Quiet Fern')
    expect(within(page).getByText(/Synthetic reason/)).toBeTruthy()
    expect(
      within(page).getByText(/nickname · public · imported, unclaimed/),
    ).toBeTruthy()
    expect(
      within(page).queryByRole('button', { name: 'Make admin…' }),
    ).toBeNull()
    await user.click(within(page).getByRole('button', { name: 'Restore…' }))
    await user.type(
      within(page).getByLabelText('Why it comes back (for the admins only)'),
      'Mistake',
    )
    await user.click(
      within(page).getByRole('button', { name: 'Restore the page' }),
    )
    expect(mocks.decideOnPage).toHaveBeenCalledWith(
      'tok',
      'quiet-fern',
      'restore',
      'Mistake',
    )
  })

  it('makes the owner of a live page an admin, and marks admins', async () => {
    const user = userEvent.setup()
    listOf(
      member({ reviewStatus: 'approved' }),
      member({
        slug: 'an-admin',
        displayName: 'An Admin',
        reviewStatus: 'approved',
        ownerUserId: 'user_other',
      }),
    )
    mocks.fetchAdmins.mockResolvedValue({
      admins: [{ userId: 'user_other', isYou: false }],
      complete: true,
    })
    render(<MembersSection />)
    const admin = await card('An Admin')
    expect(within(admin).getByText('Admin')).toBeTruthy()
    expect(
      within(admin).queryByRole('button', { name: 'Make admin…' }),
    ).toBeNull()
    const page = await card('Quiet Fern')
    await user.click(
      await within(page).findByRole('button', { name: 'Make admin…' }),
    )
    await user.type(
      within(page).getByLabelText('Why they become an admin'),
      'Synthetic',
    )
    await user.click(
      within(page).getByRole('button', { name: 'Make them an admin' }),
    )
    expect(mocks.promoteToAdmin).toHaveBeenCalledWith(
      'tok',
      'user_m',
      'Synthetic',
    )
    await waitFor(() => expect(mocks.fetchAdmins).toHaveBeenCalledTimes(2))
  })

  it('offers no promotion until the admins are known', async () => {
    listOf(member({ reviewStatus: 'approved' }))
    mocks.fetchAdmins.mockReturnValue(new Promise(() => undefined))
    render(<MembersSection />)
    const page = await card('Quiet Fern')
    expect(
      within(page).queryByRole('button', { name: 'Make admin…' }),
    ).toBeNull()
  })

  it('offers nothing on the admin’s own page', async () => {
    mocks.auth.user = { sub: 'user_m' }
    render(<MembersSection />)
    const page = await card('Quiet Fern')
    expect(within(page).getByText(OWN_PAGE_NOTE)).toBeTruthy()
    expect(within(page).queryByRole('button')).toBeNull()
  })

  it('treats an account with no id as not the owner', async () => {
    mocks.auth.user = {}
    listOf(member({ ownerUserId: undefined }))
    render(<MembersSection />)
    const page = await card('Quiet Fern')
    expect(within(page).getByRole('button', { name: 'Approve' })).toBeTruthy()
  })

  it('filters, searches and pages', async () => {
    const user = userEvent.setup()
    mocks.fetchAdminMembers.mockResolvedValue({ members: [], hasMore: true })
    render(<MembersSection initialFilter="all" />)
    expect(await screen.findByText('No pages here.')).toBeTruthy()
    await user.click(screen.getByRole('tab', { name: 'Removed' }))
    await waitFor(() =>
      expect(mocks.fetchAdminMembers).toHaveBeenLastCalledWith(
        'tok',
        'removed',
        '',
        1,
      ),
    )
    await user.type(screen.getByRole('searchbox'), 'fern')
    await user.click(screen.getByRole('button', { name: 'Search' }))
    await waitFor(() =>
      expect(mocks.fetchAdminMembers).toHaveBeenLastCalledWith(
        'tok',
        'removed',
        'fern',
        1,
      ),
    )
    await user.click(await screen.findByRole('button', { name: 'Older' }))
    await waitFor(() =>
      expect(mocks.fetchAdminMembers).toHaveBeenLastCalledWith(
        'tok',
        'removed',
        'fern',
        2,
      ),
    )
  })

  it('shows a refusal on the card', async () => {
    const user = userEvent.setup()
    mocks.decideOnPage.mockRejectedValue(
      new Error('Another admin must decide.'),
    )
    render(<MembersSection />)
    const page = await card('Quiet Fern')
    await user.click(within(page).getByRole('button', { name: 'Approve' }))
    expect((await within(page).findByRole('alert')).textContent).toBe(
      'Another admin must decide.',
    )
  })
})
