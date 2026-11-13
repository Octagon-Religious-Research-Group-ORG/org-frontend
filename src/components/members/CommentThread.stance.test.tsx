// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CommentView, ThreadPage } from '#/lib/comments-api'
import { CommentThread, WRITE_BLOCK_NOTES } from './CommentThread'

const mocks = vi.hoisted(() => ({
  auth: { isLoading: false, isAuthenticated: true, getToken: vi.fn() },
  fetchThread: vi.fn(),
  postComment: vi.fn(),
}))

vi.mock('#/lib/auth', () => ({ useOrgAuth: () => mocks.auth }))
vi.mock('#/lib/comments-api', async (original) => ({
  ...(await original<object>()),
  fetchThread: mocks.fetchThread,
  postComment: mocks.postComment,
}))
vi.mock('@tanstack/react-router', async (original) => ({
  ...(await original<object>()),
  Link: ({ children }: { children: ReactNode }) => <a href="/x">{children}</a>,
}))

const comment = (overrides: Partial<CommentView> = {}): CommentView => ({
  commentId: 'cmt_1',
  kind: 'comment',
  source: 'member',
  author: { kind: 'member', displayName: 'Synthetic Member' },
  postedAt: '2026-11-12T09:00:00.000Z',
  removed: false,
  body: 'A synthetic comment.',
  edited: false,
  mine: false,
  ...overrides,
})

const page = (overrides: Partial<ThreadPage> = {}): ThreadPage => ({
  comments: [comment({ stance: 'disagree' })],
  viewerMayComment: true,
  viewerMaySuggest: false,
  ...overrides,
})

const onAccess = vi.fn()

function renderThread(compose?: {
  stance?: 'agree' | 'disagree'
  nonce: number
}) {
  return render(
    <CommentThread
      slug="quiet-fern"
      title="Comments"
      tabId="tab_1"
      onPageChanged={vi.fn()}
      onAccess={onAccess}
      {...(compose ? { compose } : {})}
    />,
  )
}

beforeEach(() => {
  mocks.auth.getToken.mockReset().mockResolvedValue('tok')
  mocks.fetchThread.mockReset().mockResolvedValue(page())
  mocks.postComment.mockReset().mockResolvedValue({
    commentId: 'cmt_new',
    seq: 1,
    comment: comment({ commentId: 'cmt_new', stance: 'agree', body: 'Mine.' }),
  })
  onAccess.mockClear()
})

afterEach(cleanup)

describe('CommentThread stance badges (Chunk 10)', () => {
  it('shows a comment’s stance badge, and tells the vote buttons the reader may comment', async () => {
    renderThread()
    expect(await screen.findByText('Disagrees')).toBeTruthy()
    await waitFor(() =>
      expect(onAccess).toHaveBeenCalledWith({ mayComment: true }),
    )
  })

  it('tells the vote buttons why the reader may not comment', async () => {
    mocks.fetchThread.mockResolvedValueOnce(
      page({ viewerMayComment: false, viewerWriteBlock: 'verify-email' }),
    )
    renderThread()
    await waitFor(() =>
      expect(onAccess).toHaveBeenCalledWith({
        mayComment: false,
        reason: WRITE_BLOCK_NOTES['verify-email'],
      }),
    )
    cleanup()
    mocks.fetchThread.mockResolvedValueOnce(page({ viewerMayComment: false }))
    renderThread()
    await waitFor(() =>
      expect(onAccess).toHaveBeenLastCalledWith({
        mayComment: false,
        reason: WRITE_BLOCK_NOTES['sign-in'],
      }),
    )
  })

  it('"…and comment" focuses the form and posts with the stance once', async () => {
    const { rerender } = renderThread()
    const box = await screen.findByRole('textbox', {
      name: 'Comment on this belief',
    })
    rerender(
      <CommentThread
        slug="quiet-fern"
        title="Comments"
        tabId="tab_1"
        onPageChanged={vi.fn()}
        onAccess={onAccess}
        compose={{ stance: 'agree', nonce: 1 }}
      />,
    )
    await waitFor(() => expect(document.activeElement).toBe(box))
    expect(screen.getByText(/will show “Agrees”/)).toBeTruthy()
    fireEvent.change(box, { target: { value: 'Why I agree.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Post comment' }))
    await waitFor(() => expect(mocks.postComment).toHaveBeenCalled())
    expect(mocks.postComment.mock.calls[0][1]).toEqual({
      slug: 'quiet-fern',
      body: 'Why I agree.',
      tabId: 'tab_1',
      stance: 'agree',
    })
    // The badge is for that one comment.
    await waitFor(() => expect(screen.queryByText(/will show/)).toBeNull())
  })

  it('follows a changed stance without a new request (fix round 1, LOW 5)', async () => {
    const { rerender } = renderThread({ stance: 'agree', nonce: 1 })
    await screen.findByText(/will show “Agrees”/)
    const props = {
      slug: 'quiet-fern',
      title: 'Comments',
      tabId: 'tab_1',
      onPageChanged: vi.fn(),
      onAccess,
    }
    rerender(
      <CommentThread {...props} compose={{ stance: 'disagree', nonce: 1 }} />,
    )
    expect(await screen.findByText(/will show “Disagrees”/)).toBeTruthy()
    rerender(<CommentThread {...props} compose={{ nonce: 1 }} />)
    await waitFor(() => expect(screen.queryByText(/will show/)).toBeNull())
  })

  it('can drop the badge before posting', async () => {
    renderThread({ stance: 'disagree', nonce: 1 })
    await screen.findByText(/will show “Disagrees”/)
    fireEvent.click(
      screen.getByRole('button', { name: 'Post it without the badge' }),
    )
    expect(screen.queryByText(/will show/)).toBeNull()
    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'Plain.' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Post comment' }))
    await waitFor(() => expect(mocks.postComment).toHaveBeenCalled())
    expect(mocks.postComment.mock.calls[0][1]).not.toHaveProperty('stance')
  })

  it('keeps the badge when the post is refused', async () => {
    mocks.postComment.mockRejectedValueOnce(new Error('Cast your vote first.'))
    renderThread({ stance: 'agree', nonce: 1 })
    fireEvent.change(await screen.findByRole('textbox'), {
      target: { value: 'Why.' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Post comment' }))
    expect(await screen.findByText('Cast your vote first.')).toBeTruthy()
    expect(screen.getByText(/will show “Agrees”/)).toBeTruthy()
  })
})
