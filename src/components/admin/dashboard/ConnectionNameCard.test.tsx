// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type * as ConnectionsApi from '#/lib/connections-api'
import {
  forgetConnectionTerms,
  useConnectionTerms,
} from '#/components/members/use-connection-terms'
import { ConnectionNameCard, NAME_EXPLAINED } from './ConnectionNameCard'

const mocks = vi.hoisted(() => ({
  auth: {
    isLoading: false,
    isAuthenticated: true,
    getToken: vi.fn<() => Promise<string | undefined>>(),
  },
  fetchConnectionTerms: vi.fn(),
  saveConnectionTerms: vi.fn(),
}))

vi.mock('#/lib/auth', () => ({ useOrgAuth: () => mocks.auth }))
vi.mock('#/lib/connections-api', async (original) => ({
  ...(await original<typeof ConnectionsApi>()),
  fetchConnectionTerms: mocks.fetchConnectionTerms,
  saveConnectionTerms: mocks.saveConnectionTerms,
}))

beforeEach(() => {
  forgetConnectionTerms()
  mocks.auth.getToken.mockReset().mockResolvedValue('tok')
  mocks.fetchConnectionTerms.mockReset().mockResolvedValue({
    singular: 'introduction',
    plural: 'introductions',
  })
  mocks.saveConnectionTerms.mockReset().mockResolvedValue({})
})
afterEach(cleanup)

const one = () => screen.getByLabelText(/^One/)
const many = () => screen.getByLabelText(/^Several/)

describe('ConnectionNameCard (Chunk 18)', () => {
  it('shows the current name and saves a new one', async () => {
    const user = userEvent.setup()
    render(<ConnectionNameCard />)
    expect(screen.getByText(NAME_EXPLAINED)).toBeTruthy()
    await vi.waitFor(() =>
      expect((one() as HTMLInputElement).value).toBe('introduction'),
    )
    await user.clear(one())
    await user.type(one(), 'contact request')
    await user.clear(many())
    await user.type(many(), 'contact requests')
    await user.click(screen.getByRole('button', { name: 'Save the name' }))
    expect(mocks.saveConnectionTerms).toHaveBeenCalledWith('tok', {
      singular: 'contact request',
      plural: 'contact requests',
    })
    expect((await screen.findByRole('status')).textContent).toBe('Name saved.')
  })

  it('refuses a name that is not words, and puts the default back when both are cleared', async () => {
    const user = userEvent.setup()
    render(<ConnectionNameCard />)
    await vi.waitFor(() =>
      expect((one() as HTMLInputElement).value).toBe('introduction'),
    )
    await user.clear(many())
    await user.type(many(), '123')
    const save = screen.getByRole('button', { name: 'Save the name' })
    expect((save as HTMLButtonElement).disabled).toBe(true)
    expect(one().getAttribute('aria-invalid')).toBe('true')
    await user.click(screen.getByRole('button', { name: 'Clear both' }))
    await user.click(save)
    expect(mocks.saveConnectionTerms).toHaveBeenCalledWith('tok', {
      singular: '',
      plural: '',
    })
    expect((await screen.findByRole('status')).textContent).toBe(
      'The default name is back.',
    )
  })

  it('says why a save failed', async () => {
    const user = userEvent.setup()
    mocks.saveConnectionTerms.mockRejectedValue(new Error('Refused.'))
    render(<ConnectionNameCard />)
    await vi.waitFor(() =>
      expect((one() as HTMLInputElement).value).toBe('introduction'),
    )
    await user.click(screen.getByRole('button', { name: 'Save the name' }))
    expect((await screen.findByRole('alert')).textContent).toBe('Refused.')
  })
})

function Name() {
  const terms = useConnectionTerms()
  return <p>{terms.plural}</p>
}

describe('useConnectionTerms', () => {
  it('asks once, shares the answer, and keeps the default if the server cannot say', async () => {
    const first = render(<Name />)
    expect(first.container.textContent).toBe('connection requests')
    await screen.findByText('introductions')
    first.unmount()
    render(<Name />)
    await screen.findByText('introductions')
    expect(mocks.fetchConnectionTerms).toHaveBeenCalledTimes(1)
    cleanup()
    forgetConnectionTerms()
    mocks.fetchConnectionTerms.mockRejectedValueOnce(new Error('down'))
    render(<Name />)
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(screen.getByText('connection requests')).toBeTruthy()
    cleanup()
    // A failure is not remembered: the next page asks again.
    render(<Name />)
    await screen.findByText('introductions')
  })

  it('drops an answer for a component already gone', async () => {
    const { unmount } = render(<Name />)
    unmount()
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(mocks.fetchConnectionTerms).toHaveBeenCalledTimes(1)
  })
})

describe('round 1, #6', () => {
  it('no longer says emails keep the default words', () => {
    expect(NAME_EXPLAINED).not.toContain('Emails keep the default')
  })
})
