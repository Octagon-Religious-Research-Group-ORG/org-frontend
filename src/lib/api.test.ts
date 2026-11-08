import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError, apiRequest, humanStatus, money } from './api'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('shop API formatting', () => {
  it('formats cents as U.S. currency', () => {
    expect(money(1500)).toBe('$15.00')
  })

  it('turns order states into readable labels', () => {
    expect(humanStatus('donation_confirmed')).toBe('donation confirmed')
  })
})

describe('apiRequest', () => {
  it('adds a time limit only when asked', async () => {
    const fetchMock = vi
      .fn()
      .mockImplementation(() =>
        Promise.resolve(new Response(JSON.stringify({ ok: true }))),
      )
    vi.stubGlobal('fetch', fetchMock)
    await apiRequest('/plain')
    await apiRequest('/limited', { timeoutMs: 5000 })
    const init = (index: number) =>
      (fetchMock.mock.calls[index] as [string, RequestInit])[1]
    expect(init(0).signal).toBeUndefined()
    expect(init(1).signal).toBeInstanceOf(AbortSignal)
    expect(init(1)).not.toHaveProperty('timeoutMs')
  })

  it('uses the fallback API URL and preserves caller headers', async () => {
    vi.stubEnv('VITE_API_BASE_URL', '')
    vi.resetModules()
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ ok: true })))
    vi.stubGlobal('fetch', fetchMock)
    const { apiRequest: requestWithFallback } = await import('./api')

    await expect(
      requestWithFallback('/resource', {
        method: 'POST',
        body: '{}',
        token: 'member-token',
        guestToken: 'guest-token',
        headers: { 'Content-Type': 'application/problem+json', 'X-Test': '1' },
      }),
    ).resolves.toEqual({ ok: true })
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3001/api/v1/resource',
      expect.objectContaining({
        method: 'POST',
        headers: {
          'Content-Type': 'application/problem+json',
          Authorization: 'Bearer member-token',
          'X-Cart-Token': 'guest-token',
          'X-Test': '1',
        },
      }),
    )
  })

  it('omits optional headers and returns no content responses', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(apiRequest('/empty')).resolves.toBeUndefined()
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ headers: {} })
  })

  it.each([
    [{ message: ['First.', 'Second.'] }, 'First. Second.'],
    [{ message: 'Specific failure.' }, 'Specific failure.'],
    [{}, 'Request failed with status 400.'],
  ])('uses API error payloads when available', async (payload, message) => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify(payload), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    )

    const error = await apiRequest('/failure').catch((cause: unknown) => cause)

    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ message, status: 400 })
  })

  it('keeps the status message when an error response is not JSON', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('not-json', { status: 503 })),
    )

    await expect(apiRequest('/failure')).rejects.toMatchObject({
      message: 'Request failed with status 503.',
      status: 503,
    })
  })
})
