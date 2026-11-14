// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  ADMIN_CATEGORIES,
  fetchNotificationSettings,
  fetchNotificationStatus,
  MEMBER_CATEGORIES,
  saveNotificationSettings,
  unsubscribe,
  unsubscribeScopeWords,
} from './notifications-api'

const fetchMock = vi.fn()

beforeEach(() => {
  fetchMock.mockReset()
  fetchMock.mockImplementation(() =>
    Promise.resolve(new Response('{"ok":true}', { status: 200 })),
  )
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

function call(index = 0) {
  const [url, init] = fetchMock.mock.calls[index] as [string, RequestInit]
  return {
    url,
    method: init.method ?? 'GET',
    auth: (init.headers as Record<string, string>).Authorization,
    body: init.body ? (JSON.parse(init.body as string) as unknown) : undefined,
  }
}

describe('notifications API (Chunk 14)', () => {
  it('reads and saves the member’s own settings with the token', async () => {
    await fetchNotificationSettings('tok')
    expect(call(0)).toMatchObject({ method: 'GET', auth: 'Bearer tok' })
    expect(call(0).url).toMatch(/\/me\/notification-settings$/)
    await saveNotificationSettings('tok', { digest: false })
    expect(call(1)).toMatchObject({
      method: 'PUT',
      auth: 'Bearer tok',
      body: { digest: false },
    })
  })

  it('unsubscribes with the link’s token alone, no sign-in', async () => {
    await unsubscribe('v1.dXNlcg.digest.sig')
    expect(call(0)).toMatchObject({
      method: 'POST',
      auth: undefined,
      body: { token: 'v1.dXNlcg.digest.sig' },
    })
    expect(call(0).url).toMatch(/\/notifications\/unsubscribe$/)
  })

  it('reads the email status for admins', async () => {
    await fetchNotificationStatus('tok')
    expect(call(0).url).toMatch(/\/admin\/notifications$/)
  })

  it('says what a link turns off, only for scopes it knows', () => {
    expect(unsubscribeScopeWords('v1.x.digest.sig')).toBe(
      'the daily summary email',
    )
    expect(unsubscribeScopeWords('v1.x.adminReports.sig')).toBe(
      'admin emails about reports',
    )
    expect(unsubscribeScopeWords('v1.x.toString.sig')).toBeUndefined()
    expect(unsubscribeScopeWords('nonsense')).toBeUndefined()
    // Every category on the settings page has words for its link.
    for (const { key } of [...MEMBER_CATEGORIES, ...ADMIN_CATEGORIES]) {
      expect(unsubscribeScopeWords(`v1.x.${key}.sig`)).toMatch(/emails/)
    }
  })
})
