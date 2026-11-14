// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { API_BASE_URL, ApiError } from './api'
import {
  deleteMyPage,
  downloadMyData,
  fetchDeletedPages,
  fetchMyData,
  fetchPurgeDue,
  longDate,
  restoreDeletedPage,
  undoPageDeletion,
} from './member-data-api'

const fetchMock = vi.fn<typeof fetch>()

function json(
  body: unknown,
  status = 200,
  headers: Record<string, string> = {},
) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  })
}

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

function called() {
  const [url, init] = fetchMock.mock.calls[0]
  return {
    url: String(url),
    method: init?.method ?? 'GET',
    body: init?.body,
    auth: new Headers(init?.headers).get('Authorization'),
  }
}

describe('the member data API', () => {
  it('reads and writes only the signed-in account’s routes', async () => {
    fetchMock.mockResolvedValue(json({ page: null, disclosure: [] }))
    await fetchMyData('tok')
    expect(called()).toMatchObject({
      url: `${API_BASE_URL}/me/data`,
      method: 'GET',
      auth: 'Bearer tok',
    })

    fetchMock.mockReset().mockResolvedValue(json({ deleted: true }))
    await deleteMyPage('tok', 'quiet-fern')
    expect(called()).toMatchObject({
      url: `${API_BASE_URL}/me/data/delete-page`,
      method: 'POST',
      body: JSON.stringify({ confirm: 'quiet-fern' }),
    })

    fetchMock.mockReset().mockResolvedValue(json({ deleted: false }))
    await undoPageDeletion('tok')
    expect(called()).toMatchObject({
      url: `${API_BASE_URL}/me/data/undo-delete`,
      method: 'POST',
    })
  })

  it('reads and restores deleted pages for admins', async () => {
    fetchMock.mockResolvedValue(json({ pages: [], hasMore: false }))
    await fetchDeletedPages('tok', 2)
    expect(called().url).toBe(`${API_BASE_URL}/admin/deleted-pages?page=2`)
    fetchMock.mockReset().mockResolvedValue(json({ pages: [] }))
    await fetchPurgeDue('tok')
    expect(called().url).toBe(`${API_BASE_URL}/admin/deleted-pages/purge-due`)
    fetchMock.mockReset().mockResolvedValue(json({ restored: true }))
    await restoreDeletedPage('tok', 'a b', 'Asked.')
    expect(called()).toMatchObject({
      url: `${API_BASE_URL}/admin/deleted-pages/a%20b/restore`,
      method: 'POST',
      body: JSON.stringify({ reason: 'Asked.' }),
    })
  })

  it('writes dates in words, in UTC', () => {
    expect(longDate('2026-12-14T23:30:00Z')).toBe('14 December 2026')
  })
})

describe('downloadMyData', () => {
  it('saves the zip under the server’s name and frees it afterwards', async () => {
    vi.useFakeTimers()
    const create = vi.fn(() => 'blob:fake')
    const revoke = vi.fn()
    vi.stubGlobal('URL', { createObjectURL: create, revokeObjectURL: revoke })
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined)
    fetchMock.mockResolvedValue(
      new Response(new Blob(['zip']), {
        headers: {
          'Content-Disposition':
            'attachment; filename="org-my-data-2026-11-14.zip"',
        },
      }),
    )
    await expect(downloadMyData('tok')).resolves.toBe(
      'org-my-data-2026-11-14.zip',
    )
    expect(called()).toMatchObject({
      url: `${API_BASE_URL}/me/data/export`,
      auth: 'Bearer tok',
    })
    expect(click).toHaveBeenCalled()
    expect(document.querySelector('a[download]')).toBeNull()
    vi.advanceTimersByTime(10_000)
    expect(revoke).toHaveBeenCalledWith('blob:fake')
    click.mockRestore()
  })

  it('names the file plainly when the server gives no name', async () => {
    vi.stubGlobal('URL', {
      createObjectURL: () => 'blob:x',
      revokeObjectURL: () => undefined,
    })
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined)
    fetchMock.mockResolvedValue(new Response(new Blob(['zip'])))
    await expect(downloadMyData('tok')).resolves.toBe('org-my-data.zip')
    click.mockRestore()
  })

  it('says why it was refused, in the server’s words or by status', async () => {
    fetchMock.mockResolvedValue(
      json(
        {
          message:
            'You have downloaded your data the most times allowed today.',
        },
        429,
      ),
    )
    await expect(downloadMyData('tok')).rejects.toMatchObject({
      message: 'You have downloaded your data the most times allowed today.',
      status: 429,
    })
    fetchMock.mockResolvedValue(json({ message: 42 }, 403))
    await expect(downloadMyData('tok')).rejects.toMatchObject({
      message: 'Your data could not be downloaded (status 403).',
    })
    fetchMock.mockResolvedValue(new Response('not json', { status: 500 }))
    await expect(downloadMyData('tok')).rejects.toMatchObject({ status: 500 })
  })

  it('says so when the server cannot be reached', async () => {
    fetchMock.mockRejectedValue(new TypeError('offline'))
    const error = await downloadMyData('tok').catch((err: unknown) => err)
    expect(error).toBeInstanceOf(ApiError)
    expect((error as ApiError).status).toBe(0)
  })
})
