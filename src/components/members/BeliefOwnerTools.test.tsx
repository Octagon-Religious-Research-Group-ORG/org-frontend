// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type * as MembersApi from '#/lib/members-api'
import { BELIEF_TOO_LONG, MAX_SAVED_TEXT } from '#/lib/members-api'
import type { BeliefTab } from '#/lib/members-api'
import { BeliefOwnerTools, REMOVE_EXPLAINED } from './BeliefOwnerTools'

const STALE =
  'This was changed in another window. Reload to see the latest before saving.'

const mocks = vi.hoisted(() => ({
  auth: { getToken: vi.fn() },
  editBeliefTitle: vi.fn(),
  editBeliefText: vi.fn(),
  moveBelief: vi.fn(),
  removeBelief: vi.fn(),
}))

vi.mock('#/lib/auth', () => ({ useOrgAuth: () => mocks.auth }))
vi.mock('#/lib/members-api', async (original) => ({
  ...(await original<typeof MembersApi>()),
  editBeliefTitle: mocks.editBeliefTitle,
  editBeliefText: mocks.editBeliefText,
  moveBelief: mocks.moveBelief,
  removeBelief: mocks.removeBelief,
}))

const tab: BeliefTab = {
  tabId: 'tab_1',
  title: 'Synthetic title',
  needsReview: false,
  paragraphs: [
    { blockId: 'b1', kind: 'outline-item', label: 'I.', text: 'Sky.' },
    { blockId: 'b2', kind: 'paragraph', label: '', text: 'Sea.' },
  ],
}

const onChanged = vi.fn()

function setup(
  props: Partial<{ isFirst: boolean; isLast: boolean; isOnly: boolean }> = {},
) {
  return render(
    <BeliefOwnerTools
      tab={tab}
      revision={{ text: 5, title: 2 }}
      isFirst={false}
      isLast={false}
      isOnly={false}
      onChanged={onChanged}
      {...props}
    />,
  )
}

const button = (name: string | RegExp) =>
  screen.getByRole<HTMLButtonElement>('button', { name })

function openEditor() {
  fireEvent.click(button('Edit belief'))
  return {
    title: screen.getByRole<HTMLInputElement>('textbox', { name: 'Title' }),
    text: screen.getByRole<HTMLTextAreaElement>('textbox', { name: 'Belief' }),
  }
}

beforeEach(() => {
  mocks.auth.getToken.mockReset().mockResolvedValue('tok')
  mocks.editBeliefTitle
    .mockReset()
    .mockResolvedValue({ changed: false, seq: 2 })
  mocks.editBeliefText.mockReset().mockResolvedValue({ changed: true, seq: 6 })
  mocks.moveBelief.mockReset().mockResolvedValue({ moved: true })
  mocks.removeBelief.mockReset().mockResolvedValue({ removed: true })
  onChanged.mockClear()
})

afterEach(cleanup)

