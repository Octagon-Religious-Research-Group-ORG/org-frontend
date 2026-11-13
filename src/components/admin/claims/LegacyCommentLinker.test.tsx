// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type * as ClaimsApi from '#/lib/claims-api'
import { LegacyCommentLinker, NAME_IS_A_HINT } from './LegacyCommentLinker'

// Synthetic data only.
const mocks = vi.hoisted(() => ({
  auth: {
    isLoading: false,
    isAuthenticated: true,
    getToken: vi.fn<() => Promise<string | undefined>>(),
  },
  fetchLegacyComments: vi.fn(),
  linkLegacyComments: vi.fn(),
}))

vi.mock('#/lib/auth', () => ({ useOrgAuth: () => mocks.auth }))
vi.mock('#/lib/claims-api', async (original) => ({
  ...(await original<typeof ClaimsApi>()),
  fetchLegacyComments: mocks.fetchLegacyComments,
  linkLegacyComments: mocks.linkLegacyComments,
}))

const LIST = {
  owner: { slug: 'imported-page', displayName: 'Synthetic Owner' },
  hasMore: false,
  comments: [
    {
      commentId: 'c_linked',
      name: 'Synthetic Owner',
      excerpt: 'Already linked comment.',
      linked: true,
      nameMatches: true,
    },
    {
      commentId: 'c_match',
      name: 'Synthetic Ownr',
      importedDate: '2020-05-01T00:00:00Z',
      page: { slug: 'other', displayName: 'Other Page' },
      excerpt: 'A matching name.',
      linked: false,
      nameMatches: true,
    },
    {
      commentId: 'c_other',
      name: 'Someone Else',
      excerpt: 'Not a match.',
      linked: false,
      nameMatches: false,
    },
  ],
}

beforeEach(() => {
  mocks.auth.getToken.mockReset().mockResolvedValue('tok')
  mocks.fetchLegacyComments.mockReset().mockResolvedValue(LIST)
  mocks.linkLegacyComments
    .mockReset()
    .mockResolvedValue({ linked: ['c_match'], skipped: [] })
})

afterEach(cleanup)

const renderLinker = () => render(<LegacyCommentLinker claimId="c1" />)

