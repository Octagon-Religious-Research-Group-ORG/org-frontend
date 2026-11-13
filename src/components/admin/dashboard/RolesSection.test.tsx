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
import { ApiError } from '#/lib/api'
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

  it('shows an unknown outcome in the server’s words, and keeps what was typed (round 3)', async () => {
    const user = userEvent.setup()
    // The server's own words (OUTCOME_UNKNOWN and DEMOTION_UNKNOWN in
    // org-backend's admin-roles.service.ts).
    const unknown =
      'The sign-in service did not confirm this change, so it may or may not have happened. Role changes are paused for up to 5 minutes; then check the list and the moderation log.'
    const demotionUnknown =
      'The sign-in service did not confirm the removal, so the admin role may or may not have been removed. Role changes are paused for up to 5 minutes; then check the list, and if the role is gone, withdraw any invitations they sent.'
    mocks.inviteByEmail.mockRejectedValueOnce(new ApiError(unknown, 503))
    mocks.removeAdminRole.mockRejectedValueOnce(
      new ApiError(demotionUnknown, 503),
    )
    render(<RolesSection />)
    const field = await screen.findByLabelText('Email address')
    await user.type(field, 'late@example.test')
    await user.click(screen.getByRole('button', { name: 'Send invitation' }))
    expect((await screen.findByRole('alert')).textContent).toBe(unknown)
    expect((field as HTMLInputElement).value).toBe('late@example.test')
    expect(screen.queryByRole('status')).toBeNull()
    const other = screen.getByRole('article', { name: 'Other Admin' })
    await user.click(
      within(other).getByRole('button', { name: 'Remove admin role…' }),
    )
    await user.type(within(other).getByRole('textbox'), 'r')
    await user.click(
      within(other).getByRole('button', { name: 'Remove the admin role' }),
    )
    expect((await within(other).findByRole('alert')).textContent).toBe(
      demotionUnknown,
    )
    // A 503 does not reload the list as if the change were done.
    expect(mocks.fetchAdmins).toHaveBeenCalledTimes(1)
  })

  it('re-reads the invitations when one was sent but not fully recorded (round 6)', async () => {
    const user = userEvent.setup()
    const message =
      'The invitation was sent, but the audit record is incomplete.'
    mocks.inviteByEmail.mockRejectedValueOnce(new ApiError(message, 500))
    render(<RolesSection />)
    await user.type(
      await screen.findByLabelText('Email address'),
      'gap@example.test',
    )
    await user.click(screen.getByRole('button', { name: 'Send invitation' }))
    expect((await screen.findByRole('alert')).textContent).toBe(message)
    await waitFor(() => expect(mocks.fetchInvitations).toHaveBeenCalledTimes(2))
    // Not announced as a clean success.
    expect(screen.queryByRole('status')).toBeNull()
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

  it('shows an invitation whose sending time Clerk did not give (round 5)', async () => {
    mocks.fetchInvitations.mockResolvedValue({
      invitations: [{ invitationId: 'inv_u', email: 'undated@example.test' }],
      complete: true,
    })
    render(<RolesSection />)
    const card = await screen.findByRole('article', {
      name: 'undated@example.test',
    })
    expect(within(card).getByText('As a member')).toBeTruthy()
    expect(within(card).queryByText(/sent/)).toBeNull()
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
    mocks.fetchInvitations.mockClear()
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
    expect((await screen.findByRole('alert')).textContent).toBe(
      'z@example.test: No longer waiting.',
    )
    // A plain refusal (no 409/500) re-reads nothing.
    expect(mocks.fetchInvitations).toHaveBeenCalledTimes(1)
  })

  it('keeps a withdrawal’s audit-gap message after the re-read removes its card (round 7, LOW 2)', async () => {
    const user = userEvent.setup()
    const message =
      'The invitation was withdrawn, but the audit record is incomplete.'
    mocks.revokeInvitation.mockRejectedValueOnce(new ApiError(message, 500))
    render(<RolesSection />)
    const card = await screen.findByRole('article', {
      name: 'new@example.test',
    })
    // The re-read no longer lists the withdrawn invitation.
    mocks.fetchInvitations.mockResolvedValue({
      invitations: [
        {
          invitationId: 'inv_2',
          email: 'member@example.test',
          createdAt: '2026-11-13T10:00:00Z',
        },
      ],
      complete: true,
    })
    await user.click(within(card).getByRole('button', { name: 'Withdraw' }))
    await waitFor(() =>
      expect(
        screen.queryByRole('article', { name: 'new@example.test' }),
      ).toBeNull(),
    )
    expect(mocks.fetchInvitations).toHaveBeenCalledTimes(2)
    expect(screen.getByRole('alert').textContent).toBe(
      `new@example.test: ${message}`,
    )
  })

  it('clears a withdrawal error when the next withdrawal works', async () => {
    const user = userEvent.setup()
    mocks.revokeInvitation.mockRejectedValueOnce(new Error('Not now.'))
    render(<RolesSection />)
    const card = await screen.findByRole('article', {
      name: 'member@example.test',
    })
    await user.click(within(card).getByRole('button', { name: 'Withdraw' }))
    expect((await screen.findByRole('alert')).textContent).toBe(
      'member@example.test: Not now.',
    )
    await user.click(within(card).getByRole('button', { name: 'Withdraw' }))
    await waitFor(() => expect(mocks.fetchInvitations).toHaveBeenCalledTimes(2))
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('re-reads the admins after a 409 on a removal, without a success (round 7)', async () => {
    const user = userEvent.setup()
    mocks.removeAdminRole.mockRejectedValueOnce(
      new ApiError('Someone else changed this admin first.', 409),
    )
    render(<RolesSection />)
    const other = await screen.findByRole('article', { name: 'Other Admin' })
    await user.click(
      within(other).getByRole('button', { name: 'Remove admin role…' }),
    )
    await user.type(within(other).getByRole('textbox'), 'r')
    await user.click(
      within(other).getByRole('button', { name: 'Remove the admin role' }),
    )
    expect((await within(other).findByRole('alert')).textContent).toBe(
      'Someone else changed this admin first.',
    )
    await waitFor(() => expect(mocks.fetchAdmins).toHaveBeenCalledTimes(2))
    // The form is still open with its reason: nothing claimed success.
    expect(within(other).getByRole('textbox')).toHaveProperty('value', 'r')
  })
})
