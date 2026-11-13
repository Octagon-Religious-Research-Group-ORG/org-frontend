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
import { ApiError } from '#/lib/api'
import type { CommentView, ThreadPage } from '#/lib/comments-api'
import type { OrgPageVotes, TabVotes } from '#/lib/votes-api'
import {
  OrgPageReactions,
  PAGE_UPDATED_NOTE,
  PageReactions,
  REACTIONS_HEADING,
  REACTIONS_UNAVAILABLE,
} from './OrgPageReactions'

// Votes and comments on ORG's own pages (Chunk 10b). Synthetic data only.

const mocks = vi.hoisted(() => ({
  auth: {
    isLoading: false,
    isAuthenticated: false,
    getToken: vi.fn(),
  },
  fetchOrgPageVotes: vi.fn(),
  castOrgPageVote: vi.fn(),
  withdrawOrgPageVote: vi.fn(),
  fetchOrgPageThread: vi.fn(),
  postOrgPageComment: vi.fn(),
  fetchOrgPageCommentHistory: vi.fn(),
  fetchThread: vi.fn(),
  reloadPage: vi.fn(),
}))

vi.mock('#/lib/reload-page', () => ({ reloadPage: mocks.reloadPage }))

vi.mock('#/lib/auth', () => ({ useOrgAuth: () => mocks.auth }))
vi.mock('#/lib/votes-api', async (original) => ({
  ...(await original<object>()),
  fetchOrgPageVotes: mocks.fetchOrgPageVotes,
  castOrgPageVote: mocks.castOrgPageVote,
  withdrawOrgPageVote: mocks.withdrawOrgPageVote,
}))
vi.mock('#/lib/comments-api', async (original) => ({
  ...(await original<object>()),
  fetchOrgPageThread: mocks.fetchOrgPageThread,
  postOrgPageComment: mocks.postOrgPageComment,
  fetchOrgPageCommentHistory: mocks.fetchOrgPageCommentHistory,
  fetchThread: mocks.fetchThread,
}))
vi.mock('@tanstack/react-router', async (original) => ({
  ...(await original<object>()),
  Link: ({ children }: { children: ReactNode }) => <a href="/x">{children}</a>,
}))

const votes = (overrides: Partial<TabVotes> = {}): TabVotes => ({
  agree: 1,
  disagree: 0,
  earlierWording: 0,
  mayVote: true,
  ...overrides,
})

const answer = (
  overrides: Partial<TabVotes> = {},
  revision = 2,
): OrgPageVotes => ({ pageId: 'about', revision, votes: votes(overrides) })

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

const thread = (overrides: Partial<ThreadPage> = {}): ThreadPage => ({
  comments: [],
  viewerMayComment: true,
  viewerMaySuggest: false,
  ...overrides,
})

function renderReactions(revision = 2) {
  return render(
    <OrgPageReactions pageId="about" revision={revision} title="About Us" />,
  )
}

const button = (name: string) => screen.getByRole('button', { name })

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

beforeEach(() => {
  mocks.reloadPage.mockReset()
  mocks.auth.isLoading = false
  mocks.auth.isAuthenticated = true
  mocks.auth.getToken.mockReset().mockResolvedValue('tok')
  mocks.fetchOrgPageVotes.mockReset().mockResolvedValue(answer())
  mocks.castOrgPageVote.mockReset()
  mocks.withdrawOrgPageVote.mockReset()
  mocks.fetchOrgPageThread.mockReset().mockResolvedValue(thread())
  mocks.postOrgPageComment.mockReset()
  mocks.fetchOrgPageCommentHistory.mockReset()
  mocks.fetchThread.mockReset()
})

afterEach(cleanup)