describe('LegacyCommentLinker', () => {
  it('lists the comments with the hint that a name proves nothing', async () => {
    renderLinker()
    expect(screen.getByRole('status').textContent).toMatch(/Loading/)
    expect(await screen.findByText('Already linked comment.')).toBeTruthy()
    expect(screen.getByText(NAME_IS_A_HINT)).toBeTruthy()
    expect(screen.getByText('Linked to Synthetic Owner')).toBeTruthy()
    expect(screen.getAllByText('Name matches')).toHaveLength(1)
    expect(
      screen.getByText(/Synthetic Ownr/).closest('label')?.textContent,
    ).toMatch(/Pages: May 1, 2020 · on Other Page/)
    // Nothing ticked: nothing to send.
    for (const name of [
      'Link the ticked comments',
      'Take back the ticked links',
    ]) {
      expect(
        screen.getByRole<HTMLButtonElement>('button', { name }).disabled,
      ).toBe(true)
    }
  })

  it('links only the ticked comments that are not linked yet', async () => {
    const user = userEvent.setup()
    renderLinker()
    await user.click(
      await screen.findByRole('checkbox', { name: /A matching name/ }),
    )
    await user.click(screen.getByRole('checkbox', { name: /Already linked/ }))
    await user.click(screen.getByRole('checkbox', { name: /Already linked/ }))
    await user.click(screen.getByRole('checkbox', { name: /Already linked/ }))
    await user.click(
      screen.getByRole('button', { name: 'Link the ticked comments' }),
    )
    expect(mocks.linkLegacyComments).toHaveBeenCalledWith(
      'tok',
      'c1',
      ['c_match'],
      false,
    )
    expect((await screen.findByText(/Linked 1 of 1\./)).textContent).toBe(
      'Linked 1 of 1.',
    )
    expect(mocks.fetchLegacyComments).toHaveBeenCalledTimes(2)
  })

  it('takes back ticked links, and says what could not be changed', async () => {
    const user = userEvent.setup()
    mocks.linkLegacyComments.mockResolvedValueOnce({
      unlinked: [],
      skipped: ['c_linked'],
    })
    renderLinker()
    await user.click(
      await screen.findByRole('checkbox', { name: /Already linked/ }),
    )
    await user.click(
      screen.getByRole('button', { name: 'Take back the ticked links' }),
    )
    expect(mocks.linkLegacyComments).toHaveBeenCalledWith(
      'tok',
      'c1',
      ['c_linked'],
      true,
    )
    expect((await screen.findByRole('status')).textContent).toBe(
      'Unlinked 0 of 1. 1 could not be changed (already linked, removed, or changed meanwhile).',
    )
  })

  it('counts nothing done when the answer omits the list', async () => {
    const user = userEvent.setup()
    mocks.linkLegacyComments.mockResolvedValueOnce({ skipped: [] })
    renderLinker()
    await user.click(
      await screen.findByRole('checkbox', { name: /Not a match/ }),
    )
    await user.click(
      screen.getByRole('button', { name: 'Link the ticked comments' }),
    )
    expect((await screen.findByRole('status')).textContent).toBe(
      'Linked 0 of 1.',
    )
  })

  it('shows failures: a refusal, an odd one, an expired session', async () => {
    const user = userEvent.setup()
    renderLinker()
    await user.click(
      await screen.findByRole('checkbox', { name: /Not a match/ }),
    )
    const link = screen.getByRole('button', {
      name: 'Link the ticked comments',
    })
    mocks.linkLegacyComments.mockRejectedValueOnce(new Error('Refused.'))
    await user.click(link)
    expect((await screen.findByRole('alert')).textContent).toBe('Refused.')
    mocks.linkLegacyComments.mockRejectedValueOnce('odd')
    await user.click(link)
    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toBe('That did not work.'),
    )
    mocks.auth.getToken.mockResolvedValueOnce(undefined)
    await user.click(link)
    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toMatch(/expired/),
    )
  })

  it('says when nothing is left, when the list was cut, and when it failed to load', async () => {
    mocks.fetchLegacyComments.mockResolvedValueOnce({
      ...LIST,
      comments: [],
      hasMore: true,
    })
    renderLinker()
    expect(
      await screen.findByText('No imported comments are left to link.'),
    ).toBeTruthy()
    expect(screen.getByText(/Only the first imported comments/)).toBeTruthy()
    expect(screen.queryByRole('button')).toBeNull()
    cleanup()
    mocks.fetchLegacyComments.mockRejectedValueOnce(new Error('Not approved.'))
    renderLinker()
    expect((await screen.findByRole('alert')).textContent).toBe('Not approved.')
    cleanup()
    mocks.fetchLegacyComments.mockRejectedValueOnce('odd')
    renderLinker()
    expect((await screen.findByRole('alert')).textContent).toBe(
      'The comments did not load.',
    )
    cleanup()
    mocks.auth.getToken.mockResolvedValueOnce(undefined)
    renderLinker()
    expect((await screen.findByRole('alert')).textContent).toMatch(/expired/)
  })

  it('ignores an answer that arrives after it was closed', async () => {
    let resolve: (value: unknown) => void = () => undefined
    mocks.fetchLegacyComments.mockReturnValueOnce(
      new Promise((done) => (resolve = done)),
    )
    renderLinker().unmount()
    resolve(LIST)
    let reject: (reason: unknown) => void = () => undefined
    mocks.fetchLegacyComments.mockReturnValueOnce(
      new Promise((_done, fail) => (reject = fail)),
    )
    renderLinker().unmount()
    reject(new Error('late'))
    await Promise.resolve()
    expect(screen.queryByRole('alert')).toBeNull()
  })
})
