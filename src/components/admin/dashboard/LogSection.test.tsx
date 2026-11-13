// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type * as AdminApi from '#/lib/admin-api'
import { detailText, LogSection } from './LogSection'

const mocks = vi.hoisted(() => ({
  auth: {
    isLoading: false,
    isAuthenticated: true,
    user: { sub: 'user_admin' },
    getToken: vi.fn<() => Promise<string | undefined>>(),
  },
  fetchModerationLog: vi.fn(),
}))

vi.mock('#/lib/auth', () => ({ useOrgAuth: () => mocks.auth }))
vi.mock('#/lib/admin-api', async (original) => ({
  ...(await original<typeof AdminApi>()),
  fetchModerationLog: mocks.fetchModerationLog,
}))

beforeEach(() => {
  mocks.auth.getToken.mockReset().mockResolvedValue('tok')
  mocks.fetchModerationLog.mockReset().mockResolvedValue({
    entries: [
      {
        entryId: 'l1',
        at: '2026-11-13T10:00:00Z',
        actorUserId: 'user_admin',
        actorName: 'Synthetic Admin',
        action: 'page.removed',
        targetType: 'member-page',
        targetId: 'p1',
        reason: 'Synthetic reason',
        details: { slug: 'quiet-fern', previousStatus: 'approved' },
      },
      {
        entryId: 'l2',
        at: '2026-11-13T09:00:00Z',
        actorUserId: 'system:claims',
        action: 'claim.rejected',
        targetType: 'claim',
        targetId: 'c1',
        reason: 'This page no longer exists.',
      },
    ],
    hasMore: true,
  })
})
afterEach(cleanup)

describe('LogSection', () => {
  it('shows each entry with who, what, when and why, and pages', async () => {
    const user = userEvent.setup()
    render(<LogSection />)
    expect(await screen.findByText('Synthetic reason')).toBeTruthy()
    expect(screen.getByText(/Synthetic Admin/)).toBeTruthy()
    expect(screen.getByText(/system:claims/)).toBeTruthy()
    expect(
      screen.getByText(/slug: quiet-fern · previousStatus: approved/),
    ).toBeTruthy()
    expect(mocks.fetchModerationLog).toHaveBeenCalledWith('tok', 1)
    mocks.fetchModerationLog.mockResolvedValue({ entries: [], hasMore: false })
    await user.click(screen.getByRole('button', { name: 'Older' }))
    await waitFor(() =>
      expect(mocks.fetchModerationLog).toHaveBeenLastCalledWith('tok', 2),
    )
    expect(await screen.findByText('Nothing logged yet.')).toBeTruthy()
    // No editing of any kind.
    expect(screen.queryByRole('textbox')).toBeNull()
  })

  it('shows only the details worth a line', () => {
    expect(detailText(undefined)).toBe('')
    expect(detailText({ from: null, to: 'admin', secret: 'x' })).toBe(
      'from: none · to: admin',
    )
  })
})
