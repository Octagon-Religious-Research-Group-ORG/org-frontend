// @vitest-environment jsdom

import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '#/lib/api'
import { useAdminAction } from './admin-shared'

const mocks = vi.hoisted(() => ({
  auth: {
    isLoading: false,
    isAuthenticated: true,
    user: { sub: 'user_admin' },
    getToken: vi.fn<() => Promise<string | undefined>>(),
  },
}))

vi.mock('#/lib/auth', () => ({ useOrgAuth: () => mocks.auth }))

beforeEach(() => {
  mocks.auth.getToken.mockReset().mockResolvedValue('tok')
})
afterEach(cleanup)

describe('useAdminAction', () => {
  it('never runs the success callback when the write fails (round 7, MEDIUM 1)', async () => {
    const { result } = renderHook(() => useAdminAction())
    for (const status of [409, 500]) {
      const after = vi.fn()
      await act(() =>
        result.current.run(
          () => Promise.reject(new ApiError('Synthetic failure', status)),
          after,
        ),
      )
      // No refresh passed: the default re-reads nothing and claims nothing.
      expect(after).not.toHaveBeenCalled()
      expect(result.current.error).toBe('Synthetic failure')
    }
  })

  it('re-reads only through the refresh it was given, on a 409 or 500', async () => {
    const { result } = renderHook(() => useAdminAction())
    const after = vi.fn()
    const refresh = vi.fn()
    await act(() =>
      result.current.run(
        () => Promise.reject(new ApiError('Gap', 500)),
        after,
        refresh,
      ),
    )
    await act(() =>
      result.current.run(
        () => Promise.reject(new ApiError('Bad request', 400)),
        after,
        refresh,
      ),
    )
    expect(refresh).toHaveBeenCalledTimes(1)
    expect(after).not.toHaveBeenCalled()
    await act(() =>
      result.current.run(() => Promise.resolve({}), after, refresh),
    )
    expect(after).toHaveBeenCalledTimes(1)
    expect(refresh).toHaveBeenCalledTimes(1)
    expect(result.current.error).toBeUndefined()
  })
})
