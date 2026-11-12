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
import { CommentThread, WRITE_HINT } from './CommentThread'

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

describe('CommentThread, read only', () => {
  it('shows an imported thread to a guest: name, Pages date, quote, replies, no form', async () => {
    mocks.fetchThread.mockResolvedValueOnce(
      page({
        comments: [
          comment({
            source: 'imported',
            author: { kind: 'imported', name: 'Pages Author' },
            importedDate: '2020-05-06T00:00:00.000Z',
            anchorText: 'the highlighted words',
            replies: [
              comment({
                commentId: 'cmt_2',
                source: 'imported',
                author: { kind: 'imported', name: 'Second Author' },
                body: 'A synthetic reply.',
              }),
            ],
          }),
        ],
      }),
    )
    renderThread({ tabId: 'tab_1' })
    expect(screen.getByRole('status').textContent).toMatch(/Opening/)
    expect(await screen.findByText('A synthetic comment.')).toBeTruthy()
    expect(mocks.fetchThread).toHaveBeenCalledWith('quiet-fern', {
      tabId: 'tab_1',
      after: undefined,
      token: undefined,
    })
    expect(screen.getByText('Pages Author')).toBeTruthy()
    expect(
      screen.getByText(/Pages showed May 6, 2020, which is not proof/),
    ).toBeTruthy()
    expect(screen.getByText('“the highlighted words”')).toBeTruthy()
    expect(screen.getByText('A synthetic reply.')).toBeTruthy()
    expect(screen.getAllByText(/Imported from Apple Pages/)).toHaveLength(2)
    expect(screen.queryByRole('button', { name: /^Reply to / })).toBeNull()
    expect(screen.queryByRole('textbox')).toBeNull()
    expect(screen.getByText(WRITE_HINT)).toBeTruthy()
  })

  it('says when there are no comments yet', async () => {
    mocks.fetchThread.mockResolvedValueOnce(page({ comments: [] }))
    renderThread()
    expect(await screen.findByText('No comments yet.')).toBeTruthy()
  })

  it('loads more, oldest first, appending', async () => {
    mocks.fetchThread
      .mockResolvedValueOnce(page({ nextAfter: 'cmt_1' }))
      .mockResolvedValueOnce(
        page({ comments: [comment({ commentId: 'cmt_3', body: 'Later.' })] }),
      )
    renderThread({ tabId: 't' })
    fireEvent.click(
      await screen.findByRole('button', { name: 'Load more comments' }),
    )
    expect(await screen.findByText('Later.')).toBeTruthy()
    expect(screen.getByText('A synthetic comment.')).toBeTruthy()
    expect(mocks.fetchThread).toHaveBeenLastCalledWith('quiet-fern', {
      tabId: 't',
      after: 'cmt_1',
      token: undefined,
    })
    expect(
      screen.queryByRole('button', { name: 'Load more comments' }),
    ).toBeNull()
  })

  it('shows a removed comment as a note, its replies kept', async () => {
    mocks.fetchThread.mockResolvedValueOnce(
      page({
        viewerMayComment: true,
        comments: [
          comment({
            removed: true,
            body: undefined,
            mine: false,
            replies: [comment({ commentId: 'r', body: 'Still here.' })],
          }),
        ],
      }),
    )
    renderThread()
    expect(await screen.findByText(REMOVED_NOTE)).toBeTruthy()
    expect(screen.getByText('Still here.')).toBeTruthy()
    // Neither the removed one nor a reply offers "Reply".
    expect(screen.queryByRole('button', { name: /^Reply to / })).toBeNull()
  })

  it('says why it cannot load', async () => {
    mocks.fetchThread.mockRejectedValueOnce(new Error('No such page.'))
    renderThread()
    expect((await screen.findByRole('alert')).textContent).toBe('No such page.')
    cleanup()
    mocks.fetchThread.mockRejectedValueOnce('odd')
    renderThread()
    expect((await screen.findByRole('alert')).textContent).toMatch(
      /unavailable/,
    )
    cleanup()
    mocks.auth.isAuthenticated = true
    mocks.auth.getToken.mockResolvedValueOnce(null)
    renderThread()
    expect((await screen.findByRole('alert')).textContent).toMatch(
      /couldn't confirm/,
    )
    cleanup()
    mocks.auth.isLoading = true
    renderThread()
    expect(screen.getByRole('status')).toBeTruthy()
  })

  it('ignores answers that arrive after it closed', async () => {
    let resolve: (value: unknown) => void = () => undefined
    mocks.fetchThread.mockReturnValueOnce(
      new Promise((done) => (resolve = done)),
    )
    renderThread().unmount()
    resolve(page())
    let reject: (value: unknown) => void = () => undefined
    mocks.fetchThread.mockReturnValueOnce(
      new Promise((_, fail) => (reject = fail)),
    )
    renderThread().unmount()
    reject(new Error('late'))
    await Promise.resolve()
  })
})

