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
  it('starts from the page text, labels kept, and saves on top of what the page showed', async () => {
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
    expect(mocks.editBeliefTitle).toHaveBeenCalledWith(
      'tok',
      'tab_1',
      'New title',
      2,
    )
    expect(mocks.editBeliefText).toHaveBeenCalledWith(
      'tok',
      'tab_1',
      'I. Sky.\n\nSea and sand.',
      5,
    )
    expect(onChanged).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('textbox')).toBeNull()
  })

  it('says nothing was saved when nothing changed', async () => {
    mocks.editBeliefText.mockResolvedValue({ changed: false, seq: 5 })
    setup()
    openEditor()
    fireEvent.click(button('Save belief'))
    expect((await screen.findByRole('status')).textContent).toMatch(
      /Nothing changed/,
    )
    expect(onChanged).not.toHaveBeenCalled()
  })

  it('stops at a stale title and says to reload, saving no text', async () => {
    mocks.editBeliefTitle.mockRejectedValue(new Error(STALE))
    setup()
    openEditor()
    fireEvent.click(button('Save belief'))
    expect((await screen.findByRole('alert')).textContent).toBe(STALE)
    expect(mocks.editBeliefText).not.toHaveBeenCalled()
    expect(screen.getByRole('textbox', { name: 'Belief' })).toBeTruthy()
  })

  it('reloads when the title saved but the text was stale', async () => {
    mocks.editBeliefTitle.mockResolvedValue({ changed: true, seq: 3 })
    mocks.editBeliefText.mockRejectedValue(new Error(STALE))
    setup()
    openEditor()
    fireEvent.click(button('Save belief'))
    expect((await screen.findByRole('alert')).textContent).toBe(STALE)
    expect(onChanged).toHaveBeenCalledTimes(1)
  })

  it('does not reload when neither part saved', async () => {
    mocks.editBeliefText.mockRejectedValue(new Error(STALE))
    setup()
    openEditor()
    fireEvent.click(button('Save belief'))
    await screen.findByRole('alert')
    expect(onChanged).not.toHaveBeenCalled()
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
    openEditor()
    fireEvent.click(button('Save belief'))
    expect((await screen.findByRole('alert')).textContent).toMatch(
      /couldn't confirm/,
    )
    expect(mocks.editBeliefTitle).not.toHaveBeenCalled()
  })

  it('has a plain message for a failure that is not an error', async () => {
    mocks.editBeliefTitle.mockRejectedValue('odd')
    setup()
    openEditor()
    fireEvent.click(button('Save belief'))
    expect((await screen.findByRole('alert')).textContent).toBe(
      'Something went wrong.',
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
