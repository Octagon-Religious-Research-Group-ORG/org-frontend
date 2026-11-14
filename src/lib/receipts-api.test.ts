// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { API_BASE_URL, ApiError } from './api'
import {
  downloadReceipt,
  fetchAnchors,
  fetchReceipt,
  fileNameOf,
  receiptPath,
  runAnchorsNow,
} from './receipts-api'

const mocks = vi.hoisted(() => ({ memberRequest: vi.fn() }))
vi.mock('./membership-api', () => ({ memberRequest: mocks.memberRequest }))

beforeEach(() => {
  mocks.memberRequest.mockReset().mockResolvedValue({})
})
afterEach(() => vi.restoreAllMocks())

describe('receipt paths', () => {
  it('names the belief, the comment, or the ORG page comment', () => {
    expect(
      receiptPath({ kind: 'belief', slug: 'Quiet-Fern', tabId: 't/1' }),
    ).toBe('/members/profiles/quiet-fern/tabs/t%2F1/receipt')
    expect(
      receiptPath({ kind: 'belief', slug: 'q', tabId: 't', field: 'title' }),
    ).toBe('/members/profiles/q/tabs/t/receipt?field=title')
    expect(
      receiptPath({ kind: 'belief', slug: 'q', tabId: 't', field: 'text' }),
    ).toBe('/members/profiles/q/tabs/t/receipt')
    expect(receiptPath({ kind: 'comment', slug: 'q', commentId: 'c1' })).toBe(
      '/members/profiles/q/comments/c1/receipt',
    )
    expect(
      receiptPath({ kind: 'org-comment', pageId: 'about', commentId: 'c2' }),
    ).toBe('/members/org-pages/about/comments/c2/receipt')
  })

  it('reads the receipt as a guest or with the token', async () => {
    await fetchReceipt({ kind: 'comment', slug: 'q', commentId: 'c1' })
    expect(mocks.memberRequest).toHaveBeenLastCalledWith(
      '/members/profiles/q/comments/c1/receipt',
      { token: undefined },
    )
    await fetchReceipt({ kind: 'comment', slug: 'q', commentId: 'c1' }, 'tok')
    expect(mocks.memberRequest).toHaveBeenLastCalledWith(
      '/members/profiles/q/comments/c1/receipt',
      { token: 'tok' },
    )
  })

  it('reads and runs the admin anchors', async () => {
    await fetchAnchors('tok')
    expect(mocks.memberRequest).toHaveBeenLastCalledWith('/admin/anchors', {
      token: 'tok',
    })
    await runAnchorsNow('tok')
    expect(mocks.memberRequest).toHaveBeenLastCalledWith('/admin/anchors/run', {
      token: 'tok',
      method: 'POST',
    })
  })

  it('takes the file name the server gave, or a plain one', () => {
    expect(fileNameOf('attachment; filename="receipt-a-1.zip"')).toBe(
      'receipt-a-1.zip',
    )
    expect(fileNameOf(null)).toBe('receipt.zip')
    expect(fileNameOf('inline')).toBe('receipt.zip')
  })
})

describe('downloading a receipt', () => {
  let click: ReturnType<typeof vi.fn<() => void>>
  beforeEach(() => {
    click = vi.fn<() => void>()
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(click)
    URL.createObjectURL = vi.fn(() => 'blob:receipt')
    URL.revokeObjectURL = vi.fn()
  })

  it('saves the zip under its name, with the token, and keeps nothing', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(new Uint8Array([80, 75]), {
        headers: {
          'Content-Disposition':
            'attachment; filename="receipt-q-t-text-2.zip"',
        },
      }),
    )
    const name = await downloadReceipt(
      { kind: 'belief', slug: 'q', tabId: 't', field: 'title' },
      'tok',
    )
    expect(name).toBe('receipt-q-t-text-2.zip')
    expect(fetchMock).toHaveBeenCalledWith(
      `${API_BASE_URL}/members/profiles/q/tabs/t/receipt/download?field=title`,
      { headers: { Authorization: 'Bearer tok' } },
    )
    expect(click).toHaveBeenCalled()
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:receipt')
    expect(document.querySelector('a[download]')).toBeNull()
  })

  it('asks as a guest without a token', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(new Uint8Array([1])))
    await downloadReceipt({ kind: 'comment', slug: 'q', commentId: 'c' })
    expect(fetchMock).toHaveBeenCalledWith(
      `${API_BASE_URL}/members/profiles/q/comments/c/receipt/download`,
      { headers: {} },
    )
  })

  it('says why it was refused, in the server’s words when it has some', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ message: 'That page does not exist.' }), {
        status: 404,
      }),
    )
    await expect(
      downloadReceipt({ kind: 'comment', slug: 'q', commentId: 'c' }),
    ).rejects.toEqual(new ApiError('That page does not exist.', 404))
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('not json', { status: 500 }),
    )
    await expect(
      downloadReceipt({ kind: 'comment', slug: 'q', commentId: 'c' }),
    ).rejects.toThrow('could not be downloaded (status 500)')
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ message: ['a', 'b'] }), { status: 400 }),
    )
    await expect(
      downloadReceipt({ kind: 'comment', slug: 'q', commentId: 'c' }),
    ).rejects.toThrow('status 400')
  })

  it('says so when the server cannot be reached', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new TypeError('net'))
    await expect(
      downloadReceipt({ kind: 'org-comment', pageId: 'about', commentId: 'c' }),
    ).rejects.toThrow("couldn't reach ORG's server")
  })
})
