// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '#/lib/api'
import type * as AdminApi from '#/lib/admin-api'
import { INVITE_SHOWN_WHERE, SettingsSection } from './SettingsSection'

const mocks = vi.hoisted(() => ({
  auth: {
    isLoading: false,
    isAuthenticated: true,
    user: { sub: 'user_admin' },
    getToken: vi.fn<() => Promise<string | undefined>>(),
  },
  fetchAdminSettings: vi.fn(),
  setAnonymousVoting: vi.fn(),
  setVotingInvite: vi.fn(),
}))

vi.mock('#/lib/auth', () => ({ useOrgAuth: () => mocks.auth }))
// Its own tests: EmailStatusCard.test.tsx (Chunk 14).
vi.mock('./EmailStatusCard', () => ({
  EmailStatusCard: () => <p>email status stub</p>,
}))
vi.mock('#/lib/admin-api', async (original) => ({
  ...(await original<typeof AdminApi>()),
  fetchAdminSettings: mocks.fetchAdminSettings,
  setAnonymousVoting: mocks.setAnonymousVoting,
  setVotingInvite: mocks.setVotingInvite,
}))

beforeEach(() => {
  mocks.auth.getToken.mockReset().mockResolvedValue('tok')
  mocks.fetchAdminSettings.mockReset().mockResolvedValue({
    anonymousMayVote: false,
  })
  mocks.setAnonymousVoting.mockReset().mockResolvedValue({})
  mocks.setVotingInvite.mockReset().mockResolvedValue({ set: true })
})
afterEach(cleanup)

describe('SettingsSection', () => {
  it('turns anonymous voting on, then off', async () => {
    const user = userEvent.setup()
    render(<SettingsSection />)
    expect(await screen.findByText('Now: they cannot vote')).toBeTruthy()
    mocks.fetchAdminSettings.mockResolvedValue({ anonymousMayVote: true })
    await user.click(
      screen.getByRole('button', { name: 'Let anonymous members vote' }),
    )
    expect(mocks.setAnonymousVoting).toHaveBeenCalledWith('tok', true)
    expect(await screen.findByText('Now: they can vote')).toBeTruthy()
    await user.click(
      screen.getByRole('button', { name: 'Stop anonymous members voting' }),
    )
    expect(mocks.setAnonymousVoting).toHaveBeenLastCalledWith('tok', false)
  })

  it('saves a Telegram invite, refuses anything else, and clears it', async () => {
    const user = userEvent.setup()
    mocks.fetchAdminSettings.mockResolvedValue({
      anonymousMayVote: false,
      votingInvite: 'https://t.me/+old',
    })
    render(<SettingsSection />)
    expect(await screen.findByText(INVITE_SHOWN_WHERE)).toBeTruthy()
    const field = screen.getByLabelText('Invite link (empty to clear it)')
    expect((field as HTMLInputElement).value).toBe('https://t.me/+old')
    await user.clear(field)
    await user.type(field, 'https://example.org/x')
    expect(field.getAttribute('aria-invalid')).toBe('true')
    const save = screen.getByRole('button', { name: 'Save the invite' })
    expect((save as HTMLButtonElement).disabled).toBe(true)
    await user.clear(field)
    await user.type(field, 'https://t.me/+NewInvite')
    await user.click(save)
    expect(mocks.setVotingInvite).toHaveBeenCalledWith(
      'tok',
      'https://t.me/+NewInvite',
    )
    expect((await screen.findByRole('status')).textContent).toBe(
      'Invite saved.',
    )
    await user.clear(field)
    await user.click(save)
    expect(mocks.setVotingInvite).toHaveBeenLastCalledWith('tok', '')
    await waitFor(() =>
      expect(screen.getByRole('status').textContent).toBe('Invite cleared.'),
    )
  })

  it('shows what the server refused', async () => {
    const user = userEvent.setup()
    mocks.setAnonymousVoting.mockRejectedValue(new Error('Synthetic refusal'))
    mocks.setVotingInvite.mockRejectedValue(new Error('Synthetic bad invite'))
    render(<SettingsSection />)
    await user.click(
      await screen.findByRole('button', { name: 'Let anonymous members vote' }),
    )
    expect(await screen.findByText('Synthetic refusal')).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Save the invite' }))
    expect(await screen.findByText('Synthetic bad invite')).toBeTruthy()
  })

  it('never says "saved" when the save answers 500, but re-reads (round 7, MEDIUM 1)', async () => {
    const user = userEvent.setup()
    const message = 'The invite was saved, but the audit record is incomplete.'
    mocks.setVotingInvite.mockRejectedValueOnce(new ApiError(message, 500))
    render(<SettingsSection />)
    const field = await screen.findByLabelText(
      'Invite link (empty to clear it)',
    )
    await user.type(field, 'https://t.me/+GapInvite')
    await user.click(screen.getByRole('button', { name: 'Save the invite' }))
    expect((await screen.findByRole('alert')).textContent).toBe(message)
    await waitFor(() =>
      expect(mocks.fetchAdminSettings).toHaveBeenCalledTimes(2),
    )
    expect(screen.queryByRole('status')).toBeNull()
    expect(screen.queryByText('Invite saved.')).toBeNull()
  })

  it('re-reads after a 409 on the voting switch (round 7)', async () => {
    const user = userEvent.setup()
    mocks.setAnonymousVoting.mockRejectedValueOnce(
      new ApiError('Someone else changed this first.', 409),
    )
    render(<SettingsSection />)
    await user.click(
      await screen.findByRole('button', { name: 'Let anonymous members vote' }),
    )
    expect(
      await screen.findByText('Someone else changed this first.'),
    ).toBeTruthy()
    await waitFor(() =>
      expect(mocks.fetchAdminSettings).toHaveBeenCalledTimes(2),
    )
  })
})
