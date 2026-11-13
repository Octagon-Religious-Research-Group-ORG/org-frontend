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
import {
  ADMIN_INVITE_NOTE,
  ALLOWLIST_NOTE,
  ALLOWLIST_UNKNOWN_NOTE,
  ALSO_ALLOWLISTED_NOTE,
  INCOMPLETE_NOTE,
  INVITATIONS_INCOMPLETE,
  LAST_ADMIN_NOTE,
  RolesSection,
} from './RolesSection'

const mocks = vi.hoisted(() => ({
  auth: {
    isLoading: false,
    isAuthenticated: true,
    user: { sub: 'user_admin' },
    getToken: vi.fn<() => Promise<string | undefined>>(),
  },
  fetchAdmins: vi.fn(),
  fetchInvitations: vi.fn(),
  removeAdminRole: vi.fn(),
  inviteByEmail: vi.fn(),
  revokeInvitation: vi.fn(),
}))

vi.mock('#/lib/auth', () => ({ useOrgAuth: () => mocks.auth }))
vi.mock('#/lib/admin-api', async (original) => ({
  ...(await original<typeof AdminApi>()),
  fetchAdmins: mocks.fetchAdmins,
  fetchInvitations: mocks.fetchInvitations,
  removeAdminRole: mocks.removeAdminRole,
  inviteByEmail: mocks.inviteByEmail,
  revokeInvitation: mocks.revokeInvitation,
}))
vi.mock('@tanstack/react-router', async () => ({
  Link: (await import('./test-helpers')).FakeLink,
}))

const TWO_ADMINS = {
  admins: [
    {
      userId: 'user_admin',
      email: 'me@example.test',
      page: { slug: 'me', displayName: 'Synthetic Me' },
      isYou: true,
    },
    { userId: 'user_other', name: 'Other Admin', isYou: false },
  ],
  complete: true,
}

beforeEach(() => {
  mocks.auth.getToken.mockReset().mockResolvedValue('tok')
  mocks.fetchAdmins.mockReset().mockResolvedValue(TWO_ADMINS)
  mocks.fetchInvitations.mockReset().mockResolvedValue({
    invitations: [
      {
        invitationId: 'inv_1',
        email: 'new@example.test',
        role: 'admin',
        createdAt: '2026-11-13T10:00:00Z',
      },
      {
        invitationId: 'inv_2',
        email: 'member@example.test',
        createdAt: '2026-11-13T10:00:00Z',
      },
    ],
  })
  mocks.removeAdminRole.mockReset().mockResolvedValue({ role: null })
  mocks.inviteByEmail.mockReset().mockResolvedValue({ invitationId: 'inv_3' })
  mocks.revokeInvitation.mockReset().mockResolvedValue({ revoked: true })
})
afterEach(cleanup)

