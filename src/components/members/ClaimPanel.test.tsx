// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type * as ClaimsApi from '#/lib/claims-api'
import {
  CLAIM_BLOCK_NOTES,
  CLAIM_BUTTON,
  CLAIM_EXPLAINED,
  CLAIM_MESSAGE_LABEL,
  CLAIM_PENDING,
  CLAIM_REJECTED,
  ClaimPanel,
} from './ClaimPanel'

// Synthetic data only.
const mocks = vi.hoisted(() => ({
  auth: {
    isLoading: false,
    isAuthenticated: true,
    getToken: vi.fn<() => Promise<string | undefined>>(),
  },
  fetchMyClaims: vi.fn(),
  requestClaim: vi.fn(),
  withdrawClaim: vi.fn(),
}))

vi.mock('#/lib/auth', () => ({ useOrgAuth: () => mocks.auth }))
vi.mock('#/lib/claims-api', async (original) => ({
  ...(await original<typeof ClaimsApi>()),
  fetchMyClaims: mocks.fetchMyClaims,
  requestClaim: mocks.requestClaim,
  withdrawClaim: mocks.withdrawClaim,
}))

const claim = (overrides: Record<string, unknown> = {}) => ({
  claimId: 'c1',
  page: { slug: 'imported-page', displayName: 'Synthetic' },
  status: 'pending',
  message: 'Synthetic message',
  requestedAt: '2026-11-13T10:00:00Z',
  ...overrides,
})

beforeEach(() => {
  mocks.auth.isLoading = false
  mocks.auth.isAuthenticated = true
  mocks.auth.getToken.mockReset().mockResolvedValue('tok')
  mocks.fetchMyClaims
    .mockReset()
    .mockResolvedValue({ mayClaim: true, claims: [] })
  mocks.requestClaim.mockReset().mockResolvedValue(claim())
  mocks.withdrawClaim.mockReset().mockResolvedValue({ withdrawn: true })
})

afterEach(cleanup)

const renderPanel = () => render(<ClaimPanel slug="imported-page" />)

