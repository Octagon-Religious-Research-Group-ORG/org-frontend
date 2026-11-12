// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CommentView, ThreadPage } from '#/lib/comments-api'
import { REMOVED_NOTE } from './CommentItem'
import { CommentThread } from './CommentThread'

const mocks = vi.hoisted(() => ({
  auth: { isLoading: false, isAuthenticated: false, getToken: vi.fn() },
  fetchThread: vi.fn(),
  postComment: vi.fn(),
  editComment: vi.fn(),
  removeComment: vi.fn(),
  suggestRewording: vi.fn(),
  acceptSuggestion: vi.fn(),
  declineSuggestion: vi.fn(),
}))

vi.mock('#/lib/auth', () => ({ useOrgAuth: () => mocks.auth }))
vi.mock('#/lib/comments-api', () => ({
  MAX_COMMENT_LENGTH: 10_000,
  fetchThread: mocks.fetchThread,
  postComment: mocks.postComment,
  editComment: mocks.editComment,
  removeComment: mocks.removeComment,
  suggestRewording: mocks.suggestRewording,
  acceptSuggestion: mocks.acceptSuggestion,
  declineSuggestion: mocks.declineSuggestion,
}))
vi.mock('./CommentHistory', () => ({
  CommentHistory: (props: { commentId: string; onClose: () => void }) => (
    <div data-testid="comment-history">
      history of {props.commentId}
      <button type="button" onClick={props.onClose}>
        close stub
      </button>
    </div>
  ),
}))
vi.mock('@tanstack/react-router', async (original) => ({
  ...(await original<object>()),
  Link: ({
    children,
    params,
  }: {
    children: ReactNode
    params: { slug: string }
  }) => <a href={`/${params.slug}`}>{children}</a>,
}))

const comment = (overrides: Partial<CommentView> = {}): CommentView => ({
  commentId: 'cmt_1',
  kind: 'comment',
  source: 'member',
  author: { kind: 'member', displayName: 'Synthetic Member', slug: 'synth' },
  postedAt: '2026-11-12T09:00:00.000Z',
  removed: false,
  body: 'A synthetic comment.',
  edited: false,
  mine: false,
  ...overrides,
})

const page = (overrides: Partial<ThreadPage> = {}): ThreadPage => ({
  comments: [comment()],
  viewerMayComment: false,
  viewerMaySuggest: false,
  ...overrides,
})

const onPageChanged = vi.fn()

function renderThread(props: { tabId?: string; belief?: boolean } = {}) {
  return render(
    <CommentThread
      slug="quiet-fern"
      title="Comments"
      {...(props.tabId ? { tabId: props.tabId } : {})}
      {...(props.belief
        ? { belief: { text: 'The belief now.', textSeq: 3 } }
        : {})}
      onPageChanged={onPageChanged}
    />,
  )
}

beforeEach(() => {
  mocks.auth.isLoading = false
  mocks.auth.isAuthenticated = false
  mocks.auth.getToken.mockReset().mockResolvedValue('tok')
  mocks.fetchThread.mockReset().mockResolvedValue(page())
  for (const write of [
    mocks.postComment,
    mocks.editComment,
    mocks.removeComment,
    mocks.suggestRewording,
    mocks.acceptSuggestion,
    mocks.declineSuggestion,
  ]) {
    write.mockReset().mockResolvedValue({})
  }
  onPageChanged.mockClear()
})

afterEach(cleanup)

// Chunk 9 review round 2: a write's answer is shown in place, unique names.
const many = (from: number, count: number, extra: Partial<CommentView> = {}) =>
  Array.from({ length: count }, (_, i) =>
    comment({
      commentId: `cmt_${from + i}`,
      body: `Comment ${from + i}`,
      ...extra,
    }),
  )

beforeEach(() => {
  mocks.auth.isAuthenticated = true
})

