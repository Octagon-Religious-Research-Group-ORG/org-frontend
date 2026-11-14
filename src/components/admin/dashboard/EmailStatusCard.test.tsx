// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '#/lib/api'
import type * as NotificationsApi from '#/lib/notifications-api'
import { EmailStatusCard, NOT_SENDING } from './EmailStatusCard'

const mocks = vi.hoisted(() => ({
  auth: {
    isLoading: false,
    isAuthenticated: true,
    user: { sub: 'user_admin' },
    getToken: vi.fn<() => Promise<string | undefined>>(),
  },
  fetchNotificationStatus: vi.fn(),
}))

vi.mock('#/lib/auth', () => ({ useOrgAuth: () => mocks.auth }))
vi.mock('#/lib/notifications-api', async (original) => ({
  ...(await original<typeof NotificationsApi>()),
  fetchNotificationStatus: mocks.fetchNotificationStatus,
}))

const status = {
  enabled: true,
  digestHourUtc: 14,
  budget: {
    day: '2026-11-13',
    sent: 12,
    dailyLimit: 70,
    immediateReserve: 20,
  },
  waiting: { digest: 4, immediate: 1, adminNotices: 0 },
  failedLast7Days: 2,
}

beforeEach(() => {
  mocks.auth.getToken.mockReset().mockResolvedValue('tok')
  mocks.fetchNotificationStatus.mockReset().mockResolvedValue(status)
})
afterEach(cleanup)

describe('EmailStatusCard (Chunk 14)', () => {
  it('shows today’s count against the limit, what waits and what failed', async () => {
    render(<EmailStatusCard />)
    expect(
      await screen.findByText('12 of 70 (20 kept for claims and moderation)'),
    ).toBeTruthy()
    expect(
      screen.getByText(
        '4 for the daily summary, 1 to send now, 0 admin notices',
      ),
    ).toBeTruthy()
    expect(screen.getByText('from 14:00 UTC')).toBeTruthy()
    expect(screen.queryByText('Limit reached')).toBeNull()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('says when the day’s limit was reached, and when sending is off', async () => {
    mocks.fetchNotificationStatus.mockResolvedValue({
      ...status,
      enabled: false,
      budget: { ...status.budget, limitHitAt: '2026-11-13T16:00:00Z' },
    })
    render(<EmailStatusCard />)
    expect((await screen.findByRole('alert')).textContent).toBe(NOT_SENDING)
    expect(screen.getByText('Limit reached')).toBeTruthy()
    expect(screen.getByText(/the rest waits for tomorrow/)).toBeTruthy()
  })

  it('shows nothing of it to someone who is not an admin', async () => {
    mocks.fetchNotificationStatus.mockRejectedValue(
      new ApiError('Forbidden', 403),
    )
    render(<EmailStatusCard />)
    expect(await screen.findByText(/for ORG admins/)).toBeTruthy()
    expect(screen.queryByText('Sent today (UTC)')).toBeNull()
  })

  it('shows failed daily summaries too (review L7)', async () => {
    mocks.fetchNotificationStatus.mockResolvedValue({
      ...status,
      digestFailedLast7Days: 3,
    })
    render(<EmailStatusCard />)
    expect(
      await screen.findByText('2 single emails, 3 daily summaries'),
    ).toBeTruthy()
  })
})
