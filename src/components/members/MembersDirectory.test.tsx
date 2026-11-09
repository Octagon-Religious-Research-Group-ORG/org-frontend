// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type * as MembersApi from '#/lib/members-api'
import { MembersDirectory } from './MembersDirectory'

const mocks = vi.hoisted(() => ({
  auth: { isLoading: false, isAuthenticated: false, getToken: vi.fn() },
  fetchMemberDirectory: vi.fn(),
}))

vi.mock('#/lib/auth', () => ({ useOrgAuth: () => mocks.auth }))
vi.mock('@tanstack/react-router', async (original) => ({
  ...(await original<object>()),
  Link: ({
    children,
    params,
  }: {
    children: ReactNode
    params: { slug: string }
  }) => <a href={`/${params.slug}`}>{children}</a>,
}))
vi.mock('#/lib/members-api', async (original) => ({
  ...(await original<typeof MembersApi>()),
  fetchMemberDirectory: mocks.fetchMemberDirectory,
}))

const card = (overrides: object = {}) => ({
  slug: 'quiet-fern',
  displayName: 'Quiet Fern',
  access: 'full',
  hasPicture: false,
  picturePublic: false,
  ...overrides,
})

beforeEach(() => {
  mocks.auth.isLoading = false
  mocks.auth.isAuthenticated = false
  mocks.auth.getToken.mockReset().mockResolvedValue('tok')
  mocks.fetchMemberDirectory
    .mockReset()
    .mockResolvedValue({ members: [card()], hasMore: false })
})

afterEach(cleanup)

describe('MembersDirectory', () => {
  it('waits for the login check', () => {
    mocks.auth.isLoading = true
    render(<MembersDirectory />)
    expect(screen.getByText('Opening the directory…')).toBeTruthy()
    expect(mocks.fetchMemberDirectory).not.toHaveBeenCalled()
  })

  it('asks as a guest when logged out', async () => {
    render(<MembersDirectory />)
    await screen.findByText('Quiet Fern')
    expect(mocks.fetchMemberDirectory).toHaveBeenCalledWith(undefined)
  })

  it('asks with the token when signed in', async () => {
    mocks.auth.isAuthenticated = true
    render(<MembersDirectory />)
    await screen.findByText('Quiet Fern')
    expect(mocks.fetchMemberDirectory).toHaveBeenCalledWith('tok')
  })

  it('links each card to the page, name below the art', async () => {
    render(<MembersDirectory />)
    const name = await screen.findByText('Quiet Fern')
    const link = name.closest('a') as HTMLAnchorElement
    expect(link.getAttribute('href')).toBe('/quiet-fern')
    expect(screen.getByText('Read page')).toBeTruthy()
    const art = link.querySelector('.octagon') as Element
    expect(
      art.compareDocumentPosition(name) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
  })

  it('notes a card that is for members only', async () => {
    mocks.fetchMemberDirectory.mockResolvedValue({
      members: [card({ access: 'name-only' })],
      hasMore: false,
    })
    render(<MembersDirectory />)
    await screen.findByText('Members only')
  })

  it('says when there are no pages', async () => {
    mocks.fetchMemberDirectory.mockResolvedValue({
      members: [],
      hasMore: false,
    })
    render(<MembersDirectory />)
    await screen.findByText('No member pages yet.')
  })

  it('says when the list is partial', async () => {
    mocks.fetchMemberDirectory.mockResolvedValue({
      members: [card()],
      hasMore: true,
    })
    render(<MembersDirectory />)
    await screen.findByText('Only part of the directory is shown here.')
  })

  it('shows a failure, and retries', async () => {
    mocks.fetchMemberDirectory.mockRejectedValueOnce(new Error('Server down'))
    render(<MembersDirectory />)
    await screen.findByText('Server down')
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    await screen.findByText('Quiet Fern')
  })

  it('has words for a failure that is not an Error', async () => {
    mocks.fetchMemberDirectory.mockRejectedValueOnce('nope')
    render(<MembersDirectory />)
    await screen.findByText('The directory is unavailable.')
  })

  it('ignores answers after it went away', async () => {
    let resolve: (value: unknown) => void = () => {}
    let reject: (value: unknown) => void = () => {}
    mocks.fetchMemberDirectory.mockReturnValueOnce(
      new Promise((done) => (resolve = done)),
    )
    const first = render(<MembersDirectory />)
    await waitFor(() => expect(mocks.fetchMemberDirectory).toHaveBeenCalled())
    first.unmount()
    resolve({ members: [card()], hasMore: false })

    mocks.fetchMemberDirectory.mockReturnValueOnce(
      new Promise((_done, fail) => (reject = fail)),
    )
    const second = render(<MembersDirectory />)
    await waitFor(() =>
      expect(mocks.fetchMemberDirectory).toHaveBeenCalledTimes(2),
    )
    second.unmount()
    reject(new Error('late'))
    await new Promise((done) => setTimeout(done))
    expect(screen.queryByText('Quiet Fern')).toBeNull()
  })
})