describe('CommentThread, round 2: writes answer in place (item 3)', () => {
  it('shows a new comment at the end of a long thread at once, after one read, and only once', async () => {
    // A thread of 1,100 top-level comments: the reader opened its first page.
    mocks.fetchThread
      .mockResolvedValueOnce(
        page({
          viewerMayComment: true,
          comments: many(0, 20),
          nextAfter: 'p1',
        }),
      )
      // "Load more" later reaches the page that holds the new comment.
      .mockResolvedValueOnce(
        page({
          viewerMayComment: true,
          comments: [
            ...many(20, 19),
            comment({ commentId: 'cmt_new', body: 'Mine, at the end.' }),
          ],
        }),
      )
    mocks.postComment.mockResolvedValueOnce({
      commentId: 'cmt_new',
      seq: 1,
      comment: comment({
        commentId: 'cmt_new',
        body: 'Mine, at the end.',
        mine: true,
        seq: 1,
      }),
    })
    renderThread({ tabId: 't' })
    const box = await screen.findByLabelText<HTMLTextAreaElement>(
      'Comment on this belief',
    )
    fireEvent.change(box, { target: { value: 'Mine, at the end.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Post comment' }))
    const posted = await screen.findByRole('list', {
      name: 'Your new comments, at the end of the thread',
    })
    expect(within(posted).getByText('Mine, at the end.')).toBeTruthy()
    expect(box.value).toBe('')
    expect(mocks.fetchThread).toHaveBeenCalledTimes(1)
    expect(screen.getAllByRole('listitem')).toHaveLength(21)

    fireEvent.click(screen.getByRole('button', { name: 'Load more comments' }))
    await waitFor(() =>
      expect(
        screen.queryByRole('list', {
          name: 'Your new comments, at the end of the thread',
        }),
      ).toBeNull(),
    )
    expect(screen.getAllByText('Mine, at the end.')).toHaveLength(1)
    expect(mocks.fetchThread).toHaveBeenCalledTimes(2)
  })

  it('adds a new comment to the last page when the whole thread is read', async () => {
    mocks.fetchThread.mockResolvedValueOnce(
      page({ viewerMayComment: true, comments: many(0, 2) }),
    )
    mocks.postComment.mockResolvedValueOnce({
      commentId: 'cmt_new',
      seq: 1,
      comment: comment({ commentId: 'cmt_new', body: 'Last one.' }),
    })
    renderThread()
    fireEvent.change(await screen.findByLabelText('Comment on this page'), {
      target: { value: 'Last one.' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Post comment' }))
    expect(await screen.findByText('Last one.')).toBeTruthy()
    expect(
      screen.queryByRole('list', {
        name: 'Your new comments, at the end of the thread',
      }),
    ).toBeNull()
    expect(mocks.fetchThread).toHaveBeenCalledTimes(1)
  })

  it('puts a reply under its comment, an edit and a decision in place, without reading again', async () => {
    mocks.fetchThread.mockResolvedValueOnce(
      page({
        viewerMayComment: true,
        comments: [
          comment({
            commentId: 'root',
            mine: true,
            seq: 1,
            replies: [comment({ commentId: 'old_reply', body: 'Old reply.' })],
          }),
          comment({
            commentId: 'sugg',
            kind: 'suggestion',
            body: '',
            suggestion: {
              proposedText: 'Proposed.',
              baseSeq: 1,
              status: 'pending',
              stale: false,
              canDecide: true,
            },
          }),
        ],
      }),
    )
    mocks.postComment.mockResolvedValueOnce({
      commentId: 'new_reply',
      seq: 1,
      comment: comment({
        commentId: 'new_reply',
        parentCommentId: 'root',
        body: 'New reply.',
      }),
    })
    mocks.editComment.mockResolvedValueOnce({
      changed: true,
      seq: 2,
      comment: comment({
        commentId: 'root',
        body: 'Edited root.',
        mine: true,
        seq: 2,
        edited: true,
        editedAt: '2026-11-12T12:00:00.000Z',
      }),
    })
    mocks.declineSuggestion.mockResolvedValueOnce({
      declined: true,
      comment: comment({
        commentId: 'sugg',
        kind: 'suggestion',
        body: '',
        suggestion: {
          proposedText: 'Proposed.',
          baseSeq: 1,
          status: 'declined',
          decidedAt: '2026-11-12T12:05:00.000Z',
        },
      }),
    })
    renderThread({ tabId: 't', belief: true })
    fireEvent.click(
      await screen.findByRole('button', { name: /^Reply to comment 1,/ }),
    )
    fireEvent.change(screen.getByLabelText('Your reply'), {
      target: { value: 'New reply.' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Post reply' }))
    expect(await screen.findByText('New reply.')).toBeTruthy()

    fireEvent.click(
      screen.getByRole('button', { name: /^Edit your comment, comment 1,/ }),
    )
    fireEvent.change(screen.getByLabelText('Edit your comment'), {
      target: { value: 'Edited root.' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByText('Edited root.')).toBeTruthy()
    // The edit kept both replies under it.
    expect(screen.getByText('Old reply.')).toBeTruthy()
    expect(screen.getByText('New reply.')).toBeTruthy()

    fireEvent.click(
      screen.getByRole('button', { name: /^Decline the suggestion/ }),
    )
    expect(await screen.findByText(/Declined by the page owner/)).toBeTruthy()
    expect(mocks.fetchThread).toHaveBeenCalledTimes(1)
  })

  it('edits, replies to and removes a comment it posted beyond the loaded pages', async () => {
    mocks.fetchThread.mockResolvedValueOnce(
      page({ viewerMayComment: true, comments: many(0, 1), nextAfter: 'p1' }),
    )
    const mine = comment({
      commentId: 'cmt_new',
      body: 'Mine.',
      mine: true,
      seq: 1,
    })
    mocks.postComment
      .mockResolvedValueOnce({ commentId: 'cmt_new', seq: 1, comment: mine })
      .mockResolvedValueOnce({
        commentId: 'r',
        seq: 1,
        comment: comment({
          commentId: 'r',
          parentCommentId: 'cmt_new',
          body: 'Reply to mine.',
        }),
      })
    mocks.removeComment.mockResolvedValueOnce({
      removed: true,
      comment: { ...mine, removed: true, body: undefined, mine: false },
    })
    renderThread()
    fireEvent.change(await screen.findByLabelText('Comment on this page'), {
      target: { value: 'Mine.' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Post comment' }))
    fireEvent.click(
      await screen.findByRole('button', {
        name: /^Reply to your new comment 1,/,
      }),
    )
    fireEvent.change(screen.getByLabelText('Your reply'), {
      target: { value: 'Reply to mine.' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Post reply' }))
    expect(await screen.findByText('Reply to mine.')).toBeTruthy()
    fireEvent.click(
      screen.getByRole('button', {
        name: /^Remove your comment, your new comment 1,/,
      }),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Yes, remove it' }))
    expect(await screen.findByText(REMOVED_NOTE)).toBeTruthy()
    expect(screen.getByText('Reply to mine.')).toBeTruthy()
    expect(mocks.fetchThread).toHaveBeenCalledTimes(1)
  })

  it('ignores a reply whose comment is no longer shown', async () => {
    mocks.fetchThread.mockResolvedValueOnce(
      page({ viewerMayComment: true, comments: many(0, 1) }),
    )
    mocks.postComment.mockResolvedValueOnce({
      commentId: 'x',
      seq: 1,
      comment: comment({
        commentId: 'x',
        parentCommentId: 'somewhere_else',
        body: 'Lost reply.',
      }),
    })
    renderThread()
    fireEvent.click(
      await screen.findByRole('button', { name: /^Reply to comment 1,/ }),
    )
    fireEvent.change(screen.getByLabelText('Your reply'), {
      target: { value: 'Lost reply.' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Post reply' }))
    await waitFor(() => expect(mocks.postComment).toHaveBeenCalled())
    expect(screen.queryByText('Lost reply.')).toBeNull()
  })

  it('shows a suggestion it sent at the end', async () => {
    mocks.fetchThread.mockResolvedValueOnce(
      page({ viewerMayComment: true, viewerMaySuggest: true, comments: [] }),
    )
    mocks.suggestRewording.mockResolvedValueOnce({
      commentId: 's',
      comment: comment({
        commentId: 's',
        kind: 'suggestion',
        body: '',
        mine: true,
        suggestion: {
          proposedText: 'My wording.',
          baseSeq: 3,
          status: 'pending',
        },
      }),
    })
    renderThread({ tabId: 'tab_1', belief: true })
    fireEvent.click(
      await screen.findByRole('button', { name: 'Suggest a rewording' }),
    )
    fireEvent.change(
      screen.getByLabelText('Your wording of the whole belief'),
      {
        target: { value: 'My wording.' },
      },
    )
    fireEvent.click(screen.getByRole('button', { name: 'Send suggestion' }))
    expect(await screen.findByText('My wording.')).toBeTruthy()
    expect(mocks.fetchThread).toHaveBeenCalledTimes(1)
  })
})

describe('CommentThread, round 2: every button has its own name (item 5)', () => {
  it('names buttons apart for the same author at the same minute, replies included', async () => {
    const same = {
      author: { kind: 'imported' as const, name: 'Same Pages Author' },
      postedAt: '2026-11-01T10:00:00.000Z',
    }
    mocks.fetchThread.mockResolvedValueOnce(
      page({
        viewerMayComment: true,
        comments: [
          comment({
            commentId: 'a',
            ...same,
            replies: [
              comment({ commentId: 'a1', ...same, mine: true }),
              comment({ commentId: 'a2', ...same, mine: true }),
            ],
          }),
          comment({ commentId: 'b', ...same, mine: true }),
          comment({ commentId: 'c', author: { kind: 'member' }, mine: true }),
          comment({ commentId: 'd', author: { kind: 'member' }, mine: true }),
        ],
      }),
    )
    renderThread()
    await screen.findAllByRole('button', { name: /^Reply to/ })
    const names = screen
      .getAllByRole('button')
      .map((button) => button.getAttribute('aria-label'))
      .filter((name): name is string => name !== null)
    expect(new Set(names).size).toBe(names.length)
    expect(names).toContain(
      'Edit your comment, reply 2 to comment 1, by Same Pages Author, Nov 1, 2026, 10:00 AM UTC',
    )
  })

  it('says it cannot check the account (item 6)', async () => {
    mocks.fetchThread.mockResolvedValueOnce(
      page({ viewerWriteBlock: 'cannot-check' }),
    )
    renderThread()
    expect(await screen.findByText(/can't check your account/)).toBeTruthy()
  })
})