describe('RolesSection', () => {
  it('lists the admins; you cannot remove yourself', async () => {
    render(<RolesSection />)
    const me = await screen.findByRole('article', { name: 'Synthetic Me' })
    expect(within(me).getByText('(you)')).toBeTruthy()
    expect(within(me).getByText('me@example.test')).toBeTruthy()
    expect(within(me).queryByRole('button')).toBeNull()
    const other = screen.getByRole('article', { name: 'Other Admin' })
    expect(
      within(other).getByRole('button', { name: 'Remove admin role…' }),
    ).toBeTruthy()
  })

  it('removes another admin’s role with a reason, or cancels', async () => {
    const user = userEvent.setup()
    render(<RolesSection />)
    const other = await screen.findByRole('article', { name: 'Other Admin' })
    await user.click(
      within(other).getByRole('button', { name: 'Remove admin role…' }),
    )
    await user.click(within(other).getByRole('button', { name: 'Cancel' }))
    await user.click(
      within(other).getByRole('button', { name: 'Remove admin role…' }),
    )
    await user.type(within(other).getByRole('textbox'), 'Stepping back')
    await user.click(
      within(other).getByRole('button', { name: 'Remove the admin role' }),
    )
    expect(mocks.removeAdminRole).toHaveBeenCalledWith(
      'tok',
      'user_other',
      'Stepping back',
    )
    await waitFor(() => expect(mocks.fetchAdmins).toHaveBeenCalledTimes(2))
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('shows the server warning when a follow-up of the removal failed (round 2, LOW 2)', async () => {
    const user = userEvent.setup()
    mocks.removeAdminRole.mockResolvedValueOnce({
      role: null,
      followUpWarning:
        'Their pending admin invitations could not all be withdrawn.',
    })
    render(<RolesSection />)
    const other = await screen.findByRole('article', { name: 'Other Admin' })
    await user.click(
      within(other).getByRole('button', { name: 'Remove admin role…' }),
    )
    await user.type(within(other).getByRole('textbox'), 'r')
    await user.click(
      within(other).getByRole('button', { name: 'Remove the admin role' }),
    )
    expect((await screen.findByRole('alert')).textContent).toBe(
      'Their pending admin invitations could not all be withdrawn.',
    )
  })

  it('offers no removal for a Clerk admin also on the allowlist, and says when the allowlist is unknown (round 2, LOW 3)', async () => {
    mocks.fetchAdmins.mockResolvedValue({
      admins: [
        { userId: 'user_admin', isYou: true },
        {
          userId: 'user_both',
          name: 'Both Ways',
          isYou: false,
          allowlisted: true,
        },
        { userId: 'user_other', name: 'Other Admin', isYou: false },
      ],
      complete: true,
      allowlistUnknown: true,
    })
    render(<RolesSection />)
    const both = await screen.findByRole('article', { name: 'Both Ways' })
    expect(within(both).getByText(ALSO_ALLOWLISTED_NOTE)).toBeTruthy()
    expect(within(both).queryByRole('button')).toBeNull()
    expect(screen.getByText(ALLOWLIST_UNKNOWN_NOTE)).toBeTruthy()
    expect(
      within(screen.getByRole('article', { name: 'Other Admin' })).getByRole(
        'button',
      ),
    ).toBeTruthy()
  })

  it('never offers to remove the only admin, or when the count is unsure', async () => {
    mocks.fetchAdmins.mockResolvedValue({
      admins: [{ userId: 'user_other', email: 'o@example.test', isYou: false }],
      complete: true,
    })
    render(<RolesSection />)
    expect(await screen.findByText(LAST_ADMIN_NOTE)).toBeTruthy()
    expect(
      within(
        screen.getByRole('article', { name: 'o@example.test' }),
      ).queryByRole('button'),
    ).toBeNull()
    cleanup()
    mocks.fetchAdmins.mockResolvedValue({ ...TWO_ADMINS, complete: false })
    render(<RolesSection />)
    expect(await screen.findByText(INCOMPLETE_NOTE)).toBeTruthy()
    expect(
      screen.queryByRole('button', { name: 'Remove admin role…' }),
    ).toBeNull()
  })

  it('names an admin by whatever is known, down to the account id', async () => {
    mocks.fetchAdmins.mockResolvedValue({
      admins: [
        { userId: 'user_bare', isYou: false },
        { userId: 'user_admin', isYou: true },
      ],
      complete: true,
    })
    render(<RolesSection />)
    expect(
      await screen.findByRole('article', { name: 'user_bare' }),
    ).toBeTruthy()
  })

  it('marks an allowlist admin, offers no removal, and does not count them as a second admin (MEDIUM-2)', async () => {
    mocks.fetchAdmins.mockResolvedValue({
      admins: [
        { userId: 'user_admin', isYou: true },
        {
          userId: 'user_list',
          email: 'list@example.test',
          isYou: false,
          viaAllowlist: true,
        },
        { userId: 'user_other', name: 'Other Admin', isYou: false },
      ],
      complete: true,
    })
    render(<RolesSection />)
    const listed = await screen.findByRole('article', {
      name: 'list@example.test',
    })
    expect(within(listed).getByText(ALLOWLIST_NOTE)).toBeTruthy()
    expect(within(listed).queryByRole('button')).toBeNull()
    expect(
      within(screen.getByRole('article', { name: 'Other Admin' })).getByRole(
        'button',
      ),
    ).toBeTruthy()
    cleanup()
    mocks.fetchAdmins.mockResolvedValue({
      admins: [
        { userId: 'user_admin', isYou: true },
        {
          userId: 'user_list',
          email: 'list@example.test',
          isYou: false,
          viaAllowlist: true,
        },
      ],
      complete: true,
    })
    render(<RolesSection />)
    expect(await screen.findByText(LAST_ADMIN_NOTE)).toBeTruthy()
  })

  it('warns when there are more waiting invitations than listed (LOW-1)', async () => {
    mocks.fetchInvitations.mockResolvedValue({
      invitations: [],
      complete: false,
    })
    render(<RolesSection />)
    expect(await screen.findByText(INVITATIONS_INCOMPLETE)).toBeTruthy()
  })

  it('invites a member or an admin by email', async () => {
    const user = userEvent.setup()
    render(<RolesSection />)
    await screen.findByRole('article', { name: 'new@example.test' })
    await user.type(
      screen.getByLabelText('Email address'),
      'friend@example.test',
    )
    await user.click(screen.getByRole('button', { name: 'Send invitation' }))
    expect(mocks.inviteByEmail).toHaveBeenCalledWith(
      'tok',
      'friend@example.test',
      'member',
      '',
    )
    expect((await screen.findByRole('status')).textContent).toBe(
      'Invitation sent to friend@example.test.',
    )
    await user.type(
      screen.getByLabelText('Email address'),
      'helper@example.test',
    )
    expect(screen.queryByText(ADMIN_INVITE_NOTE)).toBeNull()
    await user.click(screen.getByLabelText('An admin'))
    expect(screen.getByText(ADMIN_INVITE_NOTE)).toBeTruthy()
    await user.type(
      screen.getByLabelText('Note for the log (optional)'),
      'Co-admin',
    )
    await user.click(screen.getByRole('button', { name: 'Send invitation' }))
    expect(mocks.inviteByEmail).toHaveBeenLastCalledWith(
      'tok',
      'helper@example.test',
      'admin',
      'Co-admin',
    )
    await user.click(screen.getByLabelText('A member'))
  })

  it('says why an invitation was refused', async () => {
    const user = userEvent.setup()
    mocks.inviteByEmail.mockRejectedValue(
      new Error('That address already has an account or a waiting invitation.'),
    )
    render(<RolesSection />)
    await user.type(
      await screen.findByLabelText('Email address'),
      'x@example.test',
    )
    await user.click(screen.getByRole('button', { name: 'Send invitation' }))
    expect((await screen.findByRole('alert')).textContent).toContain(
      'already has an account',
    )
  })

  it('shows waiting invitations and withdraws one', async () => {
    const user = userEvent.setup()
    render(<RolesSection />)
    const asAdmin = await screen.findByRole('article', {
      name: 'new@example.test',
    })
    expect(within(asAdmin).getByText(/As an admin/)).toBeTruthy()
    const asMember = screen.getByRole('article', {
      name: 'member@example.test',
    })
    expect(within(asMember).getByText(/As a member/)).toBeTruthy()
    await user.click(within(asAdmin).getByRole('button', { name: 'Withdraw' }))
    expect(mocks.revokeInvitation).toHaveBeenCalledWith('tok', 'inv_1')
  })

  it('shows refusals on the cards, and an empty invitation list', async () => {
    const user = userEvent.setup()
    mocks.fetchInvitations.mockResolvedValue({
      invitations: [],
      complete: true,
    })
    mocks.removeAdminRole.mockRejectedValue(
      new Error('This is the only admin.'),
    )
    render(<RolesSection />)
    expect(await screen.findByText('None.')).toBeTruthy()
    const other = await screen.findByRole('article', { name: 'Other Admin' })
    await user.click(
      within(other).getByRole('button', { name: 'Remove admin role…' }),
    )
    await user.type(within(other).getByRole('textbox'), 'r')
    await user.click(
      within(other).getByRole('button', { name: 'Remove the admin role' }),
    )
    expect((await within(other).findByRole('alert')).textContent).toBe(
      'This is the only admin.',
    )
    cleanup()
    mocks.revokeInvitation.mockRejectedValue(new Error('No longer waiting.'))
    mocks.fetchInvitations.mockResolvedValue({
      invitations: [
        {
          invitationId: 'inv_9',
          email: 'z@example.test',
          createdAt: '2026-11-13T10:00:00Z',
        },
      ],
    })
    render(<RolesSection />)
    const invitation = await screen.findByRole('article', {
      name: 'z@example.test',
    })
    await user.click(
      within(invitation).getByRole('button', { name: 'Withdraw' }),
    )
    expect((await within(invitation).findByRole('alert')).textContent).toBe(
      'No longer waiting.',
    )
  })
})
