// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  checkSlug,
  fetchMembershipTerms,
  fetchMyMembership,
  isGuest,
  joinMembership,
  recordGuestEntry,
  setGuest,
  suggestSlug,
} from './membership-api'

const fetchMock = vi.fn()

beforeEach(() => {
  fetchMock.mockReset()
  fetchMock.mockImplementation(() =>
    Promise.resolve(
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
    ),
  )
  vi.stubGlobal('fetch', fetchMock)
  localStorage.clear()
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

function call(index = 0) {
  const [url, init] = fetchMock.mock.calls[index] as [string, RequestInit]
  return { url, init, headers: init.headers as Record<string, string> }
}

describe('membership API calls', () => {
  it('reads the terms and checks an address without a token', async () => {
    await fetchMembershipTerms()
    await checkSlug('a b&c')
    expect(call(0).url).toMatch(/\/membership\/terms$/)
    expect(call(1).url).toMatch(/slug-availability\?slug=a%20b%26c$/)
    expect(call(1).headers.Authorization).toBeUndefined()
  })

  it('reads and joins with the member token', async () => {
    await fetchMyMembership('tok')
    await joinMembership('tok', {
      displayName: 'A',
      slug: 'a',
      anonymous: false,
      visibility: 'public',
      bio: 'b',
      beliefs: [{ title: 't', text: 'x' }],
      contacts: [],
      backupContacts: [{ method: 'phone', value: '1' }],
      termsVersion: 'v',
    })
    expect(call(0).url).toMatch(/\/me\/membership$/)
    expect(call(0).headers.Authorization).toBe('Bearer tok')
    expect(call(1).init.method).toBe('POST')
    expect(JSON.parse(String(call(1).init.body))).toMatchObject({ slug: 'a' })
  })

  it('records a guest entry', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }))
    await expect(recordGuestEntry()).resolves.toBeUndefined()
    expect(call().url).toMatch(/\/membership\/guest-entry$/)
    expect(call().init.method).toBe('POST')
  })
})

describe('suggestSlug', () => {
  it('turns a name into a page address', () => {
    expect(suggestSlug('  David "Davidya" Blood ')).toBe('david-davidya-blood')
    expect(suggestSlug('Renée Ö')).toBe('renee-o')
    expect(suggestSlug('x'.repeat(90))).toHaveLength(80)
    expect(suggestSlug('!!!')).toBe('')
  })
})

describe('guest flag', () => {
  it('is remembered in this browser and can be cleared', () => {
    expect(isGuest()).toBe(false)
    setGuest(true)
    expect(isGuest()).toBe(true)
    setGuest(false)
    expect(isGuest()).toBe(false)
  })

  it('degrades quietly when storage is blocked', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    expect(isGuest()).toBe(false)
    expect(() => setGuest(true)).not.toThrow()
  })
})
