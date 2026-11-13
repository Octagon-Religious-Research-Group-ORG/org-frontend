// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '#/lib/api'
import type { TabVotes } from '#/lib/votes-api'
import { VOTE_BLOCK_NOTES, VoteButtons } from './VoteButtons'

const mocks = vi.hoisted(() => ({
  auth: { isLoading: false, isAuthenticated: true, getToken: vi.fn() },
  castVote: vi.fn(),
  withdrawVote: vi.fn(),
  castOrgPageVote: vi.fn(),
  withdrawOrgPageVote: vi.fn(),
}))

vi.mock('#/lib/auth', () => ({ useOrgAuth: () => mocks.auth }))
vi.mock('#/lib/votes-api', async (original) => ({
  ...(await original<object>()),
  castVote: mocks.castVote,
  withdrawVote: mocks.withdrawVote,
  castOrgPageVote: mocks.castOrgPageVote,
  withdrawOrgPageVote: mocks.withdrawOrgPageVote,
}))

const votes = (overrides: Partial<TabVotes> = {}): TabVotes => ({
  agree: 2,
  disagree: 1,
  earlierWording: 0,
  mayVote: true,
  ...overrides,
})

const onVotes = vi.fn()
const onCompose = vi.fn()

function renderButtons(
  current: TabVotes,
  comment: { mayComment: boolean; reason?: string } | undefined = {
    mayComment: true,
  },
) {
  return render(
    <VoteButtons
      slug="quiet-fern"
      tabId="tab_1"
      title="Synthetic belief"
      textSeq={3}
      votes={current}
      comment={comment}
      onVotes={onVotes}
      onCompose={onCompose}
    />,
  )
}

const button = (name: string) => screen.getByRole('button', { name })

beforeEach(() => {
  mocks.auth.getToken.mockReset().mockResolvedValue('tok')
  mocks.castVote.mockReset().mockResolvedValue({
    tabId: 'tab_1',
    textSeq: 3,
    votes: votes({ agree: 3, myVote: 'agree' }),
  })
  mocks.withdrawVote.mockReset().mockResolvedValue({ withdrawn: true })
  onVotes.mockClear()
  onCompose.mockClear()
})

afterEach(cleanup)

