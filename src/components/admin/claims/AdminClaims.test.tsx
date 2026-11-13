// @vitest-environment jsdom

import type { ReactNode } from 'react'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '#/lib/api'
import type * as ClaimsApi from '#/lib/claims-api'
import {
  ADMINS_ONLY,
  AdminClaims,
  APPROVE_EXPLAINED,
  OWN_REQUEST_NOTE,
} from './AdminClaims'

// Synthetic data only.
const mocks = vi.hoisted(() => {
  // Who is signed in: the admin, unless a test says otherwise.
  const user: { sub?: string } = { sub: 'user_admin' }
  return {
    auth: {
      isLoading: false,
      isAuthenticated: true,
      user,
      getToken: vi.fn<() => Promise<string | undefined>>(),
    },
    fetchAdminClaims: vi.fn(),
    approveClaim: vi.fn(),
    rejectClaim: vi.fn(),
    fetchLegacyComments: vi.fn(),
    linkLegacyComments: vi.fn(),
  }
})

vi.mock('#/lib/auth', () => ({ useOrgAuth: () => mocks.auth }))
vi.mock('#/lib/claims-api', async (original) => ({
  ...(await original<typeof ClaimsApi>()),
  fetchAdminClaims: mocks.fetchAdminClaims,
  approveClaim: mocks.approveClaim,
  rejectClaim: mocks.rejectClaim,
  fetchLegacyComments: mocks.fetchLegacyComments,
  linkLegacyComments: mocks.linkLegacyComments,
}))
vi.mock('@tanstack/react-router', async (original) => ({
  ...(await original<object>()),
  Link: ({
    children,
    params,
  }: {
    children: ReactNode
    params: { slug: string }
  }) => <a href={`/${params.slug}`}>{children}</a>,
}))

const claim = (overrides: Record<string, unknown> = {}) => ({
  claimId: 'c1',
  status: 'pending',
  message: 'Synthetic: I wrote it.',
  requestedAt: '2026-11-13T10:00:00Z',
  decidedBySite: false,
  claimant: {
    userId: 'user_c',
    email: 'claimant@example.test',
    emailVerified: true,
  },
  page: { slug: 'imported-page', displayName: 'Synthetic Page' },
  ...overrides,
})

beforeEach(() => {
  mocks.auth.getToken.mockReset().mockResolvedValue('tok')
  mocks.fetchAdminClaims.mockReset().mockResolvedValue({ claims: [claim()] })
  mocks.approveClaim.mockReset().mockResolvedValue({ approved: true })
  mocks.rejectClaim.mockReset().mockResolvedValue({ rejected: true })
  mocks.fetchLegacyComments
    .mockReset()
    .mockResolvedValue({ owner: {}, comments: [], hasMore: false })
  mocks.linkLegacyComments.mockReset()
})

afterEach(cleanup)

