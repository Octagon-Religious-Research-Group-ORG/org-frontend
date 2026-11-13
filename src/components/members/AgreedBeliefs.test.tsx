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
import type { AgreedBelief, TabVotes } from '#/lib/votes-api'
import {
  AGREED_HEADING,
  AgreedBeliefs,
  appendUnique,
  EMPTY_PAGES_FOLLOWED,
} from './AgreedBeliefs'

const mocks = vi.hoisted(() => ({
  auth: { isLoading: false, isAuthenticated: false, getToken: vi.fn() },
  fetchAgreedBeliefs: vi.fn(),
  castVote: vi.fn(),
  withdrawVote: vi.fn(),
  postComment: vi.fn(),
}))

vi.mock('#/lib/auth', () => ({ useOrgAuth: () => mocks.auth }))
vi.mock('#/lib/votes-api', async (original) => ({
  ...(await original<object>()),
  fetchAgreedBeliefs: mocks.fetchAgreedBeliefs,
  castVote: mocks.castVote,
  withdrawVote: mocks.withdrawVote,
}))
vi.mock('#/lib/comments-api', async (original) => ({
  ...(await original<object>()),
  postComment: mocks.postComment,
}))
vi.mock('@tanstack/react-router', async (original) => ({
  ...(await original<object>()),
  Link: ({
    children,
    params,
    hash,
  }: {
    children: ReactNode
    params: { slug: string }
    hash?: string
  }) => <a href={`/${params.slug}${hash ? `#${hash}` : ''}`}>{children}</a>,
}))

const votes = (overrides: Partial<TabVotes> = {}): TabVotes => ({
  agree: 2,
  disagree: 1,
  earlierWording: 0,
  mayVote: false,
  viewerVoteBlock: 'sign-in',
  ...overrides,
})

const belief = (
  tabId: string,
  overrides: Partial<AgreedBelief> = {},
): AgreedBelief => ({
  slug: 'quiet-fern',
  tabId,
  title: `Title ${tabId}`,
  paragraphs: [
    {
      blockId: `b_${tabId}`,
      kind: 'paragraph',
      label: '',
      text: `Text ${tabId}.`,
    },
  ],
  textSeq: 1,
  author: { displayName: 'Synthetic Member', slug: 'quiet-fern' },
  votes: votes(),
  ...overrides,
})

beforeEach(() => {
  mocks.auth.isLoading = false
  mocks.auth.isAuthenticated = false
  mocks.auth.getToken.mockReset().mockResolvedValue('tok')
  mocks.fetchAgreedBeliefs
    .mockReset()
    .mockResolvedValue({ beliefs: [belief('tab_1')] })
  mocks.castVote.mockReset()
  mocks.withdrawVote.mockReset()
  mocks.postComment.mockReset().mockResolvedValue({ commentId: 'c', seq: 1 })
})

afterEach(cleanup)

describe('AgreedBeliefs', () => {
  it('lists beliefs for a guest, with counts, the member’s name and link, and votes off with the reason', async () => {
    render(<AgreedBeliefs />)
    expect(screen.getByRole('heading', { name: AGREED_HEADING })).toBeTruthy()
    const entry = await screen.findByRole('article', { name: 'Title tab_1' })
    expect(within(entry).getByText('Text tab_1.')).toBeTruthy()
    expect(within(entry).getByText('2 agree · 1 disagree')).toBeTruthy()
    expect(
      within(entry).getByRole('link', { name: 'Synthetic Member' }),
    ).toHaveProperty('href', expect.stringMatching(/\/quiet-fern$/))
    expect(
      within(entry).getByRole('link', {
        name: 'Open this belief on Synthetic Member’s page',
      }),
    ).toHaveProperty(
      'href',
      expect.stringMatching(/\/quiet-fern#belief-tab_1$/),
    )
    expect(
      within(entry)
        .getByRole('button', {
          name: 'Agree with “Title tab_1”',
        })
        .hasAttribute('disabled'),
    ).toBe(true)
    expect(
      within(entry)
        .getByRole('button', {
          name: 'Comment without a vote on “Title tab_1”',
        })
        .hasAttribute('disabled'),
    ).toBe(true)
    expect(within(entry).getAllByText(/Sign in/).length).toBeGreaterThan(0)
    expect(mocks.fetchAgreedBeliefs).toHaveBeenCalledWith({
      after: undefined,
      token: undefined,
    })
  })

  it('follows empty pages that say there is more, and shows what it then finds (fix round 1, LOW 2)', async () => {
    mocks.fetchAgreedBeliefs
      .mockReset()
      .mockResolvedValueOnce({ beliefs: [], nextAfter: '2.9.a' })
      .mockResolvedValueOnce({ beliefs: [], nextAfter: '2.8.b' })
      .mockResolvedValueOnce({ beliefs: [belief('tab_far')] })
    render(<AgreedBeliefs />)
    expect(
      await screen.findByRole('article', { name: 'Title tab_far' }),
    ).toBeTruthy()
    expect(mocks.fetchAgreedBeliefs.mock.calls.map((c) => c[0].after)).toEqual([
      undefined,
      '2.9.a',
      '2.8.b',
    ])
    expect(screen.queryByText(/No member belief/)).toBeNull()
  })

  it('stops following after a bound, and says neutrally that there is more', async () => {
    mocks.fetchAgreedBeliefs
      .mockReset()
      .mockResolvedValue({ beliefs: [], nextAfter: '2.1.z' })
    render(<AgreedBeliefs />)
    expect(
      await screen.findByText(/None of the beliefs looked at so far/),
    ).toBeTruthy()
    expect(screen.queryByText(/No member belief/)).toBeNull()
    expect(
      screen.getByRole('button', { name: 'Show more beliefs' }),
    ).toBeTruthy()
    expect(mocks.fetchAgreedBeliefs).toHaveBeenCalledTimes(
      1 + EMPTY_PAGES_FOLLOWED,
    )
  })

  it('never repeats an entry a later page sends again', () => {
    expect(
      appendUnique([belief('a'), belief('b')], [belief('b'), belief('c')]).map(
        (entry) => entry.tabId,
      ),
    ).toEqual(['a', 'b', 'c'])
  })

  it('says when no belief is there yet', async () => {
    mocks.fetchAgreedBeliefs.mockResolvedValueOnce({ beliefs: [] })
    render(<AgreedBeliefs />)
    expect(
      await screen.findByText('No member belief has two agreeing votes yet.'),
    ).toBeTruthy()
  })

  it('waits for the sign-in check, then reads with the token, and pages on', async () => {
    mocks.auth.isLoading = true
    const { rerender } = render(<AgreedBeliefs />)
    expect(mocks.fetchAgreedBeliefs).not.toHaveBeenCalled()
    expect(screen.getByText('Opening the list…')).toBeTruthy()
    mocks.auth.isLoading = false
    mocks.auth.isAuthenticated = true
    mocks.auth = { ...mocks.auth }
    mocks.fetchAgreedBeliefs
      .mockResolvedValueOnce({
        beliefs: [belief('tab_1')],
        nextAfter: '2.1.tab_1',
      })
      .mockResolvedValueOnce({ beliefs: [belief('tab_2')] })
    rerender(<AgreedBeliefs />)
    fireEvent.click(
      await screen.findByRole('button', { name: 'Show more beliefs' }),
    )
    expect(
      await screen.findByRole('article', { name: 'Title tab_2' }),
    ).toBeTruthy()
    expect(screen.getByRole('article', { name: 'Title tab_1' })).toBeTruthy()
    expect(mocks.fetchAgreedBeliefs).toHaveBeenLastCalledWith({
      after: '2.1.tab_1',
      token: 'tok',
    })
    expect(
      screen.queryByRole('button', { name: 'Show more beliefs' }),
    ).toBeNull()
  })

  it('shows why the list could not be read', async () => {
    mocks.fetchAgreedBeliefs.mockRejectedValueOnce(new Error('Server trouble.'))
    render(<AgreedBeliefs />)
    expect(await screen.findByRole('alert')).toHaveProperty(
      'textContent',
      'Server trouble.',
    )
    cleanup()
    mocks.fetchAgreedBeliefs.mockRejectedValueOnce('not an error')
    render(<AgreedBeliefs />)
    expect(await screen.findByRole('alert')).toHaveProperty(
      'textContent',
      'This list is unavailable.',
    )
  })

  it('refuses to read signed-in without a token', async () => {
    mocks.auth = { ...mocks.auth, isAuthenticated: true }
    mocks.auth.getToken.mockResolvedValueOnce(null)
    render(<AgreedBeliefs />)
    expect(await screen.findByRole('alert')).toHaveProperty(
      'textContent',
      expect.stringContaining("couldn't confirm"),
    )
  })

  it('ignores an answer that a newer read replaced', async () => {
    let resolveFirst: (value: unknown) => void = () => undefined
    mocks.fetchAgreedBeliefs
      .mockReset()
      .mockImplementationOnce(
        () => new Promise((resolve) => (resolveFirst = resolve)),
      )
      .mockResolvedValueOnce({ beliefs: [belief('tab_new')] })
    const { rerender } = render(<AgreedBeliefs />)
    mocks.auth = { ...mocks.auth }
    rerender(<AgreedBeliefs />)
    expect(
      await screen.findByRole('article', { name: 'Title tab_new' }),
    ).toBeTruthy()
    resolveFirst({ beliefs: [belief('tab_old')] })
    await Promise.resolve()
    expect(screen.queryByRole('article', { name: 'Title tab_old' })).toBeNull()
  })

  it('ignores a failure that a newer read replaced', async () => {
    let rejectFirst: (reason: unknown) => void = () => undefined
    mocks.fetchAgreedBeliefs
      .mockReset()
      .mockImplementationOnce(
        () => new Promise((_resolve, reject) => (rejectFirst = reject)),
      )
      .mockResolvedValueOnce({ beliefs: [belief('tab_new')] })
    const { rerender } = render(<AgreedBeliefs />)
    mocks.auth = { ...mocks.auth }
    rerender(<AgreedBeliefs />)
    await screen.findByRole('article', { name: 'Title tab_new' })
    rejectFirst(new Error('late'))
    await Promise.resolve()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  describe('a signed-in member', () => {
    beforeEach(() => {
      mocks.auth = { ...mocks.auth, isAuthenticated: true }
      mocks.fetchAgreedBeliefs.mockResolvedValue({
        beliefs: [
          belief('tab_1', {
            votes: votes({ mayVote: true, viewerVoteBlock: undefined }),
          }),
        ],
        viewerMayComment: true,
      })
    })

    it('votes right here and sees the counts change', async () => {
      mocks.castVote.mockResolvedValueOnce({
        tabId: 'tab_1',
        textSeq: 1,
        votes: votes({
          agree: 3,
          myVote: 'agree',
          mayVote: true,
          viewerVoteBlock: undefined,
        }),
      })
      render(<AgreedBeliefs />)
      fireEvent.click(
        await screen.findByRole('button', { name: 'Agree with “Title tab_1”' }),
      )
      expect(await screen.findByText('3 agree · 1 disagree')).toBeTruthy()
      expect(
        screen
          .getByRole('button', { name: 'Agree with “Title tab_1”' })
          .getAttribute('aria-pressed'),
      ).toBe('true')
    })

    it('keeps what is loaded and marks the entry when the belief was reworded meanwhile (fix round 1, LOW 3)', async () => {
      mocks.castVote.mockResolvedValueOnce({
        tabId: 'tab_1',
        textSeq: 2,
        votes: votes({ agree: 0, mayVote: true }),
      })
      render(<AgreedBeliefs />)
      fireEvent.click(
        await screen.findByRole('button', { name: 'Agree with “Title tab_1”' }),
      )
      expect(
        await screen.findByText(/This belief was reworded since the list/),
      ).toBeTruthy()
      expect(mocks.fetchAgreedBeliefs).toHaveBeenCalledTimes(1)
      expect(screen.getByRole('article', { name: 'Title tab_1' })).toBeTruthy()
    })

    it('the badge follows the vote: none once the vote is taken back (fix round 1, LOW 5)', async () => {
      mocks.castVote.mockResolvedValueOnce({
        tabId: 'tab_1',
        textSeq: 1,
        votes: votes({ agree: 3, myVote: 'agree', mayVote: true }),
      })
      mocks.withdrawVote.mockResolvedValueOnce({
        withdrawn: true,
        tabId: 'tab_1',
        textSeq: 1,
        votes: votes({ agree: 2, mayVote: true }),
      })
      render(<AgreedBeliefs />)
      fireEvent.click(
        await screen.findByRole('button', {
          name: 'Agree and comment on “Title tab_1”',
        }),
      )
      expect(await screen.findByText(/will show “Agrees”/)).toBeTruthy()
      fireEvent.click(
        screen.getByRole('button', { name: 'Agree with “Title tab_1”' }),
      )
      await waitFor(() => expect(screen.queryByText(/will show/)).toBeNull())
      fireEvent.change(screen.getByRole('textbox'), {
        target: { value: 'No badge now.' },
      })
      fireEvent.click(screen.getByRole('button', { name: 'Post comment' }))
      await waitFor(() => expect(mocks.postComment).toHaveBeenCalled())
      expect(mocks.postComment.mock.calls[0][1]).not.toHaveProperty('stance')
    })

    it('the badge switches when the reader changes their vote', async () => {
      mocks.castVote
        .mockResolvedValueOnce({
          tabId: 'tab_1',
          textSeq: 1,
          votes: votes({ agree: 3, myVote: 'agree', mayVote: true }),
        })
        .mockResolvedValueOnce({
          tabId: 'tab_1',
          textSeq: 1,
          votes: votes({
            agree: 2,
            disagree: 2,
            myVote: 'disagree',
            mayVote: true,
          }),
        })
      render(<AgreedBeliefs />)
      fireEvent.click(
        await screen.findByRole('button', {
          name: 'Agree and comment on “Title tab_1”',
        }),
      )
      await screen.findByText(/will show “Agrees”/)
      fireEvent.click(
        screen.getByRole('button', { name: 'Disagree with “Title tab_1”' }),
      )
      expect(await screen.findByText(/will show “Disagrees”/)).toBeTruthy()
    })

    it('a plain comment form keeps having no badge when the reader votes', async () => {
      mocks.castVote.mockResolvedValueOnce({
        tabId: 'tab_1',
        textSeq: 1,
        votes: votes({ agree: 3, myVote: 'agree', mayVote: true }),
      })
      render(<AgreedBeliefs />)
      fireEvent.click(
        await screen.findByRole('button', {
          name: 'Comment without a vote on “Title tab_1”',
        }),
      )
      fireEvent.click(
        screen.getByRole('button', { name: 'Agree with “Title tab_1”' }),
      )
      await screen.findByText('3 agree · 1 disagree')
      expect(screen.queryByText(/will show/)).toBeNull()
      expect(screen.getByRole('textbox')).toBeTruthy()
    })

    it('gates "Comment without a vote" on what the list says (fix round 1, LOW 6)', async () => {
      mocks.fetchAgreedBeliefs.mockResolvedValueOnce({
        beliefs: [belief('tab_1', { votes: votes({ mayVote: true }) })],
        viewerMayComment: false,
        viewerWriteBlock: 'verify-email',
      })
      render(<AgreedBeliefs />)
      const button = await screen.findByRole('button', {
        name: 'Comment without a vote on “Title tab_1”',
      })
      expect(button.hasAttribute('disabled')).toBe(true)
      expect(
        screen.getByText(/confirm your email address to comment/),
      ).toBeTruthy()
    })

    it('"Agree and comment" votes, then posts the comment with the badge', async () => {
      mocks.castVote.mockResolvedValueOnce({
        tabId: 'tab_1',
        textSeq: 1,
        votes: votes({ agree: 3, myVote: 'agree', mayVote: true }),
      })
      render(<AgreedBeliefs />)
      fireEvent.click(
        await screen.findByRole('button', {
          name: 'Agree and comment on “Title tab_1”',
        }),
      )
      const box = await screen.findByRole('textbox', {
        name: 'Comment on “Title tab_1”',
      })
      await waitFor(() => expect(document.activeElement).toBe(box))
      expect(screen.getByText(/will show “Agrees”/)).toBeTruthy()
      fireEvent.change(box, { target: { value: 'Why I agree.' } })
      fireEvent.click(screen.getByRole('button', { name: 'Post comment' }))
      expect(await screen.findByText(/Your comment is posted/)).toBeTruthy()
      expect(mocks.postComment).toHaveBeenCalledWith('tok', {
        slug: 'quiet-fern',
        tabId: 'tab_1',
        body: 'Why I agree.',
        stance: 'agree',
      })
      expect(screen.queryByRole('textbox')).toBeNull()
    })

    it('"Comment without a vote" posts no badge; a refused post says why; cancel closes', async () => {
      mocks.postComment
        .mockRejectedValueOnce(new Error('Not allowed.'))
        .mockResolvedValueOnce({ commentId: 'c', seq: 1 })
      render(<AgreedBeliefs />)
      fireEvent.click(
        await screen.findByRole('button', {
          name: 'Comment without a vote on “Title tab_1”',
        }),
      )
      expect(screen.queryByText(/will show/)).toBeNull()
      fireEvent.change(screen.getByRole('textbox'), {
        target: { value: 'Just a thought.' },
      })
      fireEvent.click(screen.getByRole('button', { name: 'Post comment' }))
      expect(await screen.findByRole('alert')).toHaveProperty(
        'textContent',
        'Not allowed.',
      )
      fireEvent.click(screen.getByRole('button', { name: 'Post comment' }))
      await screen.findByText(/Your comment is posted/)
      expect(mocks.postComment.mock.calls[1][1]).toEqual({
        slug: 'quiet-fern',
        tabId: 'tab_1',
        body: 'Just a thought.',
      })
      fireEvent.click(
        screen.getByRole('button', {
          name: 'Comment without a vote on “Title tab_1”',
        }),
      )
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
      expect(screen.queryByRole('textbox')).toBeNull()
    })

    it('updates only the entry voted on', async () => {
      mocks.fetchAgreedBeliefs.mockResolvedValue({
        beliefs: [
          belief('tab_1', { votes: votes({ mayVote: true }) }),
          belief('tab_2', { votes: votes({ mayVote: true }) }),
        ],
      })
      mocks.castVote.mockResolvedValueOnce({
        tabId: 'tab_1',
        textSeq: 1,
        votes: votes({ agree: 9, mayVote: true }),
      })
      render(<AgreedBeliefs />)
      fireEvent.click(
        await screen.findByRole('button', { name: 'Agree with “Title tab_1”' }),
      )
      await screen.findByText('9 agree · 1 disagree')
      expect(
        within(screen.getByRole('article', { name: 'Title tab_2' })).getByText(
          '2 agree · 1 disagree',
        ),
      ).toBeTruthy()
    })
  })
})