describe('editing a belief', () => {
  it('starts from the page text, labels kept, and saves the text, then the title, on top of what the page showed', async () => {
    mocks.editBeliefTitle.mockResolvedValue({ changed: true, seq: 3 })
    setup()
    const { title, text } = openEditor()
    expect(title.value).toBe('Synthetic title')
    expect(text.value).toBe('I. Sky.\n\nSea.')
    fireEvent.change(title, { target: { value: 'New title' } })
    fireEvent.change(text, { target: { value: 'I. Sky.\n\nSea and sand.' } })
    fireEvent.click(button('Save belief'))
    expect((await screen.findByRole('status')).textContent).toMatch(
      /earlier version is in the history/,
    )
    expect(mocks.editBeliefText).toHaveBeenCalledWith(
      'tok',
      'tab_1',
      'I. Sky.\n\nSea and sand.',
      5,
    )
    expect(mocks.editBeliefTitle).toHaveBeenCalledWith(
      'tok',
      'tab_1',
      'New title',
      2,
    )
    expect(mocks.editBeliefText.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.editBeliefTitle.mock.invocationCallOrder[0],
    )
    expect(onChanged).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('textbox')).toBeNull()
  })

  it('sends nothing when nothing was typed', async () => {
    setup()
    openEditor()
    fireEvent.click(button('Save belief'))
    expect((await screen.findByRole('status')).textContent).toMatch(
      /Nothing changed/,
    )
    expect(mocks.editBeliefText).not.toHaveBeenCalled()
    expect(mocks.editBeliefTitle).not.toHaveBeenCalled()
    expect(onChanged).not.toHaveBeenCalled()
  })

  it('sends only the title when only the title changed', async () => {
    mocks.editBeliefTitle.mockResolvedValue({ changed: true, seq: 3 })
    setup()
    fireEvent.change(openEditor().title, { target: { value: 'Renamed' } })
    fireEvent.click(button('Save belief'))
    await screen.findByRole('status')
    expect(mocks.editBeliefText).not.toHaveBeenCalled()
    expect(onChanged).toHaveBeenCalledTimes(1)
  })

  it('says nothing changed when the server found the text the same', async () => {
    mocks.editBeliefText.mockResolvedValue({ changed: false, seq: 5 })
    setup()
    fireEvent.change(openEditor().text, {
      target: { value: 'I. Sky.\n\n\n\nSea.' },
    })
    fireEvent.click(button('Save belief'))
    expect((await screen.findByRole('status')).textContent).toMatch(
      /Nothing changed/,
    )
    expect(onChanged).not.toHaveBeenCalled()
  })

  it('stops at a stale text, saves no title, and keeps what was typed', async () => {
    mocks.editBeliefText.mockRejectedValue(new Error(STALE))
    setup()
    const { title, text } = openEditor()
    fireEvent.change(title, { target: { value: 'Typed title' } })
    fireEvent.change(text, { target: { value: 'Typed text' } })
    fireEvent.click(button('Save belief'))
    expect((await screen.findByRole('alert')).textContent).toBe(
      `Nothing was saved. ${STALE}`,
    )
    expect(mocks.editBeliefTitle).not.toHaveBeenCalled()
    expect(onChanged).not.toHaveBeenCalled()
    expect(
      screen.getByRole<HTMLInputElement>('textbox', { name: 'Title' }).value,
    ).toBe('Typed title')
    expect(
      screen.getByRole<HTMLTextAreaElement>('textbox', { name: 'Belief' })
        .value,
    ).toBe('Typed text')
  })

  it('says exactly which part was saved when the title fails after the text', async () => {
    mocks.editBeliefTitle.mockRejectedValue(new Error(STALE))
    setup()
    const { title, text } = openEditor()
    fireEvent.change(title, { target: { value: 'Typed title' } })
    fireEvent.change(text, { target: { value: 'Typed text' } })
    fireEvent.click(button('Save belief'))
    expect((await screen.findByRole('alert')).textContent).toBe(
      `Your belief text was saved, but the title was not. ${STALE}`,
    )
    expect(onChanged).toHaveBeenCalledTimes(1)
    expect(
      screen.getByRole<HTMLInputElement>('textbox', { name: 'Title' }).value,
    ).toBe('Typed title')
  })

  it('says nothing was saved when the title fails and the text was the same', async () => {
    mocks.editBeliefText.mockResolvedValue({ changed: false, seq: 5 })
    mocks.editBeliefTitle.mockRejectedValue(new Error(STALE))
    setup()
    const { title, text } = openEditor()
    fireEvent.change(title, { target: { value: 'Typed title' } })
    fireEvent.change(text, { target: { value: 'I. Sky.\n\n\nSea.' } })
    fireEvent.click(button('Save belief'))
    expect((await screen.findByRole('alert')).textContent).toBe(
      `Nothing was saved. ${STALE}`,
    )
    expect(onChanged).not.toHaveBeenCalled()
  })

  describe('a belief longer than one save', () => {
    const long = 'x'.repeat(MAX_SAVED_TEXT + 1)

    it('counts characters as the member types', () => {
      setup()
      const { text } = openEditor()
      expect(screen.getByText('13 / 20,000 characters')).toBeTruthy()
      fireEvent.change(text, { target: { value: long } })
      expect(
        screen.getByText('20,001 / 20,000 characters (too long for one save)'),
      ).toBeTruthy()
      expect(text.getAttribute('aria-describedby')).toBe('count-tab_1')
    })

    it('explains the limit before sending a changed one', async () => {
      setup()
      fireEvent.change(openEditor().text, { target: { value: long } })
      fireEvent.click(button('Save belief'))
      expect((await screen.findByRole('alert')).textContent).toBe(
        BELIEF_TOO_LONG,
      )
      expect(mocks.editBeliefText).not.toHaveBeenCalled()
    })

    it('saves an unchanged long one as no change, with no error', async () => {
      render(
        <BeliefOwnerTools
          tab={{
            ...tab,
            paragraphs: [
              { blockId: 'b', kind: 'paragraph', label: '', text: long },
            ],
          }}
          revision={{ text: 1, title: 0 }}
          isFirst={false}
          isLast={false}
          isOnly={false}
          onChanged={onChanged}
        />,
      )
      openEditor()
      fireEvent.click(button('Save belief'))
      expect((await screen.findByRole('status')).textContent).toMatch(
        /Nothing changed/,
      )
      expect(screen.queryByRole('alert')).toBeNull()
      expect(mocks.editBeliefText).not.toHaveBeenCalled()
    })
  })

  it('cancels, and a new edit starts from the page again', () => {
    setup()
    const { text } = openEditor()
    fireEvent.change(text, { target: { value: 'draft' } })
    fireEvent.click(button('Cancel'))
    expect(screen.queryByRole('textbox')).toBeNull()
    expect(openEditor().text.value).toBe('I. Sky.\n\nSea.')
  })

  it('refuses to send anything when the sign-in cannot be confirmed', async () => {
    mocks.auth.getToken.mockResolvedValue(null)
    setup()
    fireEvent.change(openEditor().text, { target: { value: 'Changed' } })
    fireEvent.click(button('Save belief'))
    expect((await screen.findByRole('alert')).textContent).toMatch(
      /couldn't confirm/,
    )
    expect(mocks.editBeliefText).not.toHaveBeenCalled()
  })

  it('has a plain message for a failure that is not an error', async () => {
    mocks.editBeliefTitle.mockRejectedValue('odd')
    setup()
    fireEvent.change(openEditor().title, { target: { value: 'Other' } })
    fireEvent.click(button('Save belief'))
    expect((await screen.findByRole('alert')).textContent).toBe(
      'Nothing was saved. Something went wrong.',
    )
  })
})

