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
import { OwnerTools } from './OwnerTools'

const mocks = vi.hoisted(() => ({
  auth: { getToken: vi.fn() },
  changeVisibility: vi.fn(),
  addBeliefTab: vi.fn(),
  uploadProfilePicture: vi.fn(),
}))

vi.mock('#/lib/auth', () => ({ useOrgAuth: () => mocks.auth }))
vi.mock('#/lib/members-api', async (original) => ({
  ...(await original<typeof MembersApi>()),
  changeVisibility: mocks.changeVisibility,
  addBeliefTab: mocks.addBeliefTab,
  uploadProfilePicture: mocks.uploadProfilePicture,
}))

const onChanged = vi.fn()

function setup() {
  const view = render(<OwnerTools visibility="members" onChanged={onChanged} />)
  const fileInput = view.container.querySelector(
    'input[type=file]',
  ) as HTMLInputElement
  return { ...view, fileInput }
}

function fileEvent(files: Array<File>) {
  return { target: { files, value: '' } }
}

beforeEach(() => {
  mocks.auth.getToken.mockReset().mockResolvedValue('tok')
  mocks.changeVisibility.mockReset().mockResolvedValue({})
  mocks.addBeliefTab.mockReset().mockResolvedValue({})
  mocks.uploadProfilePicture.mockReset().mockResolvedValue({})
  onChanged.mockClear()
})

afterEach(cleanup)

describe('OwnerTools', () => {
  it('shows the current visibility and its hint, and offers all four', () => {
    setup()
    const select = screen.getByRole<HTMLSelectElement>('combobox')
    expect(select.value).toBe('members')
    expect(screen.getAllByRole('option')).toHaveLength(4)
    expect(screen.getByText(/Every signed-in member/)).toBeTruthy()
  })

  it('saves a new visibility and tells the page to refresh', async () => {
    setup()
    fireEvent.change(screen.getByRole('combobox'), {
      target: { value: 'unlisted' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save visibility' }))
    await screen.findByText('Visibility saved.')
    expect(mocks.changeVisibility).toHaveBeenCalledWith('tok', 'unlisted')
    expect(onChanged).toHaveBeenCalled()
  })

  it('carries the one-belief-per-tab hint', () => {
    setup()
    expect(screen.getByText(/Ideally there is one belief per tab/)).toBeTruthy()
    expect(
      screen.getByText(
        /beliefs can be in any order.*outline\s+list is suggested/s,
      ),
    ).toBeTruthy()
  })

  it('adds a tab and clears the form', async () => {
    setup()
    const title = screen.getByLabelText('Title')
    const belief = screen.getByLabelText('Belief')
    fireEvent.change(title, { target: { value: 'God' } })
    fireEvent.change(belief, { target: { value: 'One.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add tab' }))
    await screen.findByText('Your new tab is on your page.')
    expect(mocks.addBeliefTab).toHaveBeenCalledWith('tok', {
      title: 'God',
      text: 'One.',
    })
    await waitFor(() => expect((title as HTMLInputElement).value).toBe(''))
    expect((belief as HTMLTextAreaElement).value).toBe('')
  })

  it('keeps what was typed when adding fails', async () => {
    mocks.addBeliefTab.mockRejectedValue(new Error('Too many tabs.'))
    setup()
    const title = screen.getByLabelText('Title')
    fireEvent.change(title, { target: { value: 'God' } })
    fireEvent.change(screen.getByLabelText('Belief'), {
      target: { value: 'One.' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Add tab' }))
    await screen.findByText('Too many tabs.')
    expect((title as HTMLInputElement).value).toBe('God')
    expect(onChanged).not.toHaveBeenCalled()
  })

  it('carries Tripp’s hint on the picture', () => {
    setup()
    expect(screen.getByText(/doesn't have to be you/)).toBeTruthy()
  })

  it('uploads a chosen picture', async () => {
    const { fileInput } = setup()
    const picture = new File(['x'], 'a.png', { type: 'image/png' })
    fireEvent.change(fileInput, fileEvent([picture]))
    await screen.findByText('Your picture is saved.')
    expect(mocks.uploadProfilePicture).toHaveBeenCalledWith('tok', picture)
  })

  it('does nothing when the file dialog is cancelled', () => {
    const { fileInput } = setup()
    fireEvent.change(fileInput, fileEvent([]))
    expect(mocks.uploadProfilePicture).not.toHaveBeenCalled()
  })

  it('refuses an oversized picture before sending it', () => {
    const { fileInput } = setup()
    const big = new File(['x'], 'big.png', { type: 'image/png' })
    Object.defineProperty(big, 'size', { value: 10 * 1024 * 1024 + 1 })
    fireEvent.change(fileInput, fileEvent([big]))
    expect(screen.getByRole('alert').textContent).toMatch(/over 10 MB/)
    expect(mocks.uploadProfilePicture).not.toHaveBeenCalled()
  })

  it('stops when the session cannot be confirmed', async () => {
    mocks.auth.getToken.mockResolvedValue(undefined)
    setup()
    fireEvent.click(screen.getByRole('button', { name: 'Save visibility' }))
    await screen.findByText(/couldn't confirm that you're signed in/)
    expect(mocks.changeVisibility).not.toHaveBeenCalled()
  })

  it('has words for a failure that is not an Error', async () => {
    mocks.changeVisibility.mockRejectedValue('nope')
    setup()
    fireEvent.click(screen.getByRole('button', { name: 'Save visibility' }))
    await screen.findByText('Something went wrong.')
  })
})
