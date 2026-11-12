// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type * as CommentsApi from '#/lib/comments-api'
import { CommentHistory } from './CommentHistory'

const mocks = vi.hoisted(() => ({
  auth: { isLoading: false, isAuthenticated: false, getToken: vi.fn() },
  fetchCommentHistory: vi.fn(),
}))

vi.mock('#/lib/auth', () => ({ useOrgAuth: () => mocks.auth }))
vi.mock('#/lib/comments-api', async (original) => ({
  ...(await original<typeof CommentsApi>()),
  fetchCommentHistory: mocks.fetchCommentHistory,
}))

const entry = (seq: number) => ({
  seq,
  savedAt: '2026-11-12T08:15:00.000Z',
  text: `Version ${seq}`,
  hash: `${seq}`.repeat(12),
})

const onClose = vi.fn()

beforeEach(() => {
  mocks.auth.isLoading = false
  mocks.auth.isAuthenticated = false
  mocks.auth.getToken.mockReset().mockResolvedValue('tok')
  mocks.fetchCommentHistory.mockReset().mockResolvedValue({
    entries: [entry(2), entry(1)],
    page: 1,
    hasMore: false,
  })
})

afterEach(cleanup)

describe('CommentHistory', () => {
  it('lists versions with server time and hash, as a guest', async () => {
    render(<CommentHistory slug="s" commentId="c1" onClose={onClose} />)
    expect(screen.getByRole('status').textContent).toMatch(/Opening/)
    expect(await screen.findByText('Version 2')).toBeTruthy()
    expect(screen.getAllByText('Nov 12, 2026, 8:15 AM UTC')).toHaveLength(2)
    expect(screen.getByText('222222222222')).toBeTruthy()
    expect(mocks.fetchCommentHistory).toHaveBeenCalledWith('s', 'c1', {
      page: 1,
      token: undefined,
    })
    expect(screen.queryByRole('button', { name: 'Older' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Close history' }))
    expect(onClose).toHaveBeenCalled()
  })

  it('pages with the token when signed in', async () => {
    mocks.auth.isAuthenticated = true
    mocks.fetchCommentHistory.mockResolvedValueOnce({
      entries: [entry(3)],
      page: 1,
      hasMore: true,
    })
    render(<CommentHistory slug="s" commentId="c1" onClose={onClose} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Older' }))
    await screen.findByText('Version 2')
    expect(mocks.fetchCommentHistory).toHaveBeenLastCalledWith('s', 'c1', {
      page: 2,
      token: 'tok',
    })
    fireEvent.click(screen.getByRole('button', { name: 'Newer' }))
    await waitFor(() =>
      expect(mocks.fetchCommentHistory).toHaveBeenLastCalledWith('s', 'c1', {
        page: 1,
        token: 'tok',
      }),
    )
  })

  it('says why it cannot show the history', async () => {
    mocks.fetchCommentHistory.mockRejectedValueOnce(new Error('Gone.'))
    render(<CommentHistory slug="s" commentId="c1" onClose={onClose} />)
    expect((await screen.findByRole('alert')).textContent).toBe('Gone.')
    cleanup()
    mocks.fetchCommentHistory.mockRejectedValueOnce('odd')
    render(<CommentHistory slug="s" commentId="c1" onClose={onClose} />)
    expect((await screen.findByRole('alert')).textContent).toMatch(
      /unavailable/,
    )
  })

  it('refuses to ask without a token when signed in, and waits for the login check', async () => {
    mocks.auth.isAuthenticated = true
    mocks.auth.getToken.mockResolvedValueOnce(null)
    render(<CommentHistory slug="s" commentId="c1" onClose={onClose} />)
    expect((await screen.findByRole('alert')).textContent).toMatch(
      /couldn't confirm/,
    )
    cleanup()
    mocks.auth.isLoading = true
    render(<CommentHistory slug="s" commentId="c1" onClose={onClose} />)
    expect(screen.getByRole('status')).toBeTruthy()
  })

  it('ignores an answer that arrives after it closed', async () => {
    let resolve: (value: unknown) => void = () => undefined
    mocks.fetchCommentHistory.mockReturnValueOnce(
      new Promise((done) => (resolve = done)),
    )
    const { unmount } = render(
      <CommentHistory slug="s" commentId="c1" onClose={onClose} />,
    )
    unmount()
    resolve({ entries: [], page: 1, hasMore: false })
    let reject: (value: unknown) => void = () => undefined
    mocks.fetchCommentHistory.mockReturnValueOnce(
      new Promise((_, fail) => (reject = fail)),
    )
    const second = render(
      <CommentHistory slug="s" commentId="c1" onClose={onClose} />,
    )
    second.unmount()
    reject(new Error('late'))
    await Promise.resolve()
  })
})
