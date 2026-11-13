// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { TabVotes } from '#/lib/votes-api'
import { VOTE_BLOCK_NOTES, VoteButtons } from './VoteButtons'

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

  it('takes a vote back on a belief the reader can no longer read, with nothing to show', async () => {
    renderButtons(votes({ myVote: 'agree' }))
    fireEvent.click(button('Agree with “Synthetic belief”'))
    await waitFor(() => expect(mocks.withdrawVote).toHaveBeenCalled())
    expect(onVotes).not.toHaveBeenCalled()
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
