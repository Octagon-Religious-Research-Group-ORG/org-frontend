// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '#/lib/api'
import type * as MembersApi from '#/lib/members-api'
import type { MemberProfile } from '#/lib/members-api'
import { MemberPage } from './MemberPage'

const mocks = vi.hoisted(() => ({
  auth: { isLoading: false, isAuthenticated: false, getToken: vi.fn() },
  fetchMemberProfile: vi.fn(),
}))

vi.mock('#/lib/auth', () => ({ useOrgAuth: () => mocks.auth }))
vi.mock('#/components/SiteNav', () => ({ SiteNav: () => <nav>site nav</nav> }))
vi.mock('./ReferenceLinks', () => ({ ReferenceLinks: () => <div>links</div> }))
vi.mock('#/lib/members-api', async (original) => ({
  ...(await original<typeof MembersApi>()),
  fetchMemberProfile: mocks.fetchMemberProfile,
}))
vi.mock('./ProfileView', () => ({
  ProfileView: ({
    profile,
    onChanged,
  }: {
    profile: MemberProfile
    onChanged: () => void
  }) => (
    <button type="button" onClick={onChanged}>
      {profile.displayName}/{profile.access}
    </button>
  ),
}))

const profile = (displayName: string, access = 'full') =>
  ({ displayName, access }) as MemberProfile

const notFound = new ApiError('That page does not exist.', 404)

beforeEach(() => {
  mocks.auth.isLoading = false
  mocks.auth.isAuthenticated = false
  mocks.auth.getToken.mockReset().mockResolvedValue('tok')
  mocks.fetchMemberProfile.mockReset().mockResolvedValue(profile('Fetched'))
})

afterEach(cleanup)