describe('VoteButtons', () => {
  it('names each of the five buttons with the belief, and announces the counts politely', () => {
    renderButtons(votes({ earlierWording: 2 }))
    for (const name of [
      'Agree with “Synthetic belief”',
      'Disagree with “Synthetic belief”',
      'Agree and comment on “Synthetic belief”',
      'Disagree and comment on “Synthetic belief”',
      'Comment without a vote on “Synthetic belief”',
    ]) {
      expect(button(name).hasAttribute('disabled')).toBe(false)
    }
    const counts = screen.getByRole('status')
    expect(counts.getAttribute('aria-live')).toBe('polite')
    expect(counts.textContent).toBe(
      '2 agree · 1 disagree(2 votes on an earlier wording)',
    )
    expect(
      screen.getByRole('group', { name: 'Votes on “Synthetic belief”' }),
    ).toBeTruthy()
  })

  it('casts on the wording shown, and says the new counts', async () => {
    renderButtons(votes())
    expect(
      button('Agree with “Synthetic belief”').getAttribute('aria-pressed'),
    ).toBe('false')
    fireEvent.click(button('Agree with “Synthetic belief”'))
    await waitFor(() => expect(onVotes).toHaveBeenCalled())
    expect(mocks.castVote).toHaveBeenCalledWith('tok', {
      slug: 'quiet-fern',
      tabId: 'tab_1',
      value: 'agree',
      baseSeq: 3,
    })
    expect(onVotes.mock.calls[0][0]).toMatchObject({ textSeq: 3 })
  })

  it('shows the reader’s vote pressed, and pressing it again takes it back', async () => {
    mocks.withdrawVote.mockResolvedValueOnce({
      withdrawn: true,
      tabId: 'tab_1',
      textSeq: 3,
      votes: votes({ agree: 1 }),
    })
    renderButtons(votes({ myVote: 'disagree' }))
    const disagree = button('Disagree with “Synthetic belief”')
    expect(disagree.getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByText(/Press Disagree again/)).toBeTruthy()
    fireEvent.click(disagree)
    await waitFor(() => expect(onVotes).toHaveBeenCalled())
    expect(mocks.withdrawVote).toHaveBeenCalledWith('tok', {
      slug: 'quiet-fern',
      tabId: 'tab_1',
    })
    expect(onVotes).toHaveBeenCalledWith({
      votes: votes({ agree: 1 }),
      textSeq: 3,
    })
  })

  it('takes a vote back on a belief the reader can no longer read: unpressed here, counts marked old (fix round 1, LOW 4)', async () => {
    renderButtons(votes({ myVote: 'agree', myVoteOnEarlierWording: 'agree' }))
    fireEvent.click(button('Agree with “Synthetic belief”'))
    await waitFor(() => expect(onVotes).toHaveBeenCalled())
    expect(onVotes).toHaveBeenCalledWith({
      votes: votes(),
      textSeq: 3,
    })
    expect(screen.getByText(/Your vote was taken back/)).toBeTruthy()
  })

  it('keeps the note while the page shows the votes it handed up, and drops it when the page brings fresh ones (fix round 3, N2)', async () => {
    const props = {
      slug: 'quiet-fern',
      tabId: 'tab_1',
      title: 'Synthetic belief',
      textSeq: 3,
      comment: { mayComment: true },
      onVotes,
      onCompose,
    }
    const { rerender } = render(
      <VoteButtons {...props} votes={votes({ myVote: 'agree' })} />,
    )
    fireEvent.click(button('Agree with “Synthetic belief”'))
    await screen.findByText(/Your vote was taken back/)
    // The page passes back exactly what the buttons handed up.
    const handed = (onVotes.mock.calls[0][0] as { votes: TabVotes }).votes
    rerender(<VoteButtons {...props} votes={handed} />)
    expect(screen.getByText(/Your vote was taken back/)).toBeTruthy()
    // The page is read again (onChanged): fresh votes, same key.
    rerender(<VoteButtons {...props} votes={votes({ agree: 1 })} />)
    await waitFor(() =>
      expect(screen.queryByText(/Your vote was taken back/)).toBeNull(),
    )
  })

  it('drops the "counts are from before" note once fresh counts arrive (fix round 2, item a)', async () => {
    const { rerender } = renderButtons(votes({ myVote: 'agree' }))
    fireEvent.click(button('Agree with “Synthetic belief”'))
    await screen.findByText(/Your vote was taken back/)
    const props = {
      slug: 'quiet-fern',
      tabId: 'tab_1',
      title: 'Synthetic belief',
      textSeq: 3,
      comment: { mayComment: true },
      onVotes,
      onCompose,
    }
    // After a cast.
    rerender(<VoteButtons {...props} votes={votes()} />)
    fireEvent.click(button('Agree with “Synthetic belief”'))
    await waitFor(() =>
      expect(screen.queryByText(/Your vote was taken back/)).toBeNull(),
    )
    // After a withdrawal that brings the counts.
    mocks.withdrawVote.mockResolvedValueOnce({ withdrawn: true })
    rerender(<VoteButtons {...props} votes={votes({ myVote: 'agree' })} />)
    fireEvent.click(button('Agree with “Synthetic belief”'))
    await screen.findByText(/Your vote was taken back/)
    mocks.withdrawVote.mockResolvedValueOnce({
      withdrawn: true,
      tabId: 'tab_1',
      textSeq: 3,
      votes: votes({ agree: 1 }),
    })
    rerender(<VoteButtons {...props} votes={votes({ myVote: 'agree' })} />)
    fireEvent.click(button('Agree with “Synthetic belief”'))
    await waitFor(() =>
      expect(screen.queryByText(/Your vote was taken back/)).toBeNull(),
    )
  })

  it('does nothing more when a withdrawal is refused', async () => {
    mocks.withdrawVote.mockRejectedValueOnce(new Error('Try again.'))
    renderButtons(votes({ myVote: 'agree' }))
    fireEvent.click(button('Agree with “Synthetic belief”'))
    expect(await screen.findByRole('alert')).toHaveProperty(
      'textContent',
      'Try again.',
    )
    expect(onVotes).not.toHaveBeenCalled()
  })

  it('removes a vote kept only on an earlier wording (fix round 1, LOW 7)', async () => {
    mocks.withdrawVote.mockResolvedValueOnce({
      withdrawn: true,
      tabId: 'tab_1',
      textSeq: 3,
      votes: votes({ earlierWording: 0 }),
    })
    renderButtons(
      votes({
        mayVote: false,
        viewerVoteBlock: 'anonymous-off',
        myVoteOnEarlierWording: 'disagree',
        earlierWording: 1,
      }),
    )
    // Removing needs no right to vote now; confirming does.
    expect(
      button('Confirm my vote on the new wording').hasAttribute('disabled'),
    ).toBe(true)
    fireEvent.click(button('Remove my earlier vote'))
    await waitFor(() => expect(onVotes).toHaveBeenCalled())
    expect(mocks.withdrawVote).toHaveBeenCalledWith('tok', {
      slug: 'quiet-fern',
      tabId: 'tab_1',
    })
  })

  it('lets a reader who may not vote now still take back their vote', () => {
    renderButtons(
      votes({
        myVote: 'agree',
        mayVote: false,
        viewerVoteBlock: 'anonymous-off',
      }),
    )
    expect(
      button('Agree with “Synthetic belief”').hasAttribute('disabled'),
    ).toBe(false)
    expect(
      button('Disagree with “Synthetic belief”').hasAttribute('disabled'),
    ).toBe(true)
  })

  it('keeps the old wording when a withdrawal answer has no text version', async () => {
    mocks.withdrawVote.mockResolvedValueOnce({
      withdrawn: true,
      votes: votes({ agree: 1 }),
    })
    renderButtons(votes({ myVote: 'agree' }))
    fireEvent.click(button('Agree with “Synthetic belief”'))
    await waitFor(() => expect(onVotes).toHaveBeenCalled())
    expect(onVotes.mock.calls[0][0]).toMatchObject({ textSeq: 3 })
  })

  it('"…and comment" votes first, then opens the form with that stance', async () => {
    renderButtons(votes())
    fireEvent.click(button('Disagree and comment on “Synthetic belief”'))
    await waitFor(() => expect(onCompose).toHaveBeenCalledWith('disagree'))
    expect(mocks.castVote.mock.calls[0][1]).toMatchObject({ value: 'disagree' })
  })

  it('"…and comment" with the same vote already cast just opens the form', () => {
    renderButtons(votes({ myVote: 'agree' }))
    fireEvent.click(button('Agree and comment on “Synthetic belief”'))
    expect(onCompose).toHaveBeenCalledWith('agree')
    expect(mocks.castVote).not.toHaveBeenCalled()
  })

  it('opens no form when the vote was refused, and says why', async () => {
    mocks.castVote.mockRejectedValueOnce(new Error('This belief was reworded.'))
    renderButtons(votes())
    fireEvent.click(button('Agree and comment on “Synthetic belief”'))
    expect(await screen.findByRole('alert')).toHaveProperty(
      'textContent',
      'This belief was reworded.',
    )
    expect(onCompose).not.toHaveBeenCalled()
  })

  it('"Comment without a vote" opens a plain form', () => {
    renderButtons(votes())
    fireEvent.click(button('Comment without a vote on “Synthetic belief”'))
    expect(onCompose).toHaveBeenCalledWith()
  })

  it('offers a one-click confirm for a vote on an earlier wording', async () => {
    renderButtons(votes({ myVoteOnEarlierWording: 'agree', earlierWording: 1 }))
    expect(
      screen.getByText(/on an earlier wording of this belief/),
    ).toBeTruthy()
    fireEvent.click(button('Confirm my vote on the new wording'))
    await waitFor(() => expect(onVotes).toHaveBeenCalled())
    expect(mocks.castVote.mock.calls[0][1]).toEqual({
      slug: 'quiet-fern',
      tabId: 'tab_1',
      value: 'agree',
      baseSeq: 3,
    })
  })

  it.each(Object.entries(VOTE_BLOCK_NOTES))(
    'disables the vote buttons with a plain reason: %s',
    (block, note) => {
      renderButtons(
        votes({ mayVote: false, viewerVoteBlock: block as never }),
        { mayComment: false, reason: 'No comments for you.' },
      )
      for (const name of [
        'Agree with “Synthetic belief”',
        'Disagree with “Synthetic belief”',
        'Agree and comment on “Synthetic belief”',
        'Disagree and comment on “Synthetic belief”',
        'Comment without a vote on “Synthetic belief”',
      ]) {
        expect(button(name).hasAttribute('disabled')).toBe(true)
      }
      expect(screen.getByText(note)).toBeTruthy()
      expect(screen.getByText('No comments for you.')).toBeTruthy()
    },
  )

  it('keeps "Comment without a vote" off until the thread says, and with no reason given', () => {
    render(
      <VoteButtons
        slug="quiet-fern"
        tabId="tab_1"
        title="Synthetic belief"
        textSeq={3}
        votes={votes({ mayVote: false })}
        onVotes={onVotes}
        onCompose={onCompose}
      />,
    )
    expect(
      button('Comment without a vote on “Synthetic belief”').hasAttribute(
        'disabled',
      ),
    ).toBe(true)
    cleanup()
    renderButtons(votes({ mayVote: false }), { mayComment: false })
    expect(
      button('Comment without a vote on “Synthetic belief”').hasAttribute(
        'disabled',
      ),
    ).toBe(true)
  })

  describe('on one of ORG’s own pages (Chunk 10b)', () => {
    const renderOrg = (current: TabVotes) =>
      render(
        <VoteButtons
          orgPageId="about"
          title="About Us"
          textSeq={2}
          votes={current}
          comment={{ mayComment: true }}
          onVotes={onVotes}
          onCompose={onCompose}
        />,
      )

    it('casts on the revision shown and hands up the page’s votes', async () => {
      mocks.castOrgPageVote.mockResolvedValueOnce({
        pageId: 'about',
        revision: 2,
        votes: votes({ agree: 3, myVote: 'agree' }),
      })
      renderOrg(votes())
      fireEvent.click(button('Agree with “About Us”'))
      await waitFor(() =>
        expect(onVotes).toHaveBeenCalledWith({
          textSeq: 2,
          votes: votes({ agree: 3, myVote: 'agree' }),
        }),
      )
      expect(mocks.castOrgPageVote).toHaveBeenCalledWith('tok', 'about', {
        value: 'agree',
        baseSeq: 2,
      })
      expect(mocks.castVote).not.toHaveBeenCalled()
    })

    it('takes the vote back and speaks of the page, not a belief', async () => {
      mocks.withdrawOrgPageVote.mockResolvedValueOnce({
        withdrawn: true,
        pageId: 'about',
        revision: 2,
        votes: votes(),
      })
      renderOrg(votes({ myVote: 'disagree' }))
      expect(screen.getByText(/You disagree with this page./)).toBeTruthy()
      fireEvent.click(button('Disagree with “About Us”'))
      await waitFor(() =>
        expect(onVotes).toHaveBeenCalledWith({ textSeq: 2, votes: votes() }),
      )
      expect(mocks.withdrawOrgPageVote).toHaveBeenCalledWith('tok', 'about')
      expect(mocks.withdrawVote).not.toHaveBeenCalled()
    })

    it('tells the page when a vote is refused as stale, and only then (round 2, N1)', async () => {
      const onStale = vi.fn()
      render(
        <VoteButtons
          orgPageId="about"
          title="About Us"
          textSeq={2}
          votes={votes()}
          onVotes={onVotes}
          onCompose={onCompose}
          onStale={onStale}
        />,
      )
      mocks.castOrgPageVote.mockRejectedValueOnce(new ApiError('Busy.', 500))
      fireEvent.click(button('Agree with “About Us”'))
      expect(await screen.findByText('Busy.')).toBeTruthy()
      expect(onStale).not.toHaveBeenCalled()
      mocks.castOrgPageVote.mockRejectedValueOnce(
        new ApiError('This page was updated.', 409),
      )
      fireEvent.click(button('Agree with “About Us”'))
      expect(await screen.findByText('This page was updated.')).toBeTruthy()
      expect(onStale).toHaveBeenCalledTimes(1)
      expect(onVotes).not.toHaveBeenCalled()
    })

    it('shows a stale refusal even with nobody to tell', async () => {
      mocks.castOrgPageVote.mockRejectedValueOnce(
        new ApiError('This page was updated.', 409),
      )
      renderOrg(votes())
      fireEvent.click(button('Agree with “About Us”'))
      expect(await screen.findByText('This page was updated.')).toBeTruthy()
    })

    it('clears the pressed vote when the page is no longer published (review LOW 4)', async () => {
      mocks.withdrawOrgPageVote.mockResolvedValueOnce({ withdrawn: true })
      renderOrg(votes({ myVote: 'agree' }))
      fireEvent.click(button('Agree with “About Us”'))
      await waitFor(() =>
        expect(onVotes).toHaveBeenCalledWith({ textSeq: 2, votes: votes() }),
      )
      expect(
        await screen.findByText(/counts above are from before/),
      ).toBeTruthy()
    })

    it('calls an earlier vote one on an earlier version of this page', () => {
      renderOrg(votes({ earlierWording: 1, myVoteOnEarlierWording: 'agree' }))
      expect(screen.getByText('(1 vote on an earlier version)')).toBeTruthy()
      expect(
        screen.getByText(
          /You voted “agree” on an earlier version of this page, so your vote is not counted/,
        ),
      ).toBeTruthy()
      expect(
        button('Confirm my vote on the new version').hasAttribute('disabled'),
      ).toBe(false)
    })
  })

  it('never offers the confirm next to a vote already on this wording', () => {
    renderButtons(
      votes({ myVote: 'agree', myVoteOnEarlierWording: 'disagree' }),
    )
    expect(
      screen.queryByRole('button', {
        name: 'Confirm my vote on the new wording',
      }),
    ).toBeNull()
  })
})
