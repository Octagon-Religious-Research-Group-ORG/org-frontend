// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { BeliefTab } from '#/lib/members-api'
import type { TabVotes } from '#/lib/votes-api'
import { BeliefTabs } from './BeliefTabs'

const mocks = vi.hoisted(() => ({
  auth: { isLoading: false, isAuthenticated: true, getToken: vi.fn() },
  castVote: vi.fn(),
  withdrawVote: vi.fn(),
}))

vi.mock('#/lib/auth', () => ({ useOrgAuth: () => mocks.auth }))
vi.mock('#/lib/votes-api', async (original) => ({
  ...(await original<object>()),
  castVote: mocks.castVote,
  withdrawVote: mocks.withdrawVote,
}))
vi.mock('./CommentThread', () => ({
  CommentThread: (props: {
    tabId: string
    compose?: { stance?: string; nonce: number }
    onAccess?: (access: { mayComment: boolean; reason?: string }) => void
  }) => (
    <div data-testid="thread">
      {JSON.stringify({ tabId: props.tabId, compose: props.compose ?? null })}
      <button
        type="button"
        onClick={() => props.onAccess?.({ mayComment: true })}
      >
        thread allows comments
      </button>
    </div>
  ),
}))

const votes = (overrides: Partial<TabVotes> = {}): TabVotes => ({
  agree: 1,
  disagree: 0,
  earlierWording: 0,
  mayVote: true,
  ...overrides,
})

const tab = (tabId: string, extra: Partial<BeliefTab> = {}): BeliefTab => ({
  tabId,
  title: `Title ${tabId}`,
  needsReview: false,
  paragraphs: [
    {
      blockId: `b_${tabId}`,
      kind: 'paragraph',
      label: '',
      text: `Text ${tabId}`,
    },
  ],
  textSeq: 2,
  votes: votes(),
  ...extra,
})

const onChanged = vi.fn()

beforeEach(() => {
  mocks.auth.getToken.mockReset().mockResolvedValue('tok')
  mocks.castVote.mockReset()
  mocks.withdrawVote.mockReset()
  onChanged.mockClear()
  window.location.hash = ''
  // jsdom has no layout.
  Element.prototype.scrollIntoView = vi.fn()
})

afterEach(cleanup)

const thread = () =>
  JSON.parse(
    screen
      .getByTestId('thread')
      .textContent.replace(/thread allows comments$/, ''),
  ) as {
    tabId: string
    compose: { stance?: string; nonce: number } | null
  }