describe('ClaimPanel', () => {
  it('shows nothing to a guest, and waits for the login check', () => {
    mocks.auth.isAuthenticated = false
    const { container } = renderPanel()
    expect(container.textContent).toBe('')
    expect(mocks.fetchMyClaims).not.toHaveBeenCalled()
    cleanup()
    mocks.auth.isAuthenticated = true
    mocks.auth.isLoading = true
    renderPanel()
    expect(mocks.fetchMyClaims).not.toHaveBeenCalled()
  })

  it('asks, with a message, and then shows the waiting request', async () => {
    const user = userEvent.setup()
    renderPanel()
    expect(await screen.findByText(CLAIM_EXPLAINED)).toBeTruthy()
    await user.click(screen.getByRole('button', { name: CLAIM_BUTTON }))
    const send = screen.getByRole<HTMLButtonElement>('button', {
      name: 'Send my request',
    })
    expect(send.disabled).toBe(true)
    await user.type(
      screen.getByLabelText(CLAIM_MESSAGE_LABEL),
      'I shared it in 2019.',
    )
    expect(screen.getByText(/20 \/ 2,000 characters/)).toBeTruthy()
    mocks.fetchMyClaims.mockResolvedValue({
      mayClaim: false,
      block: 'has-pending',
      claims: [claim()],
    })
    await user.click(send)
    expect(mocks.requestClaim).toHaveBeenCalledWith(
      'tok',
      'imported-page',
      'I shared it in 2019.',
    )
    expect(await screen.findByText(CLAIM_PENDING)).toBeTruthy()
    expect(screen.getByText('Asked on Nov 13, 2026.')).toBeTruthy()
  })

  it('refuses a message over the limit before sending, and can cancel', async () => {
    const user = userEvent.setup()
    renderPanel()
    await user.click(await screen.findByRole('button', { name: CLAIM_BUTTON }))
    const box = screen.getByLabelText(CLAIM_MESSAGE_LABEL)
    await user.click(box)
    await user.paste('x'.repeat(2001))
    expect(screen.getByText(/\(too long\)/)).toBeTruthy()
    expect(
      screen.getByRole<HTMLButtonElement>('button', { name: 'Send my request' })
        .disabled,
    ).toBe(true)
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.getByRole('button', { name: CLAIM_BUTTON })).toBeTruthy()
  })

  it('shows the server’s refusal and keeps the form', async () => {
    const user = userEvent.setup()
    mocks.requestClaim.mockRejectedValueOnce(new Error('Already taken.'))
    renderPanel()
    await user.click(await screen.findByRole('button', { name: CLAIM_BUTTON }))
    await user.type(screen.getByLabelText(CLAIM_MESSAGE_LABEL), 'Mine.')
    await user.click(screen.getByRole('button', { name: 'Send my request' }))
    expect((await screen.findByRole('alert')).textContent).toBe(
      'Already taken.',
    )
    expect(screen.getByLabelText(CLAIM_MESSAGE_LABEL)).toBeTruthy()
    mocks.requestClaim.mockRejectedValueOnce('odd')
    await user.click(screen.getByRole('button', { name: 'Send my request' }))
    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toBe('That did not work.'),
    )
  })

  it('withdraws a waiting request', async () => {
    const user = userEvent.setup()
    mocks.fetchMyClaims.mockResolvedValueOnce({
      mayClaim: false,
      block: 'has-pending',
      claims: [claim()],
    })
    renderPanel()
    await user.click(
      await screen.findByRole('button', { name: 'Withdraw my request' }),
    )
    expect(mocks.withdrawClaim).toHaveBeenCalledWith('tok', 'c1')
    expect(
      await screen.findByRole('button', { name: CLAIM_BUTTON }),
    ).toBeTruthy()
  })

  it('says when the session has expired', async () => {
    const user = userEvent.setup()
    mocks.fetchMyClaims.mockResolvedValueOnce({
      mayClaim: false,
      block: 'has-pending',
      claims: [claim()],
    })
    renderPanel()
    const withdraw = await screen.findByRole('button', {
      name: 'Withdraw my request',
    })
    mocks.auth.getToken.mockResolvedValueOnce(undefined)
    await user.click(withdraw)
    expect((await screen.findByRole('alert')).textContent).toMatch(/expired/)
  })

  it('shows a rejection with its reason, and lets the member ask again', async () => {
    mocks.fetchMyClaims.mockResolvedValueOnce({
      mayClaim: true,
      claims: [claim({ status: 'rejected', reason: 'Synthetic reason' })],
    })
    renderPanel()
    expect(await screen.findByText(CLAIM_REJECTED)).toBeTruthy()
    expect(screen.getByText('Reason given: Synthetic reason')).toBeTruthy()
    expect(screen.getByRole('button', { name: CLAIM_BUTTON })).toBeTruthy()
    expect(screen.queryByText(CLAIM_EXPLAINED)).toBeNull()
  })

  it('shows a rejection without a reason', async () => {
    mocks.fetchMyClaims.mockResolvedValueOnce({
      mayClaim: false,
      block: 'has-pending',
      claims: [
        claim({ status: 'rejected' }),
        claim({ claimId: 'c2', page: undefined }),
      ],
    })
    renderPanel()
    expect(await screen.findByText(CLAIM_REJECTED)).toBeTruthy()
    expect(screen.queryByText(/Reason given/)).toBeNull()
    expect(
      screen.getByText(CLAIM_BLOCK_NOTES['has-pending'] as string),
    ).toBeTruthy()
  })

  it.each(['verify-email', 'cannot-check', 'has-pending'] as const)(
    'explains a %s refusal instead of the button',
    async (block) => {
      mocks.fetchMyClaims.mockResolvedValueOnce({
        mayClaim: false,
        block,
        claims: [],
      })
      renderPanel()
      expect(
        await screen.findByText(CLAIM_BLOCK_NOTES[block] as string),
      ).toBeTruthy()
      expect(screen.queryByRole('button', { name: CLAIM_BUTTON })).toBeNull()
    },
  )

  it('says nothing to an account that already has a page', async () => {
    mocks.fetchMyClaims.mockResolvedValueOnce({
      mayClaim: false,
      block: 'has-page',
      claims: [claim({ status: 'withdrawn' })],
    })
    const { container } = renderPanel()
    await waitFor(() => expect(mocks.fetchMyClaims).toHaveBeenCalled())
    expect(container.textContent).toBe('')
  })

  it('offers to try again when the requests do not load', async () => {
    const user = userEvent.setup()
    mocks.fetchMyClaims.mockRejectedValueOnce(new Error('Server asleep.'))
    renderPanel()
    expect((await screen.findByRole('alert')).textContent).toBe(
      'Server asleep.',
    )
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    expect(
      await screen.findByRole('button', { name: CLAIM_BUTTON }),
    ).toBeTruthy()
  })

  it('reports a session that ended, or an odd failure, while loading', async () => {
    mocks.auth.getToken.mockResolvedValueOnce(undefined)
    renderPanel()
    expect((await screen.findByRole('alert')).textContent).toMatch(/expired/)
    cleanup()
    mocks.fetchMyClaims.mockRejectedValueOnce('odd')
    renderPanel()
    expect((await screen.findByRole('alert')).textContent).toBe(
      'Your requests did not load.',
    )
  })

  it('ignores an answer that arrives after it was closed', async () => {
    let resolve: (value: unknown) => void = () => undefined
    mocks.fetchMyClaims.mockReturnValueOnce(
      new Promise((done) => (resolve = done)),
    )
    const { unmount } = renderPanel()
    unmount()
    resolve({ mayClaim: true, claims: [] })
    let reject: (reason: unknown) => void = () => undefined
    mocks.fetchMyClaims.mockReturnValueOnce(
      new Promise((_done, fail) => (reject = fail)),
    )
    const second = renderPanel()
    second.unmount()
    reject(new Error('late'))
    await Promise.resolve()
    expect(screen.queryByRole('alert')).toBeNull()
  })
})
