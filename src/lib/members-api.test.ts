// @vitest-environment jsdom

import { isNotFound } from '@tanstack/react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  SERVER_RENDER_TIMEOUT_MS,
  addBeliefTab,
  changeVisibility,
  fetchMemberChats,
  fetchMemberDirectory,
  fetchMemberProfile,
  fetchPictureObjectUrl,
  isMemberSlug,
  loadMemberPage,
  pictureUrl,
  uploadProfilePicture,
} from './members-api'

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
  vi.restoreAllMocks()
})

function call(index = 0) {
  const [url, init] = fetchMock.mock.calls[index] as [string, RequestInit]
  return { url, init, headers: init.headers as Record<string, string> }
}

describe('isMemberSlug', () => {
  it.each(['ab', 'quiet-fern', 'a1-b2', 'Quiet-Fern'])('accepts %s', (slug) => {
    expect(isMemberSlug(slug)).toBe(true)
  })

  it.each(['a', '../x', 'a--b', '-ab', 'favicon.ico', 'x'.repeat(81)])(
    'refuses %s',
    (slug) => {
      expect(isMemberSlug(slug)).toBe(false)
    },
  )
})

describe('reading', () => {
  it('builds a picture address the path cannot escape', () => {
    expect(pictureUrl('a/b')).toMatch(/members\/profiles\/a%2Fb\/picture$/)
  })

  it('reads the directory and chats, with a token only when given one', async () => {
    await fetchMemberDirectory()
    await fetchMemberChats('tok')
    expect(call(0).url).toMatch(/\/members\/directory$/)
    expect(call(0).headers.Authorization).toBeUndefined()
    expect(call(1).url).toMatch(/\/members\/chats$/)
    expect(call(1).headers.Authorization).toBe('Bearer tok')
  })

  it('asks for a profile in lower case, encoded', async () => {
    await fetchMemberProfile('Quiet-Fern')
    expect(call().url).toMatch(/\/members\/profiles\/quiet-fern$/)
  })
})

describe('loadMemberPage', () => {
  it('reads the page as a guest: the server render never sends a token', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response('{"access":"full"}', { status: 200 }),
    )
    const timeout = vi.spyOn(AbortSignal, 'timeout')
    await expect(loadMemberPage('quiet-fern')).resolves.toEqual({
      profile: { access: 'full' },
    })
    expect(call().headers.Authorization).toBeUndefined()
    expect(timeout).toHaveBeenCalledWith(SERVER_RENDER_TIMEOUT_MS)
  })

  it('turns a malformed address into a 404 without asking anyone', async () => {
    const thrown = await loadMemberPage('favicon.ico').catch((e: unknown) => e)
    expect(isNotFound(thrown)).toBe(true)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('turns the server’s 404 into a real 404', async () => {
    fetchMock.mockResolvedValueOnce(new Response('{}', { status: 404 }))
    const thrown = await loadMemberPage('quiet-fern').catch((e: unknown) => e)
    expect(isNotFound(thrown)).toBe(true)
  })

  it('leaves the page to the browser when the server is unreachable', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    await expect(loadMemberPage('quiet-fern')).resolves.toEqual({})
  })
})

describe('fetchPictureObjectUrl', () => {
  it('sends the token and returns an object URL', async () => {
    const createObjectURL = vi.fn(() => 'blob:x')
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL }))
    fetchMock.mockResolvedValueOnce(new Response('w', { status: 200 }))
    await expect(fetchPictureObjectUrl('quiet-fern', 'tok')).resolves.toBe(
      'blob:x',
    )
    expect(call().headers.Authorization).toBe('Bearer tok')
  })

  it('fails when the server refuses', async () => {
    fetchMock.mockResolvedValueOnce(new Response('', { status: 404 }))
    await expect(fetchPictureObjectUrl('x1', 'tok')).rejects.toMatchObject({
      status: 404,
    })
  })
})

describe('owner tools', () => {
  it('changes visibility with PATCH and the token', async () => {
    await changeVisibility('tok', 'unlisted')
    expect(call().url).toMatch(/\/me\/member-page\/visibility$/)
    expect(call().init.method).toBe('PATCH')
    expect(call().init.body).toBe(JSON.stringify({ visibility: 'unlisted' }))
  })

  it('adds a tab with POST', async () => {
    await addBeliefTab('tok', { title: 'T', text: 'x' })
    expect(call().url).toMatch(/\/me\/member-page\/tabs$/)
    expect(call().init.method).toBe('POST')
  })

  it('uploads a picture as a form, without a JSON content type', async () => {
    const picture = new File(['x'], 'a.png', { type: 'image/png' })
    await uploadProfilePicture('tok', picture)
    expect(call().url).toMatch(/\/me\/member-page\/picture$/)
    expect(call().init.method).toBe('PUT')
    expect(call().init.body).toBeInstanceOf(FormData)
    expect(call().headers['Content-Type']).toBeUndefined()
    expect((call().init.body as FormData).get('picture')).toBe(picture)
  })
})
