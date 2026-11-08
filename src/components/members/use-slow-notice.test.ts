// @vitest-environment jsdom

import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SLOW_NOTICE_AFTER_MS, useSlowNotice } from './use-slow-notice'

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('useSlowNotice', () => {
  it('stays quiet at first, speaks up after the delay, and resets when done', () => {
    const { result, rerender } = renderHook(({ busy }) => useSlowNotice(busy), {
      initialProps: { busy: true },
    })
    expect(result.current).toBe(false)
    act(() => {
      vi.advanceTimersByTime(SLOW_NOTICE_AFTER_MS)
    })
    expect(result.current).toBe(true)
    rerender({ busy: false })
    expect(result.current).toBe(false)
  })

  it('does not fire for a request that finished in time', () => {
    const { result, rerender } = renderHook(({ busy }) => useSlowNotice(busy), {
      initialProps: { busy: true },
    })
    rerender({ busy: false })
    act(() => {
      vi.advanceTimersByTime(SLOW_NOTICE_AFTER_MS * 2)
    })
    expect(result.current).toBe(false)
  })
})
