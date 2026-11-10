// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type * as MembershipApi from '#/lib/membership-api'
import { MembersEntry } from './MembersEntry'
import { SLOW_NOTICE_AFTER_MS, SLOW_SERVER_MESSAGE } from './use-slow-notice'

const mocks = vi.hoisted(() => ({
  auth: {
    configured: true,
    isAuthenticated: false,
    isLoading: false,
    login: vi.fn(),
    logout: vi.fn(),
    getToken: vi.fn(),
  },
  fetchMyMembership: vi.fn(),
  recordGuestEntry: vi.fn(),
}))

vi.mock('#/lib/auth', () => ({ useOrgAuth: () => mocks.auth }))
vi.mock('@tanstack/react-router', () => ({
  Link: ({ to, children }: { to: string; children: ReactNode }) => (
    <a href={to}>{children}</a>
  ),
}))
vi.mock('#/lib/membership-api', async (original) => ({
  ...(await original<typeof MembershipApi>()),
  fetchMyMembership: mocks.fetchMyMembership,
  recordGuestEntry: mocks.recordGuestEntry,
}))

function renderEntry() {
  return render(
    <MembersEntry>
      <p>Community content</p>
    </MembersEntry>,
  )
}

beforeEach(() => {
  localStorage.clear()
  Object.assign(mocks.auth, {
    configured: true,
    isAuthenticated: false,
    isLoading: false,
  })
  mocks.auth.login.mockReset()
  mocks.auth.getToken.mockReset().mockResolvedValue('tok')
  mocks.fetchMyMembership.mockReset()
  mocks.recordGuestEntry.mockReset().mockResolvedValue(undefined)
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('MembersEntry', () => {
  it('waits while sign-in state loads', () => {
    mocks.auth.isLoading = true
    renderEntry()
    expect(screen.getByText('Checking membership…')).toBeTruthy()
    expect(screen.queryByText('Community content')).toBeNull()
  })

  it('offers the four ways in, and hides the content', () => {
    renderEntry()
    for (const name of ['Log in', 'Sign up', 'Join anonymously', 'Guest']) {
      expect(
        screen.getByRole('button', { name: new RegExp(name) }),
      ).toBeTruthy()
    }
    expect(screen.queryByText('Community content')).toBeNull()
    expect(screen.getByText(/records the IP address/)).toBeTruthy()
  })

  it('sends log in, sign up and anonymous to the right places', () => {
    renderEntry()
    fireEvent.click(screen.getByRole('button', { name: /Log in/ }))
    fireEvent.click(screen.getByRole('button', { name: /Sign up/ }))
    fireEvent.click(screen.getByRole('button', { name: /Join anonymously/ }))
    expect(mocks.auth.login.mock.calls).toEqual([
      ['/community'],
      ['/membership/join', true],
      ['/membership/join?nickname=1', true],
    ])
  })

  it('lets a guest in with one click, records it, and remembers it', async () => {
    renderEntry()
    fireEvent.click(screen.getByRole('button', { name: /Guest/ }))
    expect(await screen.findByText('Community content')).toBeTruthy()
    expect(mocks.recordGuestEntry).toHaveBeenCalledTimes(1)
    expect(screen.getByText(/browsing as a guest/)).toBeTruthy()

    cleanup()
    renderEntry()
    expect(await screen.findByText('Community content')).toBeTruthy()
    expect(mocks.recordGuestEntry).toHaveBeenCalledTimes(1)
  })

  it('lets a guest become a member or leave guest mode', async () => {
    localStorage.setItem('org-members-guest', '1')
    renderEntry()
    fireEvent.click(
      await screen.findByRole('button', { name: 'Become a member' }),
    )
    expect(mocks.auth.login).toHaveBeenCalledWith('/membership/join', true)
    fireEvent.click(screen.getByRole('button', { name: 'Leave guest mode' }))
    expect(screen.queryByText('Community content')).toBeNull()
    expect(localStorage.getItem('org-members-guest')).toBeNull()
  })

  it('shows why guest entry failed and stays closed', async () => {
    mocks.recordGuestEntry.mockRejectedValueOnce(new Error('Too many requests'))
    renderEntry()
    fireEvent.click(screen.getByRole('button', { name: /Guest/ }))
    expect((await screen.findByRole('alert')).textContent).toBe(
      'Too many requests',
    )
    mocks.recordGuestEntry.mockRejectedValueOnce('odd')
    fireEvent.click(screen.getByRole('button', { name: /Guest/ }))
    expect((await screen.findByRole('alert')).textContent).toBe(
      'Guest entry is unavailable.',
    )
    expect(screen.queryByText('Community content')).toBeNull()
  })

  it('offers guest entry again after it failed, and lets the guest in', async () => {
    mocks.recordGuestEntry.mockRejectedValueOnce(new Error('Server asleep'))
    renderEntry()
    fireEvent.click(screen.getByRole('button', { name: /Guest/ }))
    expect((await screen.findByRole('alert')).textContent).toBe('Server asleep')
    fireEvent.click(screen.getByRole('button', { name: /Guest/ }))
    expect(await screen.findByText('Community content')).toBeTruthy()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('lets a guest in unrecorded only if the owner turns the record off', async () => {
    mocks.recordGuestEntry.mockRejectedValueOnce(new Error('Server asleep'))
    render(
      <MembersEntry guestNeedsRecord={false}>
        <p>Community content</p>
      </MembersEntry>,
    )
    fireEvent.click(screen.getByRole('button', { name: /Guest/ }))
    expect(await screen.findByText('Community content')).toBeTruthy()
    expect(localStorage.getItem('org-members-guest')).toBe('1')
  })

  it('says why guest entry is slow', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    mocks.recordGuestEntry.mockReturnValue(new Promise(() => {}))
    renderEntry()
    fireEvent.click(screen.getByRole('button', { name: /Guest/ }))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(SLOW_NOTICE_AFTER_MS + 10)
    })
    expect(screen.getByRole('status').textContent).toBe(SLOW_SERVER_MESSAGE)
  })

  describe('signed in', () => {
    beforeEach(() => {
      mocks.auth.isAuthenticated = true
    })

    it('asks a member without a page to finish joining', async () => {
      mocks.fetchMyMembership.mockResolvedValue({ status: 'none' })
      renderEntry()
      expect(screen.getByText('Checking membership…')).toBeTruthy()
      const link = await screen.findByRole('link', { name: /Create my page/ })
      expect(link.getAttribute('href')).toBe('/membership/join')
      expect(mocks.fetchMyMembership).toHaveBeenCalledWith('tok')
      expect(screen.getByRole('note').textContent).toMatch(
        /old Pages profiles.*don't create a new one.*claim/,
      )
    })

    it('does not show the imported-page note to a member awaiting approval', async () => {
      mocks.fetchMyMembership.mockResolvedValue({
        status: 'pending',
        profile: { displayName: 'Quiet Fern' },
      })
      renderEntry()
      await screen.findByText(/Thank you, Quiet Fern/)
      expect(screen.queryByRole('note')).toBeNull()
    })

    describe.each([
      ['with no page', { status: 'none' }, 'Finish joining'],
      [
        'with a pending page',
        { status: 'pending', profile: { displayName: 'Quiet Fern' } },
        /Thank you, Quiet Fern/,
      ],
    ])('%s', (_label, summary, marker) => {
      beforeEach(() => {
        mocks.fetchMyMembership.mockResolvedValue(summary)
      })

      it('can still enter as a guest, and leave again', async () => {
        renderEntry()
        await screen.findByText(marker)
        expect(screen.queryByText('Community content')).toBeNull()
        fireEvent.click(screen.getByRole('button', { name: /Guest/ }))
        expect(await screen.findByText('Community content')).toBeTruthy()
        expect(mocks.recordGuestEntry).toHaveBeenCalledTimes(1)
        expect(screen.getByText(/browsing as a guest/)).toBeTruthy()
        expect(
          screen.queryByRole('button', { name: 'Become a member' }),
        ).toBeNull()
        fireEvent.click(
          screen.getByRole('button', { name: 'Leave guest mode' }),
        )
        expect(screen.queryByText('Community content')).toBeNull()
        expect(await screen.findByText(marker)).toBeTruthy()
      })

      it('shows a failed guest entry beside the option', async () => {
        mocks.recordGuestEntry.mockRejectedValueOnce(new Error('Server asleep'))
        renderEntry()
        await screen.findByText(marker)
        fireEvent.click(screen.getByRole('button', { name: /Guest/ }))
        expect((await screen.findByRole('alert')).textContent).toBe(
          'Server asleep',
        )
        expect(screen.getByText(marker)).toBeTruthy()
      })
    })

    it('points a guest with no page at creating one, but not a pending one', async () => {
      localStorage.setItem('org-members-guest', '1')
      mocks.fetchMyMembership.mockResolvedValue({ status: 'none' })
      const first = renderEntry()
      expect(
        (
          await screen.findByRole('link', { name: 'Create my page' })
        ).getAttribute('href'),
      ).toBe('/membership/join')
      first.unmount()
      mocks.fetchMyMembership.mockResolvedValue({ status: 'pending' })
      renderEntry()
      await screen.findByText('Community content')
      await act(async () => {
        await Promise.resolve()
      })
      expect(screen.queryByRole('link', { name: 'Create my page' })).toBeNull()
    })

    it('gives a member the community, not guest mode, even if a guest once', async () => {
      localStorage.setItem('org-members-guest', '1')
      mocks.fetchMyMembership.mockResolvedValue({ status: 'approved' })
      renderEntry()
      await screen.findByText(/browsing as a guest/)
      await vi.waitFor(() =>
        expect(screen.queryByText(/browsing as a guest/)).toBeNull(),
      )
      expect(screen.getByText('Community content')).toBeTruthy()
    })

    it('offers another try and guest entry when the membership check fails', async () => {
      mocks.fetchMyMembership.mockRejectedValueOnce(
        new Error("We couldn't reach the ORG server."),
      )
      renderEntry()
      expect((await screen.findByRole('alert')).textContent).toMatch(
        /couldn't reach/,
      )
      expect(screen.getByRole('button', { name: /Guest/ })).toBeTruthy()
      mocks.fetchMyMembership.mockResolvedValue({ status: 'approved' })
      fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
      expect(await screen.findByText('Community content')).toBeTruthy()
      expect(screen.queryByRole('alert')).toBeNull()
    })

    it('says why the membership check is slow', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true })
      mocks.fetchMyMembership.mockReturnValue(new Promise(() => {}))
      renderEntry()
      await act(async () => {
        await vi.advanceTimersByTimeAsync(SLOW_NOTICE_AFTER_MS + 10)
      })
      expect(screen.getByRole('status').textContent).toBe(SLOW_SERVER_MESSAGE)
    })

    it('tells a pending member their page is waiting', async () => {
      mocks.fetchMyMembership.mockResolvedValue({
        status: 'pending',
        profile: { displayName: 'Quiet Fern' },
      })
      renderEntry()
      expect(await screen.findByText(/Thank you, Quiet Fern/)).toBeTruthy()
      expect(screen.queryByText('Community content')).toBeNull()
    })

    it('opens the community to an approved member', async () => {
      mocks.fetchMyMembership.mockResolvedValue({ status: 'approved' })
      renderEntry()
      expect(await screen.findByText('Community content')).toBeTruthy()
    })

    it('reports a membership error', async () => {
      mocks.fetchMyMembership.mockRejectedValueOnce(new Error('Server down'))
      renderEntry()
      expect((await screen.findByRole('alert')).textContent).toBe('Server down')
    })

    it('reports an unknown failure in plain words', async () => {
      mocks.fetchMyMembership.mockRejectedValueOnce('odd')
      renderEntry()
      expect((await screen.findByRole('alert')).textContent).toBe(
        'Membership is unavailable.',
      )
    })

    it('does not hang without a token: offers another try and Guest', async () => {
      mocks.auth.getToken.mockResolvedValueOnce(undefined)
      mocks.fetchMyMembership.mockResolvedValue({ status: 'approved' })
      renderEntry()
      expect((await screen.findByRole('alert')).textContent).toMatch(
        /confirm that you're signed in/,
      )
      expect(mocks.fetchMyMembership).not.toHaveBeenCalled()
      expect(screen.getByRole('button', { name: /Guest/ })).toBeTruthy()
      fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
      expect(await screen.findByText('Community content')).toBeTruthy()
    })

    it('ignores an answer that arrives after it closed', async () => {
      let resolve: (value: unknown) => void = () => {}
      mocks.fetchMyMembership.mockReturnValue(
        new Promise((r) => {
          resolve = r
        }),
      )
      const { unmount } = renderEntry()
      await vi.waitFor(() => expect(mocks.fetchMyMembership).toHaveBeenCalled())
      unmount()
      resolve({ status: 'approved' })
      await Promise.resolve()
    })

    it('ignores an error that arrives after it closed', async () => {
      let reject: (reason: unknown) => void = () => {}
      mocks.fetchMyMembership.mockReturnValue(
        new Promise((_, r) => {
          reject = r
        }),
      )
      const { unmount } = renderEntry()
      await vi.waitFor(() => expect(mocks.fetchMyMembership).toHaveBeenCalled())
      unmount()
      reject(new Error('late'))
      await Promise.resolve()
    })
  })
})
