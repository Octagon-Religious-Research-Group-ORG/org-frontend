// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
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
})