describe('AdminClaims', () => {
  it('lists waiting requests with who asked, the page and the message', async () => {
    render(<AdminClaims />)
    expect(
      (
        await screen.findByRole('link', { name: 'Synthetic Page' })
      ).getAttribute('href'),
    ).toBe('/imported-page')
    expect(screen.getByText(/claimant@example\.test/)).toBeTruthy()
    expect(screen.getByText('Synthetic: I wrote it.')).toBeTruthy()
    expect(screen.getByText(APPROVE_EXPLAINED)).toBeTruthy()
    expect(mocks.fetchAdminClaims).toHaveBeenCalledWith('tok', 'pending')
  })

  it('titles itself as a section inside the admin dashboard (Chunk 12)', async () => {
    render(<AdminClaims />)
    expect(
      screen.getByRole('heading', { level: 1, name: 'Page claims' }),
    ).toBeTruthy()
    cleanup()
    render(<AdminClaims embedded />)
    expect(
      screen.getByRole('heading', { level: 2, name: 'Page claims' }),
    ).toBeTruthy()
    expect(screen.queryByRole('heading', { level: 1 })).toBeNull()
    await screen.findByRole('link', { name: 'Synthetic Page' })
  })

  it('approves, then reloads the queue', async () => {
    const user = userEvent.setup()
    render(<AdminClaims />)
    await user.click(await screen.findByRole('button', { name: 'Approve' }))
    expect(mocks.approveClaim).toHaveBeenCalledWith('tok', 'c1')
    await waitFor(() => expect(mocks.fetchAdminClaims).toHaveBeenCalledTimes(2))
  })

  it('rejects with an optional reason, or cancels', async () => {
    const user = userEvent.setup()
    render(<AdminClaims />)
    await user.click(await screen.findByRole('button', { name: 'Reject…' }))
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    await user.click(screen.getByRole('button', { name: 'Reject…' }))
    await user.type(
      screen.getByLabelText(/Reason, shown to the person who asked/),
      'Synthetic reason',
    )
    await user.click(screen.getByRole('button', { name: 'Reject the request' }))
    expect(mocks.rejectClaim).toHaveBeenCalledWith(
      'tok',
      'c1',
      'Synthetic reason',
    )
  })

  it('shows a refusal; a conflict also reloads, as the queue moved on', async () => {
    const user = userEvent.setup()
    mocks.approveClaim.mockRejectedValueOnce(
      new ApiError('That page now belongs to another member.', 409),
    )
    render(<AdminClaims />)
    await user.click(await screen.findByRole('button', { name: 'Approve' }))
    await waitFor(() => expect(mocks.fetchAdminClaims).toHaveBeenCalledTimes(2))
    mocks.approveClaim.mockRejectedValueOnce(new ApiError('Busy server.', 503))
    await user.click(await screen.findByRole('button', { name: 'Approve' }))
    expect((await screen.findByRole('alert')).textContent).toBe('Busy server.')
    expect(mocks.fetchAdminClaims).toHaveBeenCalledTimes(2)
    mocks.approveClaim.mockRejectedValueOnce('odd')
    await user.click(screen.getByRole('button', { name: 'Approve' }))
    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toBe('That did not work.'),
    )
    mocks.auth.getToken.mockResolvedValueOnce(undefined)
    await user.click(screen.getByRole('button', { name: 'Approve' }))
    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toMatch(/expired/),
    )
  })

  it('switches status, and shows decided requests with who decided and why', async () => {
    const user = userEvent.setup()
    render(<AdminClaims />)
    await screen.findByText('Synthetic: I wrote it.')
    mocks.fetchAdminClaims.mockResolvedValueOnce({
      claims: [
        claim({
          status: 'rejected',
          decidedAt: '2026-11-14T10:00:00Z',
          decidedBySite: true,
          reason: 'This page now belongs to another member.',
          page: undefined,
          claimant: { userId: 'user_x', emailVerified: false },
        }),
        claim({
          claimId: 'c2',
          status: 'rejected',
          decidedAt: '2026-11-14T10:00:00Z',
        }),
      ],
    })
    await user.click(screen.getByRole('tab', { name: 'Rejected' }))
    expect(mocks.fetchAdminClaims).toHaveBeenLastCalledWith('tok', 'rejected')
    expect(
      await screen.findByText(
        /Decided by the site on Nov 14, 2026 · Reason: This page now belongs/,
      ),
    ).toBeTruthy()
    expect(screen.getByText('A page that no longer exists')).toBeTruthy()
    expect(screen.getByText(/user_x/).closest('p')?.textContent).toMatch(
      /email not confirmed/,
    )
    expect(screen.getByText('Decided on Nov 14, 2026')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Approve' })).toBeNull()
  })

  it('says when there is nothing', async () => {
    mocks.fetchAdminClaims.mockResolvedValueOnce({ claims: [] })
    render(<AdminClaims />)
    expect(await screen.findByText('No requests here.')).toBeTruthy()
  })

  it('opens and closes the imported-comment linking on an approved request', async () => {
    const user = userEvent.setup()
    mocks.fetchAdminClaims.mockResolvedValueOnce({
      claims: [
        claim({ status: 'approved', decidedAt: '2026-11-14T10:00:00Z' }),
        claim({ claimId: 'c2', status: 'approved', page: undefined }),
      ],
    })
    render(<AdminClaims />)
    const open = await screen.findByRole('button', {
      name: 'Link imported comments…',
    })
    expect(
      screen.getAllByRole('button', { name: /imported comments/ }),
    ).toHaveLength(1)
    await user.click(open)
    expect(
      await screen.findByText('No imported comments are left to link.'),
    ).toBeTruthy()
    expect(mocks.fetchLegacyComments).toHaveBeenCalledWith('tok', 'c1')
    await user.click(
      screen.getByRole('button', { name: 'Close imported comments' }),
    )
    expect(
      screen.queryByText('No imported comments are left to link.'),
    ).toBeNull()
  })

  it('offers no decision and no linking on the admin’s own request (review round 2)', async () => {
    mocks.fetchAdminClaims.mockResolvedValueOnce({
      claims: [
        claim({ claimant: { userId: 'user_admin' } }),
        claim({
          claimId: 'c2',
          status: 'approved',
          claimant: { userId: 'user_admin' },
        }),
        claim({
          claimId: 'c3',
          status: 'rejected',
          claimant: { userId: 'user_admin' },
        }),
      ],
    })
    render(<AdminClaims />)
    expect(await screen.findAllByText(OWN_REQUEST_NOTE)).toHaveLength(2)
    expect(screen.queryByRole('button', { name: 'Approve' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Reject…' })).toBeNull()
    expect(
      screen.queryByRole('button', { name: 'Link imported comments…' }),
    ).toBeNull()
  })

  it('still offers linking on someone else’s approved request', async () => {
    mocks.auth.user = {}
    mocks.fetchAdminClaims.mockResolvedValueOnce({
      claims: [claim({ status: 'approved' })],
    })
    render(<AdminClaims />)
    expect(
      await screen.findByRole('button', { name: 'Link imported comments…' }),
    ).toBeTruthy()
    expect(screen.queryByText(OWN_REQUEST_NOTE)).toBeNull()
    mocks.auth.user = { sub: 'user_admin' }
  })

  it('tells a non-admin this page is not for them', async () => {
    mocks.fetchAdminClaims.mockRejectedValueOnce(new ApiError('No.', 403))
    render(<AdminClaims />)
    expect((await screen.findByRole('alert')).textContent).toBe(ADMINS_ONLY)
  })

  it('offers to try again when the queue does not load', async () => {
    const user = userEvent.setup()
    mocks.fetchAdminClaims.mockRejectedValueOnce(new Error('Server asleep.'))
    render(<AdminClaims />)
    expect((await screen.findByRole('alert')).textContent).toBe(
      'Server asleep.',
    )
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByText('Synthetic: I wrote it.')).toBeTruthy()
    cleanup()
    mocks.fetchAdminClaims.mockRejectedValueOnce('odd')
    render(<AdminClaims />)
    expect((await screen.findByRole('alert')).textContent).toBe(
      'The requests did not load.',
    )
  })

  it('ignores an answer that arrives after it was closed', async () => {
    let resolve: (value: unknown) => void = () => undefined
    mocks.fetchAdminClaims.mockReturnValueOnce(
      new Promise((done) => (resolve = done)),
    )
    const first = render(<AdminClaims />)
    first.unmount()
    resolve({ claims: [] })
    let reject: (reason: unknown) => void = () => undefined
    mocks.fetchAdminClaims.mockReturnValueOnce(
      new Promise((_done, fail) => (reject = fail)),
    )
    const second = render(<AdminClaims />)
    second.unmount()
    reject(new Error('late'))
    await Promise.resolve()
    expect(screen.queryByRole('alert')).toBeNull()
  })
})
