// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '#/lib/api'
import type * as AdminApi from '#/lib/admin-api'
import { AdminDashboard, SECTIONS } from './AdminDashboard'
import { ADMINS_ONLY } from './admin-shared'

const mocks = vi.hoisted(() => ({
  auth: {
    isLoading: false,
    isAuthenticated: true,
    user: { sub: 'user_admin' },
    getToken: vi.fn<() => Promise<string | undefined>>(),
  },
  fetchAdminSettings: vi.fn(),
}))

vi.mock('#/lib/auth', () => ({ useOrgAuth: () => mocks.auth }))
vi.mock('#/lib/admin-api', async (original) => ({
  ...(await original<typeof AdminApi>()),
  fetchAdminSettings: mocks.fetchAdminSettings,
}))
// Each section has its own tests; here they only say which one is shown.
vi.mock('./InboxSection', () => ({
  InboxSection: ({
    onReviewPages,
    onOpenModeration,
  }: {
    onReviewPages: () => void
    onOpenModeration: () => void
  }) => (
    <>
      <button type="button" onClick={onReviewPages}>
        inbox stub
      </button>
      <button type="button" onClick={onOpenModeration}>
        inbox report stub
      </button>
    </>
  ),
}))
vi.mock('./MembersSection', () => ({
  MembersSection: ({
    initialFilter,
    initialQuery,
  }: {
    initialFilter?: string
    initialQuery?: string
  }) => (
    <p>
      members stub {initialFilter ?? 'default'} {initialQuery ?? 'none'}
    </p>
  ),
}))
vi.mock('./ModerationSection', () => ({
  ModerationSection: ({
    onOpenMember,
  }: {
    onOpenMember: (slug: string) => void
  }) => (
    <button type="button" onClick={() => onOpenMember('some-page')}>
      moderation stub
    </button>
  ),
}))
vi.mock('./RolesSection', () => ({ RolesSection: () => <p>roles stub</p> }))
vi.mock('./LogSection', () => ({ LogSection: () => <p>log stub</p> }))
vi.mock('./FragmentsSection', () => ({
  FragmentsSection: () => <p>fragments stub</p>,
}))
vi.mock('./AnchorsSection', () => ({
  AnchorsSection: () => <p>anchors stub</p>,
}))
vi.mock('./SettingsSection', () => ({
  SettingsSection: () => <p>settings stub</p>,
}))
vi.mock('#/components/admin/claims/AdminClaims', () => ({
  AdminClaims: ({ embedded }: { embedded?: boolean }) => (
    <p>claims stub {embedded ? 'embedded' : 'alone'}</p>
  ),
}))

beforeEach(() => {
  mocks.auth.getToken.mockReset().mockResolvedValue('tok')
  mocks.fetchAdminSettings
    .mockReset()
    .mockResolvedValue({ anonymousMayVote: false })
})
afterEach(cleanup)

describe('AdminDashboard', () => {
  it('opens on the inbox and moves between every section', async () => {
    const user = userEvent.setup()
    render(<AdminDashboard />)
    expect(
      screen.getByRole('heading', { level: 1, name: 'Admin dashboard' }),
    ).toBeTruthy()
    await screen.findByText('inbox stub')
    expect(screen.getAllByRole('tab')).toHaveLength(SECTIONS.length)
    expect(
      screen.getByRole('tab', { name: 'Inbox' }).getAttribute('aria-selected'),
    ).toBe('true')

    const expectations: Array<[string, string]> = [
      ['Members', 'members stub default none'],
      ['Claims', 'claims stub embedded'],
      ['Roles', 'roles stub'],
      ['Log', 'log stub'],
      ['Search fragments', 'fragments stub'],
      ['Anchors', 'anchors stub'],
      ['Settings', 'settings stub'],
      ['Moderation queue', 'moderation stub'],
    ]
    for (const [tab, text] of expectations) {
      await user.click(screen.getByRole('tab', { name: tab }))
      expect(screen.getByText(text)).toBeTruthy()
    }
  })

  it('takes an inbox notice to the waiting pages', async () => {
    const user = userEvent.setup()
    render(<AdminDashboard />)
    await user.click(await screen.findByText('inbox stub'))
    expect(screen.getByText('members stub default none')).toBeTruthy()
  })

  it('takes a report notice to the queue, and a reported page to Members (Chunk 13)', async () => {
    const user = userEvent.setup()
    render(<AdminDashboard />)
    await user.click(await screen.findByText('inbox report stub'))
    await user.click(screen.getByText('moderation stub'))
    expect(screen.getByText('members stub all some-page')).toBeTruthy()
    // Choosing a section again starts it fresh.
    await user.click(screen.getByRole('tab', { name: 'Members' }))
    expect(screen.getByText('members stub default none')).toBeTruthy()
  })

  it('can open on another section', async () => {
    render(<AdminDashboard initialSection="settings" />)
    expect(await screen.findByText('settings stub')).toBeTruthy()
  })

  it('shows a member who is not an admin one line and no section', async () => {
    mocks.fetchAdminSettings.mockRejectedValue(new ApiError('Forbidden', 403))
    render(<AdminDashboard />)
    expect((await screen.findByRole('alert')).textContent).toBe(ADMINS_ONLY)
    expect(screen.queryByRole('tab')).toBeNull()
    expect(screen.queryByText('inbox stub')).toBeNull()
  })

  it('says when the server does not answer, and tries again', async () => {
    const user = userEvent.setup()
    mocks.fetchAdminSettings.mockRejectedValueOnce(
      new ApiError('The ORG server is having trouble right now.', 503),
    )
    render(<AdminDashboard />)
    expect((await screen.findByRole('alert')).textContent).toContain(
      'having trouble',
    )
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByText('inbox stub')).toBeTruthy()
  })

  it('says so when the sign-in session is gone, or a failure has no message', async () => {
    mocks.auth.getToken.mockResolvedValue(undefined)
    render(<AdminDashboard />)
    expect((await screen.findByRole('alert')).textContent).toBe(
      'Your sign-in session has expired.',
    )
    cleanup()
    mocks.auth.getToken.mockResolvedValue('tok')
    mocks.fetchAdminSettings.mockRejectedValue('raw')
    render(<AdminDashboard />)
    expect((await screen.findByRole('alert')).textContent).toBe(
      'That did not load.',
    )
  })

  it('ignores an answer that arrives after it was closed', async () => {
    let finish: (value: unknown) => void = () => undefined
    mocks.fetchAdminSettings.mockReturnValue(
      new Promise((resolve) => (finish = resolve)),
    )
    const { unmount } = render(<AdminDashboard />)
    unmount()
    finish({ anonymousMayVote: false })
    await Promise.resolve()
    let fail: (reason: unknown) => void = () => undefined
    mocks.fetchAdminSettings.mockReturnValue(
      new Promise((_, reject) => (fail = reject)),
    )
    const second = render(<AdminDashboard />)
    second.unmount()
    fail(new ApiError('Forbidden', 403))
    await Promise.resolve()
    expect(screen.queryByRole('alert')).toBeNull()
  })
})
