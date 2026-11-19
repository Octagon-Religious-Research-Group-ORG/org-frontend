// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { hideConnectionNote } from './admin-api'
import {
  answerConnection,
  article,
  blockMember,
  capitalised,
  fetchConnections,
  fetchConnectionTerms,
  fetchRelation,
  saveConnectionSettings,
  saveConnectionTerms,
  sendConnectionRequest,
  unblockMember,
} from './connections-api'

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

describe('connections API (Chunk 18)', () => {
  it('reads the feature’s name without a sign-in', async () => {
    await fetchConnectionTerms()
    expect(call(0)).toMatchObject({ method: 'GET', auth: undefined })
    expect(call(0).url).toMatch(/\/connections\/terms$/)
  })

  it('reads the member’s lists and where they stand with a page', async () => {
    await fetchConnections('tok')
    expect(call(0)).toMatchObject({ method: 'GET', auth: 'Bearer tok' })
    expect(call(0).url).toMatch(/\/me\/connections$/)
    await fetchRelation('tok', 'member a')
    expect(call(1).url).toMatch(/\/me\/connections\/with\/member%20a$/)
  })

  it('sends a request with a trimmed note, or none', async () => {
    await sendConnectionRequest('tok', 'member-b', '  hello  ')
    expect(call(0)).toMatchObject({
      method: 'POST',
      body: { slug: 'member-b', note: 'hello' },
    })
    await sendConnectionRequest('tok', 'member-b', '   ')
    expect(call(1).body).toEqual({ slug: 'member-b' })
  })

  it('answers, blocks, unblocks and saves settings', async () => {
    await answerConnection('tok', 'abc', 'accept')
    expect(call(0)).toMatchObject({ method: 'POST' })
    expect(call(0).url).toMatch(/\/me\/connections\/abc\/accept$/)
    await blockMember('tok', { connectionId: 'abc' })
    expect(call(1)).toMatchObject({
      method: 'POST',
      body: { connectionId: 'abc' },
    })
    await unblockMember('tok', 'blk')
    expect(call(2)).toMatchObject({ method: 'DELETE' })
    expect(call(2).url).toMatch(/\/me\/connections\/blocks\/blk$/)
    await saveConnectionSettings('tok', { openTo: 'nobody' })
    expect(call(3)).toMatchObject({ method: 'PUT', body: { openTo: 'nobody' } })
  })

  it('lets an admin rename the feature and hide a reported note', async () => {
    await saveConnectionTerms('tok', {
      singular: 'introduction',
      plural: 'introductions',
    })
    expect(call(0)).toMatchObject({
      method: 'PUT',
      body: { singular: 'introduction', plural: 'introductions' },
    })
    expect(call(0).url).toMatch(/\/admin\/settings\/connection-name$/)
    await hideConnectionNote('tok', 'abc', 'Synthetic reason')
    expect(call(1)).toMatchObject({
      method: 'POST',
      body: { reason: 'Synthetic reason' },
    })
    expect(call(1).url).toMatch(
      /\/admin\/moderation\/connection-notes\/abc\/hide$/,
    )
  })

  it('writes the name in a sentence', () => {
    expect(article('introduction')).toBe('an')
    expect(article('connection request')).toBe('a')
    expect(capitalised('connection requests')).toBe('Connection requests')
  })
})
