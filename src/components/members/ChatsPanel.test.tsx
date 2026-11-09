// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type * as MembersApi from '#/lib/members-api'
import { ChatsPanel } from './ChatsPanel'

const mocks = vi.hoisted(() => ({
  auth: { isLoading: false, isAuthenticated: false, getToken: vi.fn() },
  fetchMemberChats: vi.fn(),
}))

vi.mock('#/lib/auth', () => ({ useOrgAuth: () => mocks.auth }))
vi.mock('#/lib/members-api', async (original) => ({
  ...(await original<typeof MembersApi>()),
  fetchMemberChats: mocks.fetchMemberChats,
}))

beforeEach(() => {
  mocks.auth.isLoading = false
  mocks.auth.isAuthenticated = false
  mocks.auth.getToken.mockReset().mockResolvedValue('tok')
  mocks.fetchMemberChats.mockReset().mockResolvedValue({ voting: 'hidden' })
})

afterEach(cleanup)

describe('ChatsPanel', () => {
  it('shows the public chats and Contact Tripp to everyone', async () => {
    render(<ChatsPanel />)
    await waitFor(() => expect(mocks.fetchMemberChats).toHaveBeenCalled())
    const href = (name: string) =>
      screen.getByRole('link', { name }).getAttribute('href')
    expect(href('ORG on Telegram')).toBe('https://t.me/ORG_Spirituality')
    expect(href('Events and Ceremonies')).toBe(
      'https://t.me/ORG_Events_and_Ceremonies',
    )
    expect(href('Contact Tripp')).toBe('https://t.me/Tripp_ORG')
    expect(screen.getByText(/secret chat/)).toBeTruthy()
  })

  it('waits for the login check', () => {
    mocks.auth.isLoading = true
    render(<ChatsPanel />)
    expect(mocks.fetchMemberChats).not.toHaveBeenCalled()
  })

  it('shows no voting line when the server says hidden', async () => {
    render(<ChatsPanel />)
    await waitFor(() => expect(mocks.fetchMemberChats).toHaveBeenCalled())
    expect(screen.queryByText('ORG Voting')).toBeNull()
    expect(screen.queryByText(/Ask Tripp/)).toBeNull()
  })

  it('asks with the token, and shows the plain line when unset', async () => {
    mocks.auth.isAuthenticated = true
    mocks.fetchMemberChats.mockResolvedValue({ voting: 'ask-tripp' })
    render(<ChatsPanel />)
    await screen.findByText(/Ask Tripp/)
    expect(mocks.fetchMemberChats).toHaveBeenCalledWith('tok')
  })

  it('shows the invite the server sends', async () => {
    mocks.fetchMemberChats.mockResolvedValue({
      voting: 'invite',
      inviteUrl: 'https://t.me/+abc',
    })
    render(<ChatsPanel />)
    const link = await screen.findByRole('link', { name: 'ORG Voting' })
    expect(link.getAttribute('href')).toBe('https://t.me/+abc')
  })

  it('refuses an invite that is not a Telegram link', async () => {
    mocks.fetchMemberChats.mockResolvedValue({
      voting: 'invite',
      inviteUrl: 'javascript:alert(1)',
    })
    render(<ChatsPanel />)
    await waitFor(() => expect(mocks.fetchMemberChats).toHaveBeenCalled())
    await new Promise((done) => setTimeout(done))
    expect(screen.queryByText('ORG Voting')).toBeNull()
  })

  it('keeps the public links when the server fails', async () => {
    mocks.fetchMemberChats.mockRejectedValue(new Error('down'))
    render(<ChatsPanel />)
    await waitFor(() => expect(mocks.fetchMemberChats).toHaveBeenCalled())
    expect(screen.getByRole('link', { name: 'Contact Tripp' })).toBeTruthy()
  })

  it('ignores an answer after it went away', async () => {
    let resolve: (value: unknown) => void = () => {}
    mocks.fetchMemberChats.mockReturnValue(
      new Promise((done) => (resolve = done)),
    )
    const { unmount } = render(<ChatsPanel />)
    await waitFor(() => expect(mocks.fetchMemberChats).toHaveBeenCalled())
    unmount()
    resolve({ voting: 'ask-tripp' })
    await new Promise((done) => setTimeout(done))
    expect(screen.queryByText(/Ask Tripp/)).toBeNull()
  })
})
