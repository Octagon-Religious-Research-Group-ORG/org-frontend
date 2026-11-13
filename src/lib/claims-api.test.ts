// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  approveClaim,
  claimDay,
  fetchAdminClaims,
  fetchLegacyComments,
  fetchMyClaims,
  linkLegacyComments,
  rejectClaim,
  requestClaim,
  withdrawClaim,
} from './claims-api'

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

describe('claims API', () => {
  it('reads and writes the member’s own requests with the token', async () => {
    await fetchMyClaims('tok')
    expect(call(0)).toMatchObject({ method: 'GET', auth: 'Bearer tok' })
    expect(call(0).url).toMatch(/\/me\/claims$/)

    await requestClaim('tok', 'a-page', 'Synthetic message')
    expect(call(1)).toMatchObject({
      method: 'POST',
      body: { slug: 'a-page', message: 'Synthetic message' },
    })

    await withdrawClaim('tok', 'c/1')
    expect(call(2).method).toBe('DELETE')
    expect(call(2).url).toMatch(/\/me\/claims\/c%2F1$/)
  })

  it('runs the admin queue and decisions', async () => {
    await fetchAdminClaims('tok', 'rejected')
    expect(call(0).url).toMatch(/\/admin\/claims\?status=rejected$/)

    await approveClaim('tok', 'c1')
    expect(call(1)).toMatchObject({ method: 'POST', body: undefined })
    expect(call(1).url).toMatch(/\/admin\/claims\/c1\/approve$/)

    await rejectClaim('tok', 'c1', '  Synthetic reason  ')
    expect(call(2).body).toEqual({ reason: 'Synthetic reason' })
    await rejectClaim('tok', 'c1', '   ')
    expect(call(3).body).toEqual({})
    expect(call(3).url).toMatch(/\/reject$/)
  })

  it('lists, links and unlinks imported comments', async () => {
    await fetchLegacyComments('tok', 'c1')
    expect(call(0).url).toMatch(/\/admin\/claims\/c1\/legacy-comments$/)
    await linkLegacyComments('tok', 'c1', ['x'])
    expect(call(1).url).toMatch(/\/legacy-comments\/link$/)
    expect(call(1).body).toEqual({ commentIds: ['x'] })
    await linkLegacyComments('tok', 'c1', ['x'], true)
    expect(call(2).url).toMatch(/\/legacy-comments\/unlink$/)
  })

  it('writes days in UTC', () => {
    expect(claimDay('2026-11-13T23:30:00Z')).toBe('Nov 13, 2026')
  })
})
