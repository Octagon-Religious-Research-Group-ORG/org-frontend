// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from './api'
import {
  MEMBERSHIP_TIMEOUT_MS,
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
    await checkSlug('a b&c', 'tok')
    expect(call(0).url).toMatch(/\/membership\/terms$/)
    expect(call(0).headers.Authorization).toBeUndefined()
    expect(call(1).url).toMatch(/slug-availability\?slug=a%20b%26c$/)
    expect(call(1).headers.Authorization).toBe('Bearer tok')
  })

  it('gives every call a time limit long enough to wake the server', async () => {
    const timeout = vi.spyOn(AbortSignal, 'timeout')
    await fetchMembershipTerms()
    expect(timeout).toHaveBeenCalledWith(MEMBERSHIP_TIMEOUT_MS)
    expect(MEMBERSHIP_TIMEOUT_MS).toBeGreaterThan(50_000)
    expect(call(0).init.signal).toBeInstanceOf(AbortSignal)
  })

  describe('failures in plain words', () => {
    it('explains a server that cannot be reached', async () => {
      fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'))
      await expect(fetchMyMembership('tok')).rejects.toThrow(
        /couldn't reach the ORG server/,
      )
    })

    it('explains a request that ran out of time', async () => {
      fetchMock.mockRejectedValueOnce(
        new DOMException('signal timed out', 'TimeoutError'),
      )
      await expect(fetchMembershipTerms()).rejects.toThrow(
        /couldn't reach the ORG server/,
      )
    })

    it('explains a server error without its status code', async () => {
      fetchMock.mockResolvedValueOnce(new Response('<html>', { status: 503 }))
      await expect(recordGuestEntry()).rejects.toThrow(/having trouble/)
    })

    it('explains too many tries', async () => {
      fetchMock.mockResolvedValueOnce(
        new Response('{"message":"ThrottlerException"}', { status: 429 }),
      )
      await expect(checkSlug('abc', 'tok')).rejects.toThrow(/too many tries/)
    })

    it('passes through a refusal the server worded itself', async () => {
      fetchMock.mockResolvedValueOnce(
        new Response('{"message":"The terms changed."}', { status: 409 }),
      )
      const refusal = await joinMembership('tok', {
        displayName: 'A',
        slug: 'a',
        anonymous: false,
        visibility: 'public',
        bio: 'b',
        beliefs: [],
        contacts: [],
        backupContacts: [],
        termsVersion: 'v',
      }).catch((err: unknown) => err)
      expect(refusal).toBeInstanceOf(ApiError)
      expect((refusal as ApiError).status).toBe(409)
      expect((refusal as ApiError).message).toBe('The terms changed.')
    })
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
    expect(suggestSlug('  Sam "Sammy" Ferns ')).toBe('sam-sammy-ferns')
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