describe('MemberPage', () => {
  it('waits for the login check, showing what the server rendered', () => {
    mocks.auth.isLoading = true
    render(<MemberPage slug="x1" initial={profile('Rendered')} />)
    expect(screen.getByText('Rendered/full')).toBeTruthy()
    expect(mocks.fetchMemberProfile).not.toHaveBeenCalled()
  })

  it('asks nothing more for a logged-out visitor who has the page', () => {
    render(<MemberPage slug="x1" initial={profile('Rendered')} />)
    expect(mocks.fetchMemberProfile).not.toHaveBeenCalled()
    expect(screen.getByText('Rendered/full')).toBeTruthy()
  })

  it('swaps a name-only page for the fuller view after sign-in', async () => {
    mocks.auth.isAuthenticated = true
    render(<MemberPage slug="x1" initial={profile('Fern', 'name-only')} />)
    await screen.findByText('Fetched/full')
    expect(mocks.fetchMemberProfile).toHaveBeenCalledWith('x1', {
      token: 'tok',
    })
  })

  it('shows a signed-in owner their hidden page after a server 404', async () => {
    mocks.auth.isAuthenticated = true
    render(<MemberPage slug="x1" missing />)
    await screen.findByText('Fetched/full')
  })

  it('says not found to a logged-out visitor after a server 404', () => {
    render(<MemberPage slug="x1" missing />)
    expect(screen.getByRole('heading', { name: 'Page not found' })).toBeTruthy()
    expect(mocks.fetchMemberProfile).not.toHaveBeenCalled()
  })

  it('says not found when the signed-in check also finds nothing', async () => {
    mocks.auth.isAuthenticated = true
    mocks.fetchMemberProfile.mockRejectedValue(notFound)
    render(<MemberPage slug="x1" missing />)
    await screen.findByRole('heading', { name: 'Page not found' })
  })

  it('fetches as a guest when the server render could not', async () => {
    render(<MemberPage slug="x1" />)
    expect(screen.getByRole('status').textContent).toMatch(/Opening/)
    await screen.findByText('Fetched/full')
    expect(mocks.fetchMemberProfile).toHaveBeenCalledWith('x1', {
      token: undefined,
    })
  })

  it('keeps the rendered page when a signed-in refresh fails', async () => {
    mocks.auth.isAuthenticated = true
    mocks.fetchMemberProfile.mockRejectedValue(new Error('down'))
    render(<MemberPage slug="x1" initial={profile('Rendered')} />)
    await waitFor(() => expect(mocks.fetchMemberProfile).toHaveBeenCalled())
    expect(screen.getByText('Rendered/full')).toBeTruthy()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('offers a retry when there is nothing to show', async () => {
    mocks.fetchMemberProfile.mockRejectedValueOnce(new Error('Server down'))
    render(<MemberPage slug="x1" />)
    await screen.findByText('Server down')
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    await screen.findByText('Fetched/full')
  })

  it('has words for a failure that is not an Error', async () => {
    mocks.fetchMemberProfile.mockRejectedValueOnce('nope')
    render(<MemberPage slug="x1" />)
    await screen.findByText('This page is unavailable.')
  })

  it('stops when the session cannot be confirmed', async () => {
    mocks.auth.isAuthenticated = true
    mocks.auth.getToken.mockResolvedValue(undefined)
    render(<MemberPage slug="x1" />)
    await screen.findByText(/couldn't confirm that you're signed in/)
    expect(mocks.fetchMemberProfile).not.toHaveBeenCalled()
  })

  it('reloads after an owner change', async () => {
    mocks.auth.isAuthenticated = true
    mocks.fetchMemberProfile
      .mockResolvedValueOnce(profile('One'))
      .mockResolvedValueOnce(profile('Two'))
    render(<MemberPage slug="x1" />)
    fireEvent.click(await screen.findByText('One/full'))
    await screen.findByText('Two/full')
  })

  it('shows the new page, not the old one, when the address changes', async () => {
    mocks.auth.isAuthenticated = true
    mocks.fetchMemberProfile
      .mockResolvedValueOnce(profile('Old'))
      .mockResolvedValueOnce(profile('New'))
    const view = render(
      <MemberPage slug="a1" initial={profile('Old rendered')} />,
    )
    await screen.findByText('Old/full')
    view.rerender(<MemberPage slug="b1" initial={profile('New rendered')} />)
    expect(screen.queryByText('Old/full')).toBeNull()
    await screen.findByText('New/full')
    expect(mocks.fetchMemberProfile).toHaveBeenLastCalledWith('b1', {
      token: 'tok',
    })
  })

  it('forgets a not-found answer when the address changes', async () => {
    mocks.auth.isAuthenticated = true
    mocks.fetchMemberProfile
      .mockRejectedValueOnce(notFound)
      .mockResolvedValueOnce(profile('Found'))
    const view = render(<MemberPage slug="a1" missing />)
    await screen.findByRole('heading', { name: 'Page not found' })
    view.rerender(<MemberPage slug="b1" />)
    await screen.findByText('Found/full')
    expect(screen.queryByRole('heading', { name: 'Page not found' })).toBeNull()
  })

  it('ignores answers after it went away', async () => {
    let resolve: (value: unknown) => void = () => {}
    let reject: (value: unknown) => void = () => {}
    mocks.fetchMemberProfile.mockReturnValueOnce(
      new Promise((done) => (resolve = done)),
    )
    const first = render(<MemberPage slug="x1" />)
    await waitFor(() => expect(mocks.fetchMemberProfile).toHaveBeenCalled())
    first.unmount()
    resolve(profile('Late'))

    mocks.fetchMemberProfile.mockReturnValueOnce(
      new Promise((_done, fail) => (reject = fail)),
    )
    const second = render(<MemberPage slug="x1" />)
    await waitFor(() =>
      expect(mocks.fetchMemberProfile).toHaveBeenCalledTimes(2),
    )
    second.unmount()
    reject(new Error('late'))
    await new Promise((done) => setTimeout(done))
    expect(screen.queryByText(/Late/)).toBeNull()
  })
})