describe('CommentThread, writing', () => {
  beforeEach(() => {
    mocks.auth.isAuthenticated = true
  })

  it('posts on a belief, sending the token, then reloads', async () => {
    mocks.fetchThread.mockResolvedValue(page({ viewerMayComment: true }))
    renderThread({ tabId: 'tab_1' })
    fireEvent.change(await screen.findByLabelText('Comment on this belief'), {
      target: { value: ' New words. ' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Post comment' }))
    await waitFor(() =>
      expect(mocks.postComment).toHaveBeenCalledWith('tok', {
        slug: 'quiet-fern',
        body: 'New words.',
        tabId: 'tab_1',
      }),
    )
    await waitFor(() => expect(mocks.fetchThread).toHaveBeenCalledTimes(2))
    expect(screen.queryByText(WRITE_HINT)).toBeNull()
  })

  it('posts on the page itself, and shows a refusal', async () => {
    mocks.fetchThread.mockResolvedValue(page({ viewerMayComment: true }))
    mocks.postComment.mockRejectedValueOnce(
      new Error('Please confirm your email.'),
    )
    renderThread()
    fireEvent.change(await screen.findByLabelText('Comment on this page'), {
      target: { value: 'About the page.' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Post comment' }))
    expect((await screen.findByRole('alert')).textContent).toBe(
      'Please confirm your email.',
    )
    expect(mocks.postComment).toHaveBeenCalledWith('tok', {
      slug: 'quiet-fern',
      body: 'About the page.',
    })
    expect(
      screen.getByLabelText<HTMLTextAreaElement>('Comment on this page').value,
    ).toBe('About the page.')
  })

  it('replies to a top-level comment only', async () => {
    mocks.fetchThread.mockResolvedValue(
      page({
        viewerMayComment: true,
        comments: [comment({ replies: [comment({ commentId: 'r1' })] })],
      }),
    )
    renderThread({ tabId: 't' })
    const replies = await screen.findAllByRole('button', { name: /^Reply to / })
    expect(replies).toHaveLength(1)
    fireEvent.click(replies[0])
    fireEvent.click(screen.getByRole('button', { name: /^Reply to / }))
    expect(screen.queryByLabelText('Your reply')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /^Reply to / }))
    fireEvent.change(screen.getByLabelText('Your reply'), {
      target: { value: 'Answer.' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Post reply' }))
    await waitFor(() =>
      expect(mocks.postComment).toHaveBeenCalledWith('tok', {
        slug: 'quiet-fern',
        parentCommentId: 'cmt_1',
        body: 'Answer.',
      }),
    )
    await waitFor(() =>
      expect(screen.queryByLabelText('Your reply')).toBeNull(),
    )
  })

  it('cancels a reply, and keeps it open when posting failed', async () => {
    mocks.fetchThread.mockResolvedValue(page({ viewerMayComment: true }))
    mocks.postComment.mockRejectedValueOnce(new Error('Removed meanwhile.'))
    renderThread()
    fireEvent.click(await screen.findByRole('button', { name: /^Reply to / }))
    fireEvent.change(screen.getByLabelText('Your reply'), {
      target: { value: 'Answer.' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Post reply' }))
    expect((await screen.findByRole('alert')).textContent).toBe(
      'Removed meanwhile.',
    )
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByLabelText('Your reply')).toBeNull()
  })

  it('edits and removes the reader’s own comment', async () => {
    mocks.fetchThread.mockResolvedValue(
      page({ comments: [comment({ mine: true, seq: 2 })] }),
    )
    renderThread()
    fireEvent.click(
      await screen.findByRole('button', { name: /^Edit your comment/ }),
    )
    const box = screen.getByLabelText<HTMLTextAreaElement>('Edit your comment')
    expect(box.value).toBe('A synthetic comment.')
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    fireEvent.click(screen.getByRole('button', { name: /^Edit your comment/ }))
    fireEvent.change(screen.getByLabelText('Edit your comment'), {
      target: { value: 'Better words.' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() =>
      expect(mocks.editComment).toHaveBeenCalledWith(
        'tok',
        'cmt_1',
        'Better words.',
        2,
      ),
    )
    fireEvent.click(
      await screen.findByRole('button', { name: /^Remove your comment/ }),
    )
    const confirm = screen.getByRole('group', { name: /^Confirm removal/ })
    expect(confirm.textContent).toMatch(/five years/)
    fireEvent.click(within(confirm).getByRole('button', { name: 'Keep it' }))
    expect(screen.queryByRole('group', { name: /^Confirm removal/ })).toBeNull()
    fireEvent.click(
      screen.getByRole('button', { name: /^Remove your comment/ }),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Yes, remove it' }))
    await waitFor(() =>
      expect(mocks.removeComment).toHaveBeenCalledWith('tok', 'cmt_1'),
    )
  })

  it('edits on version 1 when the server gave none, and keeps the form on a refusal', async () => {
    mocks.fetchThread.mockResolvedValue(
      page({ comments: [comment({ mine: true })] }),
    )
    mocks.editComment.mockRejectedValueOnce(
      new Error('Changed in another window.'),
    )
    renderThread()
    fireEvent.click(
      await screen.findByRole('button', { name: /^Edit your comment/ }),
    )
    fireEvent.change(screen.getByLabelText('Edit your comment'), {
      target: { value: 'x' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect((await screen.findByRole('alert')).textContent).toBe(
      'Changed in another window.',
    )
    expect(mocks.editComment).toHaveBeenCalledWith('tok', 'cmt_1', 'x', 1)
    expect(screen.getByLabelText('Edit your comment')).toBeTruthy()
  })

  it('shows "edited" and opens its history', async () => {
    mocks.fetchThread.mockResolvedValue(
      page({
        comments: [
          comment({ edited: true, editedAt: '2026-11-12T10:30:00.000Z' }),
        ],
      }),
    )
    renderThread()
    expect(
      await screen.findByText('edited Nov 12, 2026, 10:30 AM UTC'),
    ).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /^Edit history/ }))
    expect(screen.getByTestId('comment-history').textContent).toMatch(/cmt_1/)
    fireEvent.click(screen.getByRole('button', { name: /^Edit history/ }))
    expect(screen.queryByTestId('comment-history')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /^Edit history/ }))
    fireEvent.click(screen.getByRole('button', { name: 'close stub' }))
    expect(screen.queryByTestId('comment-history')).toBeNull()
  })
})

describe('CommentThread, suggestions', () => {
  beforeEach(() => {
    mocks.auth.isAuthenticated = true
  })

  const suggestion = (
    overrides: Partial<NonNullable<CommentView['suggestion']>> = {},
    comment_: Partial<CommentView> = {},
  ) =>
    comment({
      kind: 'suggestion',
      body: 'Clearer, I think.',
      suggestion: {
        proposedText: 'The belief, reworded.',
        baseSeq: 3,
        status: 'pending',
        stale: false,
        canDecide: true,
        ...overrides,
      },
      ...comment_,
    })

  it('sends a suggestion on the version the page showed', async () => {
    mocks.fetchThread.mockResolvedValue(
      page({ viewerMayComment: true, viewerMaySuggest: true, comments: [] }),
    )
    renderThread({ tabId: 'tab_1', belief: true })
    const open = await screen.findByRole('button', {
      name: 'Suggest a rewording',
    })
    fireEvent.click(open)
    fireEvent.click(open)
    expect(
      screen.queryByLabelText('Your wording of the whole belief'),
    ).toBeNull()
    fireEvent.click(open)
    const box = screen.getByLabelText<HTMLTextAreaElement>(
      'Your wording of the whole belief',
    )
    expect(box.value).toBe('The belief now.')
    expect(screen.getByText(/15 \/ 20,000 characters/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    fireEvent.click(open)
    fireEvent.change(
      screen.getByLabelText('Your wording of the whole belief'),
      {
        target: { value: 'The belief, clearer.' },
      },
    )
    mocks.suggestRewording.mockRejectedValueOnce(
      new Error('The belief changed since you opened it.'),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Send suggestion' }))
    expect((await screen.findByRole('alert')).textContent).toMatch(/changed/)
    fireEvent.click(screen.getByRole('button', { name: 'Send suggestion' }))
    await waitFor(() =>
      expect(mocks.suggestRewording).toHaveBeenLastCalledWith('tok', {
        slug: 'quiet-fern',
        tabId: 'tab_1',
        text: 'The belief, clearer.',
        baseSeq: 3,
      }),
    )
    await waitFor(() =>
      expect(
        screen.queryByLabelText('Your wording of the whole belief'),
      ).toBeNull(),
    )
  })

  it('offers no suggestion on the page thread or to the owner', async () => {
    mocks.fetchThread.mockResolvedValue(
      page({ viewerMayComment: true, viewerMaySuggest: true }),
    )
    renderThread()
    await screen.findByText('A synthetic comment.')
    expect(
      screen.queryByRole('button', { name: 'Suggest a rewording' }),
    ).toBeNull()
  })

  it('lets the owner compare and accept, then reloads the page', async () => {
    mocks.fetchThread.mockResolvedValue(page({ comments: [suggestion()] }))
    renderThread({ tabId: 'tab_1', belief: true })
    expect(await screen.findByText('The belief, reworded.')).toBeTruthy()
    expect(screen.getByText('The belief now.')).toBeTruthy()
    expect(screen.getByText(/Waiting for the page owner/)).toBeTruthy()
    // The owner edits instead: the server says no suggestion form here.
    expect(
      screen.queryByRole('button', { name: 'Suggest a rewording' }),
    ).toBeNull()
    fireEvent.click(
      screen.getByRole('button', { name: /^Accept the suggestion/ }),
    )
    await waitFor(() => expect(onPageChanged).toHaveBeenCalled())
    expect(mocks.acceptSuggestion).toHaveBeenCalledWith('tok', 'cmt_1')
    await waitFor(() => expect(mocks.fetchThread).toHaveBeenCalledTimes(2))
  })

  it('declines without reloading the page, and shows a refused accept', async () => {
    mocks.fetchThread.mockResolvedValue(page({ comments: [suggestion()] }))
    mocks.acceptSuggestion.mockRejectedValueOnce(
      new Error('The belief changed since this suggestion was written.'),
    )
    renderThread({ tabId: 'tab_1', belief: true })
    fireEvent.click(
      await screen.findByRole('button', { name: /^Accept the suggestion/ }),
    )
    expect((await screen.findByRole('alert')).textContent).toMatch(/changed/)
    expect(onPageChanged).not.toHaveBeenCalled()
    fireEvent.click(
      screen.getByRole('button', { name: /^Decline the suggestion/ }),
    )
    await waitFor(() =>
      expect(mocks.declineSuggestion).toHaveBeenCalledWith('tok', 'cmt_1'),
    )
    expect(onPageChanged).not.toHaveBeenCalled()
  })

  it('offers only "Decline" on a stale suggestion', async () => {
    mocks.fetchThread.mockResolvedValue(
      page({ comments: [suggestion({ stale: true })] }),
    )
    renderThread({ tabId: 'tab_1', belief: true })
    expect(await screen.findByText(/can only be declined now/)).toBeTruthy()
    expect(
      screen.queryByRole('button', { name: /^Accept the suggestion/ }),
    ).toBeNull()
    expect(
      screen.getByRole('button', { name: /^Decline the suggestion/ }),
    ).toBeTruthy()
  })

  it('shows a decided suggestion with its outcome, and lets its author withdraw only a pending one', async () => {
    mocks.fetchThread.mockResolvedValue(
      page({
        comments: [
          suggestion(
            {
              status: 'accepted',
              decidedAt: '2026-11-12T11:00:00.000Z',
              stale: undefined,
              canDecide: undefined,
            },
            { mine: true, body: '' },
          ),
          suggestion({ canDecide: false }, { commentId: 'cmt_2', mine: true }),
        ],
      }),
    )
    renderThread({ tabId: 'tab_1', belief: true })
    expect(
      await screen.findByText(
        /Accepted by the page owner · Nov 12, 2026, 11:00 AM UTC/,
      ),
    ).toBeTruthy()
    expect(
      screen.getAllByRole('button', { name: /^Withdraw your suggestion/ }),
    ).toHaveLength(1)
    expect(
      screen.queryByRole('button', { name: /^Edit your comment/ }),
    ).toBeNull()
    expect(screen.queryByText('The belief now.')).toBeNull()
  })

  it('shows no proposed text once the suggestion was withdrawn, nor the current text on the page thread', async () => {
    mocks.fetchThread.mockResolvedValue(
      page({
        comments: [
          suggestion(
            { proposedText: undefined, canDecide: undefined, stale: undefined },
            { removed: true, body: undefined },
          ),
          suggestion({}, { commentId: 'cmt_3' }),
        ],
      }),
    )
    renderThread()
    expect(await screen.findByText(REMOVED_NOTE)).toBeTruthy()
    expect(screen.getAllByText('Proposed')).toHaveLength(1)
    expect(screen.queryByText('Now')).toBeNull()
  })
})

describe('CommentThread, review round', () => {
  beforeEach(() => {
    mocks.auth.isAuthenticated = true
  })

  const many = (from: number, count: number) =>
    Array.from({ length: count }, (_, i) =>
      comment({ commentId: `cmt_${from + i}`, body: `Comment ${from + i}` }),
    )

  it('says why a reader may not write, in their own situation (item 9)', async () => {
    for (const [block, words] of [
      ['verify-email', /confirm your email address/],
      ['needs-approved-page', /once your member page has been approved/],
      ['sign-in', /Sign in, or finish joining/],
    ] as const) {
      mocks.fetchThread.mockResolvedValueOnce(page({ viewerWriteBlock: block }))
      renderThread()
      expect(await screen.findByText(words)).toBeTruthy()
      expect(screen.queryByRole('textbox')).toBeNull()
      cleanup()
    }
    // An older server says nothing: the general hint.
    mocks.fetchThread.mockResolvedValueOnce(page())
    renderThread()
    expect(await screen.findByText(WRITE_HINT)).toBeTruthy()
  })

  it('keeps the loaded pages after an edit, reading them again in place (item 7)', async () => {
    mocks.fetchThread
      .mockResolvedValueOnce(page({ comments: many(0, 2), nextAfter: 'cmt_1' }))
      .mockResolvedValueOnce(
        page({
          comments: [comment({ commentId: 'cmt_2', mine: true, seq: 1 })],
          nextAfter: 'cmt_2',
        }),
      )
      // The refresh: both pages again, the edited one changed.
      .mockResolvedValueOnce(page({ comments: many(0, 2), nextAfter: 'cmt_1' }))
      .mockResolvedValueOnce(
        page({
          comments: [comment({ commentId: 'cmt_2', body: 'Edited in place.' })],
          nextAfter: 'cmt_2',
        }),
      )
    renderThread({ tabId: 't' })
    fireEvent.click(
      await screen.findByRole('button', { name: 'Load more comments' }),
    )
    fireEvent.click(
      await screen.findByRole('button', { name: /^Edit your comment/ }),
    )
    fireEvent.change(screen.getByLabelText('Edit your comment'), {
      target: { value: 'Edited in place.' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByText('Edited in place.')).toBeTruthy()
    expect(screen.getByText('Comment 0')).toBeTruthy()
    expect(mocks.fetchThread).toHaveBeenCalledTimes(4)
    expect(mocks.fetchThread.mock.calls[3][1]).toMatchObject({ after: 'cmt_1' })
  })

  it('ignores an older load that finishes after a newer one', async () => {
    let first: (value: unknown) => void = () => undefined
    mocks.fetchThread
      .mockReturnValueOnce(new Promise((done) => (first = done)))
      .mockResolvedValueOnce(page({ comments: many(9, 1) }))
    const view = renderThread()
    view.rerender(
      <CommentThread
        slug="quiet-fern"
        title="Comments"
        tabId="other"
        onPageChanged={onPageChanged}
      />,
    )
    expect(await screen.findByText('Comment 9')).toBeTruthy()
    first(page({ comments: many(0, 1) }))
    await Promise.resolve()
    expect(screen.queryByText('Comment 0')).toBeNull()
  })

  it('ignores an older failure that arrives after a newer load', async () => {
    let fail: (value: unknown) => void = () => undefined
    mocks.fetchThread
      .mockReturnValueOnce(new Promise((_, reject) => (fail = reject)))
      .mockResolvedValueOnce(page({ comments: many(5, 1) }))
    const view = renderThread()
    view.rerender(
      <CommentThread
        slug="quiet-fern"
        title="Comments"
        tabId="other"
        onPageChanged={onPageChanged}
      />,
    )
    expect(await screen.findByText('Comment 5')).toBeTruthy()
    fail(new Error('late failure'))
    await Promise.resolve()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('gives every comment its own button names (item 8)', async () => {
    mocks.fetchThread.mockResolvedValue(
      page({
        viewerMayComment: true,
        comments: [
          comment({ commentId: 'a', postedAt: '2026-11-12T09:00:00.000Z' }),
          comment({ commentId: 'b', postedAt: '2026-11-12T10:00:00.000Z' }),
        ],
      }),
    )
    renderThread()
    const replies = await screen.findAllByRole('button', { name: /^Reply to/ })
    const names = replies.map((button) => button.getAttribute('aria-label'))
    expect(new Set(names).size).toBe(2)
    expect(names[0]).toBe(
      'Reply to comment 1, by Synthetic Member, Nov 12, 2026, 9:00 AM UTC',
    )
  })

  it('sends a note with a suggestion, and none when left empty', async () => {
    mocks.fetchThread.mockResolvedValue(
      page({ viewerMayComment: true, viewerMaySuggest: true, comments: [] }),
    )
    renderThread({ tabId: 'tab_1', belief: true })
    fireEvent.click(
      await screen.findByRole('button', { name: 'Suggest a rewording' }),
    )
    fireEvent.change(
      screen.getByLabelText('Your wording of the whole belief'),
      {
        target: { value: 'Clearer.' },
      },
    )
    fireEvent.change(screen.getByLabelText('A note for the owner (optional)'), {
      target: { value: ' Why it reads better. ' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Send suggestion' }))
    await waitFor(() =>
      expect(mocks.suggestRewording).toHaveBeenCalledWith('tok', {
        slug: 'quiet-fern',
        tabId: 'tab_1',
        text: 'Clearer.',
        baseSeq: 3,
        note: 'Why it reads better.',
      }),
    )
  })
})