describe('OrgPageReactions', () => {
  it('shows a guest the counts, the buttons off with the reason, and the thread, read without a token', async () => {
    mocks.auth.isAuthenticated = false
    mocks.fetchOrgPageVotes.mockResolvedValue(
      answer({ agree: 3, mayVote: false, viewerVoteBlock: 'sign-in' }),
    )
    mocks.fetchOrgPageThread.mockResolvedValue(
      thread({
        comments: [comment()],
        viewerMayComment: false,
        viewerWriteBlock: 'sign-in',
      }),
    )
    renderReactions()
    const region = await screen.findByRole('region', {
      name: REACTIONS_HEADING,
    })
    expect(await within(region).findByText('3 agree · 0 disagree')).toBeTruthy()
    for (const name of [
      'Agree with “About Us”',
      'Disagree with “About Us”',
      'Agree and comment on “About Us”',
      'Disagree and comment on “About Us”',
      'Comment without a vote on “About Us”',
    ]) {
      expect(button(name).hasAttribute('disabled')).toBe(true)
    }
    expect(await screen.findByText('A synthetic comment.')).toBeTruthy()
    expect(mocks.fetchOrgPageVotes).toHaveBeenCalledWith('about', {
      token: undefined,
    })
    expect(mocks.fetchOrgPageThread).toHaveBeenCalledWith('about', {
      after: undefined,
      token: undefined,
    })
    expect(mocks.auth.getToken).not.toHaveBeenCalled()
    expect(mocks.fetchThread).not.toHaveBeenCalled()
  })

  it('waits for the sign-in check, then reads with the token', async () => {
    mocks.auth.isLoading = true
    const view = renderReactions()
    expect(mocks.fetchOrgPageVotes).not.toHaveBeenCalled()
    expect(screen.getByText('Opening the votes…')).toBeTruthy()
    // A new answer from the sign-in hook, as the real one gives.
    mocks.auth = { ...mocks.auth, isLoading: false }
    view.rerender(
      <OrgPageReactions pageId="about" revision={2} title="About Us" />,
    )
    await waitFor(() =>
      expect(mocks.fetchOrgPageVotes).toHaveBeenCalledWith('about', {
        token: 'tok',
      }),
    )
  })

  it('votes on the revision shown, and "…and comment" posts with the badge; a taken-back vote drops it', async () => {
    mocks.castOrgPageVote.mockResolvedValueOnce(
      answer({ agree: 2, myVote: 'agree' }),
    )
    mocks.postOrgPageComment.mockResolvedValueOnce({
      commentId: 'cmt_new',
      seq: 1,
      comment: comment({ commentId: 'cmt_new', body: 'Mine.', mine: true }),
    })
    renderReactions()
    await screen.findByText('1 agree · 0 disagree')
    await waitFor(() =>
      expect(
        button('Comment without a vote on “About Us”').hasAttribute('disabled'),
      ).toBe(false),
    )
    fireEvent.click(button('Agree and comment on “About Us”'))
    await screen.findByText('2 agree · 0 disagree')
    expect(mocks.castOrgPageVote).toHaveBeenCalledWith('tok', 'about', {
      value: 'agree',
      baseSeq: 2,
    })
    expect(await screen.findByText(/will show “Agrees”/)).toBeTruthy()

    // Changing the vote keeps the badge in step with it.
    mocks.castOrgPageVote.mockResolvedValueOnce(
      answer({ agree: 1, disagree: 1, myVote: 'disagree' }),
    )
    fireEvent.click(button('Disagree with “About Us”'))
    expect(await screen.findByText(/will show “Disagrees”/)).toBeTruthy()

    fireEvent.change(screen.getByLabelText('Comment on this page'), {
      target: { value: 'Mine.' },
    })
    fireEvent.click(button('Post comment'))
    await screen.findByText('Mine.')
    expect(mocks.postOrgPageComment).toHaveBeenCalledWith('tok', 'about', {
      body: 'Mine.',
      stance: 'disagree',
    })

    // A new "…and comment" request, then the vote taken back: no badge.
    fireEvent.click(button('Disagree and comment on “About Us”'))
    expect(await screen.findByText(/will show “Disagrees”/)).toBeTruthy()
    mocks.withdrawOrgPageVote.mockResolvedValueOnce({
      withdrawn: true,
      ...answer({ agree: 1 }),
    })
    fireEvent.click(button('Disagree with “About Us”'))
    await waitFor(() =>
      expect(screen.queryByText(/will show “Disagrees”/)).toBeNull(),
    )
  })

  it('keeps a plain comment request as it is when the vote changes', async () => {
    mocks.castOrgPageVote.mockResolvedValueOnce(answer({ myVote: 'agree' }))
    renderReactions()
    await waitFor(() =>
      expect(
        button('Comment without a vote on “About Us”').hasAttribute('disabled'),
      ).toBe(false),
    )
    fireEvent.click(button('Comment without a vote on “About Us”'))
    fireEvent.click(button('Agree with “About Us”'))
    await waitFor(() =>
      expect(button('Agree with “About Us”').getAttribute('aria-pressed')).toBe(
        'true',
      ),
    )
    expect(screen.queryByText(/will show/)).toBeNull()
    mocks.postOrgPageComment.mockResolvedValueOnce({
      commentId: 'cmt_plain',
      seq: 1,
      comment: comment({ commentId: 'cmt_plain', body: 'Plain words.' }),
    })
    fireEvent.change(screen.getByLabelText('Comment on this page'), {
      target: { value: 'Plain words.' },
    })
    fireEvent.click(button('Post comment'))
    await screen.findByText('Plain words.')
    expect(mocks.postOrgPageComment).toHaveBeenCalledWith('tok', 'about', {
      body: 'Plain words.',
    })
  })

  it('says so when the page was published again since it was opened, and votes on nothing the reader has not seen (review MEDIUM 2)', async () => {
    mocks.fetchOrgPageVotes.mockResolvedValue(
      answer(
        { agree: 1, earlierWording: 1, myVoteOnEarlierWording: 'agree' },
        3,
      ),
    )
    renderReactions(2)
    expect(await screen.findByText(PAGE_UPDATED_NOTE)).toBeTruthy()
    await screen.findByText('1 agree · 0 disagree')
    for (const name of [
      'Agree with “About Us”',
      'Disagree with “About Us”',
      'Agree and comment on “About Us”',
      'Disagree and comment on “About Us”',
    ]) {
      expect(button(name).hasAttribute('disabled')).toBe(true)
    }
    expect(
      screen.queryByRole('button', {
        name: 'Confirm my vote on the new version',
      }),
    ).toBeNull()
    fireEvent.click(button('Agree with “About Us”'))
    expect(mocks.castOrgPageVote).not.toHaveBeenCalled()
    fireEvent.click(button('Reload the page'))
    expect(mocks.reloadPage).toHaveBeenCalledTimes(1)
  })

  it('stops voting once a vote’s answer shows a newer revision', async () => {
    mocks.castOrgPageVote.mockResolvedValueOnce(
      answer({ agree: 2, myVote: 'agree' }, 3),
    )
    renderReactions(2)
    await screen.findByText('1 agree · 0 disagree')
    fireEvent.click(button('Agree with “About Us”'))
    expect(await screen.findByText(PAGE_UPDATED_NOTE)).toBeTruthy()
    expect(button('Disagree with “About Us”').hasAttribute('disabled')).toBe(
      true,
    )
  })

  it('shows nothing at all for a page the server does not know', async () => {
    mocks.fetchOrgPageVotes.mockRejectedValue(new ApiError('Not found', 404))
    const view = renderReactions()
    await waitFor(() => expect(view.container.innerHTML).toBe(''))
  })

  it('says why the votes are unavailable', async () => {
    mocks.fetchOrgPageVotes.mockRejectedValueOnce(
      new ApiError('The server had trouble.', 500),
    )
    renderReactions()
    expect((await screen.findByRole('alert')).textContent).toBe(
      'The server had trouble.',
    )
    cleanup()
    mocks.fetchOrgPageVotes.mockRejectedValueOnce('not an error')
    renderReactions()
    expect(await screen.findByText(REACTIONS_UNAVAILABLE)).toBeTruthy()
    expect(screen.queryByText('Opening the votes…')).toBeNull()
    cleanup()
    mocks.auth.getToken.mockResolvedValue(undefined)
    renderReactions()
    // Said by the votes and by the thread alike.
    expect(
      await screen.findAllByText(
        "We couldn't confirm that you're signed in. Please try again.",
      ),
    ).toHaveLength(2)
  })

  it('drops an answer that arrives after it was closed', async () => {
    const late = deferred<OrgPageVotes>()
    mocks.fetchOrgPageVotes.mockReturnValueOnce(late.promise)
    const first = renderReactions()
    first.unmount()
    late.resolve(answer())
    const failed = deferred<OrgPageVotes>()
    mocks.fetchOrgPageVotes.mockReturnValueOnce(failed.promise)
    const second = renderReactions()
    second.unmount()
    failed.reject(new Error('Too late.'))
    await Promise.resolve()
    expect(screen.queryByText('Too late.')).toBeNull()
  })

  it('replies and reads the edit history on the page’s own thread, with no rewording suggestions', async () => {
    mocks.fetchOrgPageThread.mockResolvedValue(
      thread({
        comments: [comment({ edited: true, editedAt: '2026-11-12T10:00:00Z' })],
        // Never sent for an ORG page; even so, there is nothing to suggest on.
        viewerMaySuggest: true,
      }),
    )
    mocks.postOrgPageComment.mockResolvedValueOnce({
      commentId: 'cmt_reply',
      seq: 1,
      comment: comment({
        commentId: 'cmt_reply',
        parentCommentId: 'cmt_1',
        body: 'A synthetic reply.',
      }),
    })
    mocks.fetchOrgPageCommentHistory.mockResolvedValue({
      entries: [
        {
          seq: 2,
          savedAt: '2026-11-12T10:00:00.000Z',
          text: 'A synthetic comment.',
          hash: 'abcdef012345',
        },
      ],
      page: 1,
      hasMore: false,
    })
    renderReactions()
    await screen.findByText('A synthetic comment.')
    expect(screen.queryByRole('button', { name: 'Suggest a rewording' })).toBe(
      null,
    )

    fireEvent.click(screen.getByRole('button', { name: /^Edit history of / }))
    await waitFor(() =>
      expect(mocks.fetchOrgPageCommentHistory).toHaveBeenCalledWith(
        'about',
        'cmt_1',
        { page: 1, token: 'tok' },
      ),
    )

    fireEvent.click(screen.getByRole('button', { name: /^Reply to / }))
    fireEvent.change(screen.getByLabelText('Your reply'), {
      target: { value: 'A synthetic reply.' },
    })
    fireEvent.click(button('Post reply'))
    await waitFor(() =>
      expect(mocks.postOrgPageComment).toHaveBeenCalledWith('tok', 'about', {
        parentCommentId: 'cmt_1',
        body: 'A synthetic reply.',
      }),
    )
  })

  it('takes its title from the page, or the one the route shows', async () => {
    const page = { pageId: 'about', revision: 2, content: { title: 'About' } }
    render(<PageReactions page={page} />)
    expect(
      await screen.findByRole('button', { name: 'Agree with “About”' }),
    ).toBeTruthy()
    cleanup()
    render(<PageReactions page={page} title="Members Community" />)
    expect(
      await screen.findByRole('button', {
        name: 'Agree with “Members Community”',
      }),
    ).toBeTruthy()
  })
})
