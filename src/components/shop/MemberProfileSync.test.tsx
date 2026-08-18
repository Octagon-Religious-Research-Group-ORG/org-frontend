// @vitest-environment jsdom

import { cleanup, render, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemberProfileSync } from './MemberProfileSync'

const mocks = vi.hoisted(() => ({
  apiRequest: vi.fn(),
  auth: {
    getToken: vi.fn(),
    isAuthenticated: false,
    isLoading: false,
    user: undefined as { sub?: string } | undefined,
  },
}))

vi.mock('#/lib/api', () => ({
  apiRequest: mocks.apiRequest,
}))

vi.mock('#/lib/auth', () => ({
  useOrgAuth: () => mocks.auth,
}))

describe('MemberProfileSync', () => {
  beforeEach(() => {
    mocks.apiRequest.mockReset()
    mocks.auth.getToken.mockReset()
    mocks.auth.isAuthenticated = false
    mocks.auth.isLoading = false
    mocks.auth.user = undefined
  })

  afterEach(cleanup)

  it('does nothing before authentication completes', () => {
    render(<MemberProfileSync />)

    expect(mocks.auth.getToken).not.toHaveBeenCalled()
    expect(mocks.apiRequest).not.toHaveBeenCalled()
  })

  it.each([
    ['while Clerk is loading', true, { sub: 'user_member' }],
    ['without an authenticated subject', false, {}],
  ])('does nothing %s', (_name, isLoading, user) => {
    mocks.auth.isAuthenticated = true
    mocks.auth.isLoading = isLoading
    mocks.auth.user = user

    render(<MemberProfileSync />)

    expect(mocks.auth.getToken).not.toHaveBeenCalled()
    expect(mocks.apiRequest).not.toHaveBeenCalled()
  })

  it('loads the member profile once after authentication', async () => {
    mocks.auth.isAuthenticated = true
    mocks.auth.user = { sub: 'user_member' }
    mocks.auth.getToken.mockResolvedValue('access-token')
    mocks.apiRequest.mockResolvedValue({ auth0Sub: 'user_member' })

    const view = render(<MemberProfileSync />)

    await waitFor(() => {
      expect(mocks.apiRequest).toHaveBeenCalledWith('/me', {
        token: 'access-token',
      })
    })

    mocks.auth.isLoading = true
    view.rerender(<MemberProfileSync />)
    mocks.auth.isLoading = false
    view.rerender(<MemberProfileSync />)

    expect(mocks.apiRequest).toHaveBeenCalledTimes(1)
  })

  it('does not call the profile API when no token is available', async () => {
    mocks.auth.isAuthenticated = true
    mocks.auth.user = { sub: 'user_member' }
    mocks.auth.getToken.mockResolvedValue(undefined)

    render(<MemberProfileSync />)

    await waitFor(() => expect(mocks.auth.getToken).toHaveBeenCalled())
    expect(mocks.apiRequest).not.toHaveBeenCalled()
  })

  it('keeps background synchronization failures out of the UI', async () => {
    mocks.auth.isAuthenticated = true
    mocks.auth.user = { sub: 'user_member' }
    mocks.auth.getToken.mockResolvedValue('access-token')
    mocks.apiRequest.mockRejectedValue(new Error('temporarily unavailable'))

    render(<MemberProfileSync />)

    await waitFor(() => expect(mocks.apiRequest).toHaveBeenCalled())
  })
})