describe('moving a belief', () => {
  it('moves earlier and later, then reloads', async () => {
    setup()
    fireEvent.click(button('Move earlier'))
    await waitFor(() => expect(onChanged).toHaveBeenCalledTimes(1))
    expect(mocks.moveBelief).toHaveBeenCalledWith('tok', 'tab_1', 'up')
    fireEvent.click(button('Move later'))
    await waitFor(() => expect(onChanged).toHaveBeenCalledTimes(2))
    expect(mocks.moveBelief).toHaveBeenLastCalledWith('tok', 'tab_1', 'down')
  })

  it('cannot move the first earlier or the last later', () => {
    setup({ isFirst: true, isLast: true })
    expect(button('Move earlier').disabled).toBe(true)
    expect(button('Move later').disabled).toBe(true)
  })

  it('shows a refused move and does not reload', async () => {
    mocks.moveBelief.mockRejectedValue(new Error('rearranged elsewhere'))
    setup()
    fireEvent.click(button('Move later'))
    expect((await screen.findByRole('alert')).textContent).toBe(
      'rearranged elsewhere',
    )
    expect(onChanged).not.toHaveBeenCalled()
  })
})

describe('removing a belief', () => {
  it('asks first, saying ORG keeps the text, and removes only on yes', async () => {
    setup()
    fireEvent.click(button('Remove belief'))
    const dialog = screen.getByRole('alertdialog', {
      name: 'Remove “Synthetic title” from your page?',
    })
    expect(dialog.textContent).toContain(REMOVE_EXPLAINED)
    expect(REMOVE_EXPLAINED).toMatch(/ORG keeps its text/)
    expect(mocks.removeBelief).not.toHaveBeenCalled()
    fireEvent.click(button('Yes, remove it'))
    await waitFor(() => expect(onChanged).toHaveBeenCalled())
    expect(mocks.removeBelief).toHaveBeenCalledWith('tok', 'tab_1')
    expect(screen.queryByRole('alertdialog')).toBeNull()
  })

  it('keeps it when the owner changes their mind', () => {
    setup()
    fireEvent.click(button('Remove belief'))
    fireEvent.click(button('Keep it'))
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(mocks.removeBelief).not.toHaveBeenCalled()
  })

  it('shows the server refusing the last belief, and keeps the question open', async () => {
    mocks.removeBelief.mockRejectedValue(
      new Error('A page needs at least one belief.'),
    )
    setup()
    fireEvent.click(button('Remove belief'))
    fireEvent.click(button('Yes, remove it'))
    expect((await screen.findByRole('alert')).textContent).toMatch(
      /at least one belief/,
    )
    expect(screen.getByRole('alertdialog')).toBeTruthy()
    expect(onChanged).not.toHaveBeenCalled()
  })

  it('does not offer to remove the only belief, and says why', () => {
    setup({ isOnly: true })
    expect(button('Remove belief').disabled).toBe(true)
    expect(screen.getByText(/This is your only belief/)).toBeTruthy()
  })
})