describe('BeliefTabs with votes (Chunk 10)', () => {
  it('shows the vote buttons only when the server sent votes', () => {
    render(
      <BeliefTabs
        slug="quiet-fern"
        tabs={[tab('t1', { votes: undefined })]}
        onChanged={onChanged}
      />,
    )
    expect(screen.queryByRole('group', { name: /Votes on/ })).toBeNull()
  })

  it('shows the new counts after a vote, and keeps them until the page is read again', async () => {
    mocks.castVote.mockResolvedValueOnce({
      tabId: 't1',
      textSeq: 2,
      votes: votes({ agree: 2, myVote: 'agree' }),
    })
    const tabs = [tab('t1')]
    const { rerender } = render(
      <BeliefTabs slug="quiet-fern" tabs={tabs} onChanged={onChanged} />,
    )
    fireEvent.click(
      screen.getByRole('button', { name: 'Agree with “Title t1”' }),
    )
    expect(await screen.findByText('2 agree · 0 disagree')).toBeTruthy()
    expect(mocks.castVote.mock.calls[0][1]).toMatchObject({ baseSeq: 2 })
    expect(onChanged).not.toHaveBeenCalled()
    // Same page: the vote stays shown.
    rerender(<BeliefTabs slug="quiet-fern" tabs={tabs} onChanged={onChanged} />)
    expect(screen.getByText('2 agree · 0 disagree')).toBeTruthy()
    // Read again: the server's answer replaces it.
    rerender(
      <BeliefTabs
        slug="quiet-fern"
        tabs={[tab('t1', { votes: votes({ agree: 5 }) })]}
        onChanged={onChanged}
      />,
    )
    expect(screen.getByText('5 agree · 0 disagree')).toBeTruthy()
  })

  it('reads the page again when the belief was reworded meanwhile', async () => {
    mocks.castVote.mockResolvedValueOnce({
      tabId: 't1',
      textSeq: 3,
      votes: votes(),
    })
    render(
      <BeliefTabs
        slug="quiet-fern"
        tabs={[tab('t1', { textSeq: undefined })]}
        onChanged={onChanged}
      />,
    )
    fireEvent.click(
      screen.getByRole('button', { name: 'Agree with “Title t1”' }),
    )
    await waitFor(() => expect(onChanged).toHaveBeenCalled())
    expect(mocks.castVote.mock.calls[0][1]).toMatchObject({ baseSeq: 0 })
  })

  it('"…and comment" opens the thread’s form with the stance; the thread decides "Comment without a vote"', async () => {
    mocks.castVote.mockResolvedValueOnce({
      tabId: 't1',
      textSeq: 2,
      votes: votes({ myVote: 'disagree' }),
    })
    render(
      <BeliefTabs slug="quiet-fern" tabs={[tab('t1')]} onChanged={onChanged} />,
    )
    const plain = screen.getByRole('button', {
      name: 'Comment without a vote on “Title t1”',
    })
    expect(plain.hasAttribute('disabled')).toBe(true)
    fireEvent.click(
      screen.getByRole('button', { name: 'thread allows comments' }),
    )
    expect(plain.hasAttribute('disabled')).toBe(false)

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Disagree and comment on “Title t1”',
      }),
    )
    await waitFor(() =>
      expect(thread().compose).toMatchObject({ stance: 'disagree', nonce: 1 }),
    )
    fireEvent.click(plain)
    expect(thread().compose).toMatchObject({ nonce: 2 })
    expect(thread().compose?.stance).toBeUndefined()
  })

  it('opens the belief a link points to', () => {
    window.location.hash = '#belief-t2'
    render(
      <BeliefTabs
        slug="quiet-fern"
        tabs={[tab('t1'), tab('t2')]}
        onChanged={onChanged}
      />,
    )
    expect(thread().tabId).toBe('t2')
    expect(Element.prototype.scrollIntoView).toHaveBeenCalledTimes(1)
  })

  it('scrolls only once the linked panel is shown (fix round 1, LOW 1)', () => {
    const scrolled: Array<{ id: string; hidden: boolean }> = []
    Element.prototype.scrollIntoView = vi.fn(function (this: HTMLElement) {
      scrolled.push({ id: this.id, hidden: this.hidden === true })
    })
    window.location.hash = '#belief-t2'
    render(
      <BeliefTabs
        slug="quiet-fern"
        tabs={[tab('t1'), tab('t2')]}
        onChanged={onChanged}
      />,
    )
    expect(scrolled).toEqual([{ id: 'panel-t2', hidden: false }])
  })

  it('the badge of an open "…and comment" form follows a changed vote (fix round 1, LOW 5)', async () => {
    mocks.castVote
      .mockResolvedValueOnce({
        tabId: 't1',
        textSeq: 2,
        votes: votes({ myVote: 'agree' }),
      })
      .mockResolvedValueOnce({
        tabId: 't1',
        textSeq: 2,
        votes: votes({ myVote: 'disagree' }),
      })
    render(
      <BeliefTabs slug="quiet-fern" tabs={[tab('t1')]} onChanged={onChanged} />,
    )
    fireEvent.click(
      screen.getByRole('button', { name: 'Agree and comment on “Title t1”' }),
    )
    await waitFor(() =>
      expect(thread().compose).toMatchObject({ stance: 'agree', nonce: 1 }),
    )
    fireEvent.click(
      screen.getByRole('button', { name: 'Disagree with “Title t1”' }),
    )
    await waitFor(() =>
      expect(thread().compose).toEqual({
        tabId: 't1',
        stance: 'disagree',
        nonce: 1,
      }),
    )
  })

  it('a changed vote drops the badge when there is no vote left, and leaves a plain form alone', async () => {
    mocks.castVote.mockResolvedValueOnce({
      tabId: 't1',
      textSeq: 2,
      votes: votes({ myVote: 'agree' }),
    })
    const withdrawn = votes()
    render(
      <BeliefTabs
        slug="quiet-fern"
        tabs={[tab('t1', { votes: votes({ myVote: 'agree' }) })]}
        onChanged={onChanged}
      />,
    )
    fireEvent.click(
      screen.getByRole('button', { name: 'Agree and comment on “Title t1”' }),
    )
    await waitFor(() =>
      expect(thread().compose).toMatchObject({ stance: 'agree' }),
    )
    mocks.withdrawVote.mockResolvedValueOnce({
      withdrawn: true,
      tabId: 't1',
      textSeq: 2,
      votes: withdrawn,
    })
    fireEvent.click(
      screen.getByRole('button', { name: 'Agree with “Title t1”' }),
    )
    await waitFor(() =>
      expect(thread().compose).toEqual({ tabId: 't1', nonce: 1 }),
    )
    // A plain form: a vote does not add a badge to it.
    fireEvent.click(
      screen.getByRole('button', { name: 'thread allows comments' }),
    )
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Comment without a vote on “Title t1”',
      }),
    )
    mocks.castVote.mockResolvedValueOnce({
      tabId: 't1',
      textSeq: 2,
      votes: votes({ myVote: 'agree' }),
    })
    fireEvent.click(
      screen.getByRole('button', { name: 'Agree with “Title t1”' }),
    )
    await waitFor(() => expect(mocks.castVote).toHaveBeenCalledTimes(1))
    expect(thread().compose).toEqual({ tabId: 't1', nonce: 2 })
  })

  it('ignores a link to a belief not on the page, and other anchors', () => {
    for (const hash of ['#belief-gone', '#elsewhere']) {
      window.location.hash = hash
      render(
        <BeliefTabs
          slug="quiet-fern"
          tabs={[tab('t1'), tab('t2')]}
          onChanged={onChanged}
        />,
      )
      expect(thread().tabId).toBe('t1')
      cleanup()
    }
  })
})
