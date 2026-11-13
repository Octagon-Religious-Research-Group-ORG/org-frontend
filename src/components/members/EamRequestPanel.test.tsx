// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type * as AdminApi from '#/lib/admin-api'
import { EAM_EXPLAINED, EamRequestPanel } from './EamRequestPanel'

const mocks = vi.hoisted(() => ({
  auth: {
    isLoading: false,
    isAuthenticated: true,
    getToken: vi.fn<() => Promise<string | undefined>>(),
  },
  fetchMyEamRequest: vi.fn(),
  requestEam: vi.fn(),
}))

vi.mock('#/lib/auth', () => ({ useOrgAuth: () => mocks.auth }))
vi.mock('#/lib/admin-api', async (original) => ({
  ...(await original<typeof AdminApi>()),
  fetchMyEamRequest: mocks.fetchMyEamRequest,
  requestEam: mocks.requestEam,
}))

beforeEach(() => {
  mocks.auth.isLoading = false
  mocks.auth.isAuthenticated = true
  mocks.auth.getToken.mockReset().mockResolvedValue('tok')
  mocks.fetchMyEamRequest.mockReset().mockResolvedValue({ mayRequest: true })
  mocks.requestEam.mockReset().mockResolvedValue({
    mayRequest: false,
    block: 'already-requested',
    requestedAt: '2026-11-13T10:00:00Z',
  })
})
afterEach(cleanup)

describe('EamRequestPanel', () => {
  it('lets an approved member ask once, with an optional note', async () => {
    const user = userEvent.setup()
    render(<EamRequestPanel />)
    expect(await screen.findByText(EAM_EXPLAINED)).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Request EaM' }))
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    await user.click(screen.getByRole('button', { name: 'Request EaM' }))
    await user.type(
      screen.getByLabelText('A note for Tripp (optional)'),
      'Ready',
    )
    await user.click(screen.getByRole('button', { name: 'Send the request' }))
    expect(mocks.requestEam).toHaveBeenCalledWith('tok', 'Ready')
    expect((await screen.findByRole('status')).textContent).toBe(
      'You asked on Nov 13, 2026, 10:00 AM. Tripp will be in touch.',
    )
    expect(screen.queryByRole('button', { name: 'Request EaM' })).toBeNull()
  })

  it('says a member already asked, even without a date', async () => {
    mocks.fetchMyEamRequest.mockResolvedValue({
      mayRequest: false,
      block: 'already-requested',
    })
    render(<EamRequestPanel />)
    expect((await screen.findByRole('status')).textContent).toBe(
      'You asked. Tripp will be in touch.',
    )
  })

  it('shows nothing to anyone the server does not offer it to', async () => {
    mocks.fetchMyEamRequest.mockResolvedValue({
      mayRequest: false,
      block: 'needs-approved-page',
    })
    const { container } = render(<EamRequestPanel />)
    await Promise.resolve()
    await Promise.resolve()
    expect(mocks.fetchMyEamRequest).toHaveBeenCalled()
    expect(container.innerHTML).toBe('')
  })

  it('asks nothing of a signed-out visitor, a loading session, or a lost token', async () => {
    mocks.auth.isAuthenticated = false
    const first = render(<EamRequestPanel />)
    first.unmount()
    mocks.auth.isAuthenticated = true
    mocks.auth.isLoading = true
    const second = render(<EamRequestPanel />)
    second.unmount()
    mocks.auth.isLoading = false
    mocks.auth.getToken.mockResolvedValue(undefined)
    render(<EamRequestPanel />)
    await Promise.resolve()
    expect(mocks.fetchMyEamRequest).not.toHaveBeenCalled()
  })

  it('stays hidden when the server cannot be reached, and ignores a late answer', async () => {
    mocks.fetchMyEamRequest.mockRejectedValueOnce(new Error('offline'))
    const { container, unmount } = render(<EamRequestPanel />)
    await Promise.resolve()
    expect(container.innerHTML).toBe('')
    unmount()
    let finish: (value: unknown) => void = () => undefined
    mocks.fetchMyEamRequest.mockReturnValue(
      new Promise((resolve) => (finish = resolve)),
    )
    const late = render(<EamRequestPanel />)
    late.unmount()
    finish({ mayRequest: true })
    await Promise.resolve()
  })

  it('shows why a request failed', async () => {
    const user = userEvent.setup()
    mocks.requestEam.mockRejectedValueOnce(new Error('You have already asked.'))
    render(<EamRequestPanel />)
    await user.click(await screen.findByRole('button', { name: 'Request EaM' }))
    await user.click(screen.getByRole('button', { name: 'Send the request' }))
    expect((await screen.findByRole('alert')).textContent).toBe(
      'You have already asked.',
    )
    mocks.requestEam.mockRejectedValueOnce('raw')
    await user.click(screen.getByRole('button', { name: 'Send the request' }))
    expect((await screen.findByRole('alert')).textContent).toBe(
      'That did not work.',
    )
    mocks.auth.getToken.mockResolvedValue(undefined)
    await user.click(screen.getByRole('button', { name: 'Send the request' }))
    expect((await screen.findByRole('alert')).textContent).toBe(
      'Your sign-in session has expired.',
    )
  })
})
