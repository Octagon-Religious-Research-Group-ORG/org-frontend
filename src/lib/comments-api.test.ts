// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  acceptSuggestion,
  declineSuggestion,
  editComment,
  fetchCommentHistory,
  fetchThread,
  postComment,
  removeComment,
  suggestRewording,
} from './comments-api'

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

describe('comments API', () => {
  it('reads a page thread as a guest, and a belief thread page with a token', async () => {
    await fetchThread('Quiet-Fern')
    expect(call(0).url).toMatch(/\/members\/profiles\/quiet-fern\/comments$/)
    expect(call(0).headers.Authorization).toBeUndefined()
    await fetchThread('quiet-fern', {
      tabId: 'tab_1',
      after: 'cmt_9',
      token: 'tok',
    })
    expect(call(1).url).toMatch(/\/comments\?tab=tab_1&after=cmt_9$/)
    expect(call(1).headers.Authorization).toBe('Bearer tok')
  })

  it('reads a comment history page', async () => {
    await fetchCommentHistory('quiet-fern', 'cmt/1')
    expect(call(0).url).toMatch(/\/comments\/cmt%2F1\/history\?page=1$/)
    await fetchCommentHistory('quiet-fern', 'cmt_1', { page: 3, token: 't' })
    expect(call(1).url).toMatch(/history\?page=3$/)
  })

  it('writes with the token, sending only what it is given', async () => {
    await postComment('tok', { slug: 's', body: 'Hello', tabId: 't' })
    expect(call(0).url).toMatch(/\/me\/comments$/)
    expect(call(0).init.method).toBe('POST')
    expect(JSON.parse(call(0).init.body as string)).toEqual({
      slug: 's',
      body: 'Hello',
      tabId: 't',
    })
    await editComment('tok', 'cmt_1', 'Edited', 2)
    expect(call(1).url).toMatch(/\/me\/comments\/cmt_1$/)
    expect(call(1).init.method).toBe('PUT')
    expect(JSON.parse(call(1).init.body as string)).toEqual({
      body: 'Edited',
      baseSeq: 2,
    })
    await removeComment('tok', 'cmt_1')
    expect(call(2).init.method).toBe('DELETE')
    await suggestRewording('tok', {
      slug: 's',
      tabId: 't',
      text: 'New',
      baseSeq: 4,
    })
    expect(call(3).url).toMatch(/\/me\/suggestions$/)
    await acceptSuggestion('tok', 'cmt_2')
    expect(call(4).url).toMatch(
      /\/me\/member-page\/suggestions\/cmt_2\/accept$/,
    )
    await declineSuggestion('tok', 'cmt_2')
    expect(call(5).url).toMatch(/\/cmt_2\/decline$/)
    expect(call(5).headers.Authorization).toBe('Bearer tok')
  })
})
