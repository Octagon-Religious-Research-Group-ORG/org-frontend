// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type * as MembersApi from '#/lib/members-api'
import { RemovedBeliefs } from './RemovedBeliefs'

const mocks = vi.hoisted(() => ({
  auth: { getToken: vi.fn() },
  restoreBeliefTab: vi.fn(),
}))

vi.mock('#/lib/auth', () => ({ useOrgAuth: () => mocks.auth }))
vi.mock('#/lib/members-api', async (original) => ({
  ...(await original<typeof MembersApi>()),
  restoreBeliefTab: mocks.restoreBeliefTab,
}))
vi.mock('./HistoryPanel', () => ({
  HistoryPanel: () => <p>history stub</p>,
  formatSavedAt: (iso: string) => iso,
}))

const tabs = [
  { tabId: 'tab_a', title: 'Old belief', removedAt: '2026-11-01T00:00:00Z' },
]

beforeEach(() => {
  mocks.auth.getToken.mockReset().mockResolvedValue('tok')
  mocks.restoreBeliefTab.mockReset().mockResolvedValue({ restored: true })
})
afterEach(cleanup)

describe('RemovedBeliefs', () => {
  it('lets the owner bring a belief back, then refreshes the page (plan §2e)', async () => {
    const user = userEvent.setup()
    const onChanged = vi.fn()
    render(
      <RemovedBeliefs slug="quiet-fern" tabs={tabs} owner={{ onChanged }} />,
    )
    await user.click(
      screen.getByRole('button', { name: 'Bring back “Old belief”' }),
    )
    expect(mocks.restoreBeliefTab).toHaveBeenCalledWith('tok', 'tab_a')
    await waitFor(() => expect(onChanged).toHaveBeenCalled())
  })

  it('shows a refusal and keeps the belief listed', async () => {
    const user = userEvent.setup()
    const onChanged = vi.fn()
    mocks.restoreBeliefTab.mockRejectedValueOnce(
      new Error('A page can have at most 300 belief tabs.'),
    )
    render(
      <RemovedBeliefs slug="quiet-fern" tabs={tabs} owner={{ onChanged }} />,
    )
    await user.click(
      screen.getByRole('button', { name: 'Bring back “Old belief”' }),
    )
    expect(
      await screen.findByText('A page can have at most 300 belief tabs.'),
    ).toBeTruthy()
    expect(onChanged).not.toHaveBeenCalled()
  })

  it('offers no "Bring back" to an admin reading someone else’s page', () => {
    render(<RemovedBeliefs slug="quiet-fern" tabs={tabs} />)
    expect(screen.queryByRole('button', { name: /Bring back/ })).toBeNull()
    expect(screen.getByRole('button', { name: 'History' })).toBeTruthy()
  })
})
