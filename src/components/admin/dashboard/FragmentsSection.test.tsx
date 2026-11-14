// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '#/lib/api'
import type * as SearchApi from '#/lib/search-api'
import { ADMINS_ONLY } from './admin-shared'
import { FragmentsSection } from './FragmentsSection'

const mocks = vi.hoisted(() => ({
  auth: {
    isLoading: false,
    isAuthenticated: true,
    getToken: vi.fn<() => Promise<string | undefined>>(),
  },
  fetchAdminFragments: vi.fn(),
  setFragmentHidden: vi.fn(),
}))

vi.mock('#/lib/auth', () => ({ useOrgAuth: () => mocks.auth }))
vi.mock('#/lib/search-api', async (original) => ({
  ...(await original<typeof SearchApi>()),
  fetchAdminFragments: mocks.fetchAdminFragments,
  setFragmentHidden: mocks.setFragmentHidden,
}))

beforeEach(() => {
  mocks.auth.getToken.mockReset().mockResolvedValue('tok')
  mocks.fetchAdminFragments.mockReset().mockResolvedValue({
    fragments: [
      { term: 'octagon', searchers: 9, hidden: false, shown: true },
      { term: 'quiet word', searchers: 6, hidden: false, shown: false },
      { term: 'old term', searchers: 0, hidden: true, shown: false },
    ],
  })
  mocks.setFragmentHidden.mockReset().mockResolvedValue({})
})
afterEach(cleanup)

describe('FragmentsSection', () => {
  it('lists each term with its searchers and state, and hides one with a reason', async () => {
    const user = userEvent.setup()
    render(<FragmentsSection />)
    expect(await screen.findByText('9 searchers · Suggested now')).toBeTruthy()
    expect(screen.getByText('6 searchers · Not suggested')).toBeTruthy()
    expect(screen.getByText('0 searchers · Hidden')).toBeTruthy()
    await user.type(
      screen.getByLabelText('Reason for “octagon” (optional)'),
      ' off-topic ',
    )
    await user.click(screen.getByRole('button', { name: 'Hide “octagon”' }))
    expect(mocks.setFragmentHidden).toHaveBeenCalledWith(
      'tok',
      'octagon',
      true,
      'off-topic',
    )
    await waitFor(() =>
      expect(mocks.fetchAdminFragments).toHaveBeenCalledTimes(2),
    )
    await user.click(
      screen.getByRole('button', { name: 'Show again “old term”' }),
    )
    expect(mocks.setFragmentHidden).toHaveBeenLastCalledWith(
      'tok',
      'old term',
      false,
      undefined,
    )
  })

  it('shows a failed change on its row', async () => {
    const user = userEvent.setup()
    mocks.setFragmentHidden.mockRejectedValue(new Error('Too many tries.'))
    render(<FragmentsSection />)
    await user.click(
      await screen.findByRole('button', { name: 'Hide “octagon”' }),
    )
    expect((await screen.findByRole('alert')).textContent).toBe(
      'Too many tries.',
    )
  })

  it('says when no term qualifies yet, and shows nothing to a non-admin', async () => {
    mocks.fetchAdminFragments.mockResolvedValue({ fragments: [] })
    render(<FragmentsSection />)
    expect(await screen.findByText(/No term has enough searchers/)).toBeTruthy()
    cleanup()
    mocks.fetchAdminFragments.mockRejectedValue(new ApiError('Forbidden', 403))
    render(<FragmentsSection />)
    expect((await screen.findByRole('alert')).textContent).toBe(ADMINS_ONLY)
  })
})

describe('FragmentsSection, review L6', () => {
  it('gives each reason field an id without spaces', async () => {
    const { container } = render(<FragmentsSection />)
    await screen.findByText('9 searchers · Suggested now')
    const ids = [...container.querySelectorAll('input')].map(
      (input) => input.id,
    )
    expect(ids.length).toBeGreaterThan(0)
    for (const id of ids) expect(id).not.toMatch(/\s/)
  })

  it('hides a term that is not listed yet', async () => {
    const user = userEvent.setup()
    render(<FragmentsSection />)
    await screen.findByText('9 searchers · Suggested now')
    await user.type(screen.getByLabelText('Term to hide'), ' Brand New ')
    await user.type(screen.getByLabelText('Reason (optional)'), 'why')
    await user.click(screen.getByRole('button', { name: 'Hide term' }))
    expect(mocks.setFragmentHidden).toHaveBeenCalledWith(
      'tok',
      'Brand New',
      true,
      'why',
    )
    await waitFor(() =>
      expect(
        screen.getByLabelText<HTMLInputElement>('Term to hide').value,
      ).toBe(''),
    )
    // Without a reason; and a refusal is shown by the form.
    mocks.setFragmentHidden.mockRejectedValueOnce(new Error('Not a term.'))
    await user.type(screen.getByLabelText('Term to hide'), 'a@b')
    await user.click(screen.getByRole('button', { name: 'Hide term' }))
    expect(mocks.setFragmentHidden).toHaveBeenLastCalledWith(
      'tok',
      'a@b',
      true,
      undefined,
    )
    expect((await screen.findByRole('alert')).textContent).toBe('Not a term.')
  })
})
