// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  castVote,
  countsLabel,
  earlierLabel,
  fetchAgreedBeliefs,
  withdrawVote,
} from './votes-api'

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
  return { url, init, headers: init.headers as Record<string, string> }
}

describe('votes API', () => {
  it('casts with the token and exactly the fields given', async () => {
    await castVote('tok', {
      slug: 's',
      tabId: 't',
      value: 'agree',
      baseSeq: 2,
    })
    expect(call().url).toMatch(/\/me\/votes$/)
    expect(call().init.method).toBe('PUT')
    expect(call().headers.Authorization).toBe('Bearer tok')
    expect(JSON.parse(call().init.body as string)).toEqual({
      slug: 's',
      tabId: 't',
      value: 'agree',
      baseSeq: 2,
    })
  })

  it('withdraws by page and belief', async () => {
    await withdrawVote('tok', { slug: 's', tabId: 't' })
    expect(call().init.method).toBe('DELETE')
    expect(JSON.parse(call().init.body as string)).toEqual({
      slug: 's',
      tabId: 't',
    })
  })

  it('reads the agreed list as a guest, and the next page with a token', async () => {
    await fetchAgreedBeliefs()
    expect(call(0).url).toMatch(/\/members\/agreed-beliefs$/)
    expect(call(0).headers.Authorization).toBeUndefined()
    await fetchAgreedBeliefs({ after: '2.5.tab_1', token: 'tok' })
    expect(call(1).url).toMatch(/\/agreed-beliefs\?after=2\.5\.tab_1$/)
    expect(call(1).headers.Authorization).toBe('Bearer tok')
  })

  it('says the counts in words', () => {
    expect(countsLabel({ agree: 2, disagree: 1 })).toBe('2 agree · 1 disagree')
    expect(countsLabel({ agree: 1200, disagree: 0 })).toBe(
      '1,200 agree · 0 disagree',
    )
    expect(earlierLabel(0)).toBeUndefined()
    expect(earlierLabel(1)).toBe('1 vote on an earlier wording')
    expect(earlierLabel(3)).toBe('3 votes on an earlier wording')
  })
})
