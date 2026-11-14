// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type * as NotificationsApi from '#/lib/notifications-api'
import {
  ADMIN_EMAILS_EXPLAINED,
  NotificationSettings,
  SAVED,
  SESSION_EXPIRED,
} from './NotificationSettings'

const mocks = vi.hoisted(() => ({
  auth: {
    isLoading: false,
    isAuthenticated: true,
    getToken: vi.fn<() => Promise<string | undefined>>(),
  },
  fetchNotificationSettings: vi.fn(),
  saveNotificationSettings: vi.fn(),
}))

vi.mock('#/lib/auth', () => ({ useOrgAuth: () => mocks.auth }))
vi.mock('#/lib/notifications-api', async (original) => ({
  ...(await original<typeof NotificationsApi>()),
  fetchNotificationSettings: mocks.fetchNotificationSettings,
  saveNotificationSettings: mocks.saveNotificationSettings,
}))

const member = {
  categories: {
    comments: true,
    replies: true,
    suggestions: true,
    votes: true,
    claims: true,
    moderation: true,
  },
  digest: true,
  immediate: true,
}
const admin = {
  ...member,
  admin: {
    categories: {
      adminPages: true,
      adminEam: true,
      adminReports: true,
      adminClaims: true,
    },
    adminImmediate: true,
  },
}

beforeEach(() => {
  mocks.auth.getToken.mockReset().mockResolvedValue('tok')
  mocks.fetchNotificationSettings.mockReset().mockResolvedValue(member)
  mocks.saveNotificationSettings
    .mockReset()
    .mockImplementation((_token: string, change: object) =>
      Promise.resolve({ ...member, ...change }),
    )
})
afterEach(cleanup)

describe('NotificationSettings (Chunk 14)', () => {
  it('shows every category on by default, and saves only on Save', async () => {
    const user = userEvent.setup()
    render(<NotificationSettings />)
    const replies = await screen.findByRole('checkbox', {
      name: 'Replies to my comments',
    })
    expect((replies as HTMLInputElement).checked).toBe(true)
    expect(screen.queryByText(ADMIN_EMAILS_EXPLAINED)).toBeNull()
    await user.click(replies)
    await user.click(screen.getByRole('checkbox', { name: 'A daily summary' }))
    await user.click(
      screen.getByRole('checkbox', { name: 'Claims and moderation at once' }),
    )
    expect(mocks.saveNotificationSettings).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(mocks.saveNotificationSettings).toHaveBeenCalledWith('tok', {
      categories: { ...member.categories, replies: false },
      digest: false,
      immediate: false,
    })
    expect((await screen.findByRole('status')).textContent).toBe(SAVED)
    // A new change takes the "saved" note away until it is saved too.
    await user.click(screen.getByRole('checkbox', { name: 'A daily summary' }))
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('gives admins their own section and saves it with the rest', async () => {
    mocks.fetchNotificationSettings.mockResolvedValue(admin)
    mocks.saveNotificationSettings.mockResolvedValue(admin)
    const user = userEvent.setup()
    render(<NotificationSettings />)
    expect(await screen.findByText(ADMIN_EMAILS_EXPLAINED)).toBeTruthy()
    await user.click(screen.getByRole('checkbox', { name: 'Reports' }))
    await user.click(
      screen.getByRole('checkbox', { name: 'Claims and reports at once' }),
    )
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(mocks.saveNotificationSettings).toHaveBeenCalledWith('tok', {
      categories: {
        ...member.categories,
        ...admin.admin.categories,
        adminReports: false,
      },
      digest: true,
      immediate: true,
      adminImmediate: false,
    })
  })

  it('reads a category the server left out as on', async () => {
    mocks.fetchNotificationSettings.mockResolvedValue({
      ...admin,
      categories: {},
      admin: { categories: {}, adminImmediate: true },
    })
    render(<NotificationSettings />)
    expect(
      await screen.findByRole('checkbox', {
        name: 'Moderation of my comments',
      }),
    ).toHaveProperty('checked', true)
    expect(
      screen.getByRole('checkbox', { name: 'EaM requests' }),
    ).toHaveProperty('checked', true)
  })

  it('says when saving failed, never "saved"', async () => {
    const user = userEvent.setup()
    mocks.saveNotificationSettings.mockRejectedValueOnce(new Error('No.'))
    render(<NotificationSettings />)
    await user.click(await screen.findByRole('button', { name: 'Save' }))
    expect((await screen.findByRole('alert')).textContent).toBe('No.')
    expect(screen.queryByRole('status')).toBeNull()
    mocks.saveNotificationSettings.mockRejectedValueOnce('odd')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect((await screen.findByRole('alert')).textContent).toBe(
      'That did not work.',
    )
    mocks.auth.getToken.mockResolvedValueOnce(undefined)
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect((await screen.findByRole('alert')).textContent).toBe(SESSION_EXPIRED)
  })

  it('offers a retry when the settings do not load', async () => {
    const user = userEvent.setup()
    mocks.fetchNotificationSettings
      .mockRejectedValueOnce(new Error('Down.'))
      .mockRejectedValueOnce('odd')
    render(<NotificationSettings />)
    expect((await screen.findByRole('alert')).textContent).toBe('Down.')
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    expect((await screen.findByRole('alert')).textContent).toBe(
      'That did not load.',
    )
    mocks.auth.getToken.mockResolvedValueOnce(undefined)
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    expect((await screen.findByRole('alert')).textContent).toBe(SESSION_EXPIRED)
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    expect(
      await screen.findByRole('checkbox', { name: 'A daily summary' }),
    ).toBeTruthy()
  })

  it('ignores an answer that arrives after it was closed', async () => {
    let finish: (value: unknown) => void = () => undefined
    mocks.fetchNotificationSettings.mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve
      }),
    )
    const { unmount } = render(<NotificationSettings />)
    expect(screen.getByText('Loading your email settings…')).toBeTruthy()
    unmount()
    finish(member)
    await Promise.resolve()

    let fail: (error: unknown) => void = () => undefined
    mocks.fetchNotificationSettings.mockReturnValueOnce(
      new Promise((_resolve, reject) => {
        fail = reject
      }),
    )
    const second = render(<NotificationSettings />)
    second.unmount()
    fail(new Error('late'))
    await Promise.resolve()
  })
})
