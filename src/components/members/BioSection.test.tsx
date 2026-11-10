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
import { BioSection } from './BioSection'
import { RemovedBeliefs } from './RemovedBeliefs'

const mocks = vi.hoisted(() => ({
  auth: { getToken: vi.fn() },
  editBio: vi.fn(),
}))

vi.mock('#/lib/auth', () => ({ useOrgAuth: () => mocks.auth }))
vi.mock('#/lib/members-api', async (original) => ({
  ...(await original<typeof MembersApi>()),
  editBio: mocks.editBio,
}))
vi.mock('./HistoryPanel', async (original) => ({
  ...(await original<object>()),
  HistoryPanel: (props: {
    tabId?: string
    label: string
    onClose: () => void
  }) => (
    <div data-testid="history">
      history {props.tabId ?? 'bio'} {props.label}
      <button type="button" onClick={props.onClose}>
        close stub
      </button>
    </div>
  ),
}))

const bio = [
  { blockId: 'b1', kind: 'paragraph' as const, label: '', text: 'First.' },
  { blockId: 'b2', kind: 'paragraph' as const, label: '', text: 'Second.' },
]
const onChanged = vi.fn()

beforeEach(() => {
  mocks.auth.getToken.mockReset().mockResolvedValue('tok')
  mocks.editBio.mockReset().mockResolvedValue({ changed: true, seq: 4 })
  onChanged.mockClear()
})

afterEach(cleanup)

const button = (name: string) =>
  screen.getByRole<HTMLButtonElement>('button', { name })

describe('BioSection', () => {
  it('shows nothing for a page with no bio to a reader', () => {
    const { container } = render(<BioSection slug="quiet-fern" bio={[]} />)
    expect(container.textContent).toBe('')
  })

  it('lets a reader open and close the bio history, but not edit', () => {
    render(<BioSection slug="quiet-fern" bio={bio} />)
    expect(screen.queryByRole('button', { name: 'Edit bio' })).toBeNull()
    fireEvent.click(button('Bio history'))
    expect(screen.getByTestId('history').textContent).toContain(
      'history bio the bio',
    )
    fireEvent.click(button('close stub'))
    expect(screen.queryByTestId('history')).toBeNull()
    fireEvent.click(button('Bio history'))
    fireEvent.click(button('Bio history'))
    expect(screen.queryByTestId('history')).toBeNull()
  })

  it('lets the owner write a bio on a page that has none, with no empty history', () => {
    render(
      <BioSection
        slug="quiet-fern"
        bio={[]}
        owner={{ baseSeq: 0, onChanged }}
      />,
    )
    expect(screen.queryByRole('button', { name: 'Bio history' })).toBeNull()
    fireEvent.click(button('Edit bio'))
    expect(screen.getByRole<HTMLTextAreaElement>('textbox').value).toBe('')
  })

  it('saves the owner’s bio on top of the version the page showed, then reloads', async () => {
    render(
      <BioSection
        slug="quiet-fern"
        bio={bio}
        owner={{ baseSeq: 3, onChanged }}
      />,
    )
    fireEvent.click(button('Edit bio'))
    const box = screen.getByRole<HTMLTextAreaElement>('textbox')
    expect(box.value).toBe('First.\n\nSecond.')
    fireEvent.change(box, { target: { value: 'First.\n\nThird.' } })
    fireEvent.click(button('Save bio'))
    expect((await screen.findByRole('status')).textContent).toMatch(
      /earlier version is in the history/,
    )
    expect(mocks.editBio).toHaveBeenCalledWith('tok', 'First.\n\nThird.', 3)
    expect(onChanged).toHaveBeenCalled()
    expect(screen.queryByRole('textbox')).toBeNull()
  })

  it('closes quietly when nothing changed', async () => {
    mocks.editBio.mockResolvedValue({ changed: false, seq: 3 })
    render(
      <BioSection
        slug="quiet-fern"
        bio={bio}
        owner={{ baseSeq: 3, onChanged }}
      />,
    )
    fireEvent.click(button('Edit bio'))
    fireEvent.click(button('Save bio'))
    await waitFor(() => expect(screen.queryByRole('textbox')).toBeNull())
    expect(onChanged).not.toHaveBeenCalled()
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('keeps the editor open with the server’s words when the bio moved on', async () => {
    mocks.editBio.mockRejectedValue(
      new Error('This was changed in another window.'),
    )
    render(
      <BioSection
        slug="quiet-fern"
        bio={bio}
        owner={{ baseSeq: 3, onChanged }}
      />,
    )
    fireEvent.click(button('Edit bio'))
    fireEvent.click(button('Save bio'))
    expect((await screen.findByRole('alert')).textContent).toMatch(
      /another window/,
    )
    expect(screen.getByRole('textbox')).toBeTruthy()
  })

  it('cancels without saving', () => {
    render(
      <BioSection
        slug="quiet-fern"
        bio={bio}
        owner={{ baseSeq: 3, onChanged }}
      />,
    )
    fireEvent.click(button('Edit bio'))
    fireEvent.click(button('Cancel'))
    expect(screen.queryByRole('textbox')).toBeNull()
    expect(mocks.editBio).not.toHaveBeenCalled()
  })
})

describe('RemovedBeliefs', () => {
  it('lists removed beliefs with when, and opens their history', () => {
    render(
      <RemovedBeliefs
        slug="quiet-fern"
        tabs={[
          {
            tabId: 'tab_gone',
            title: 'An old belief',
            removedAt: '2026-11-02T09:15:00.000Z',
          },
        ]}
      />,
    )
    expect(screen.getByText('An old belief')).toBeTruthy()
    expect(screen.getByText('removed Nov 2, 2026, 9:15 AM UTC')).toBeTruthy()
    expect(screen.getByText(/only you and the admins/)).toBeTruthy()
    fireEvent.click(button('History'))
    expect(screen.getByTestId('history').textContent).toContain(
      'history tab_gone “An old belief”',
    )
    fireEvent.click(button('History'))
    expect(screen.queryByTestId('history')).toBeNull()
    fireEvent.click(button('History'))
    fireEvent.click(button('close stub'))
    expect(screen.queryByTestId('history')).toBeNull()
  })
})
