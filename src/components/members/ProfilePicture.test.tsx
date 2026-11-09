// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type * as MembersApi from '#/lib/members-api'
import { ProfilePicture } from './ProfilePicture'

const mocks = vi.hoisted(() => ({
  auth: { isAuthenticated: true, getToken: vi.fn() },
  fetchPictureObjectUrl: vi.fn(),
}))

vi.mock('#/lib/auth', () => ({ useOrgAuth: () => mocks.auth }))
vi.mock('#/lib/members-api', async (original) => ({
  ...(await original<typeof MembersApi>()),
  fetchPictureObjectUrl: mocks.fetchPictureObjectUrl,
}))

const revoke = vi.fn()

function renderPicture(
  hasPicture: boolean,
  picturePublic: boolean,
  version?: string,
) {
  return render(
    <ProfilePicture
      slug="quiet-fern"
      displayName="Quiet Fern"
      hasPicture={hasPicture}
      picturePublic={picturePublic}
      version={version}
    />,
  )
}

beforeEach(() => {
  mocks.auth.isAuthenticated = true
  mocks.auth.getToken.mockReset().mockResolvedValue('tok')
  mocks.fetchPictureObjectUrl.mockReset().mockResolvedValue('blob:pic')
  revoke.mockClear()
  URL.revokeObjectURL = revoke
})

afterEach(cleanup)

describe('ProfilePicture', () => {
  it('shows nothing when there is no picture', () => {
    const { container } = renderPicture(false, false)
    expect(container.querySelector('img')).toBeNull()
    expect(mocks.fetchPictureObjectUrl).not.toHaveBeenCalled()
  })

  it('uses a plain image for a public page, and fetches nothing', () => {
    renderPicture(true, true)
    const img = screen.getByRole<HTMLImageElement>('img')
    expect(img.src).toMatch(/\/members\/profiles\/quiet-fern\/picture$/)
    expect(img.alt).toBe('Picture chosen by Quiet Fern')
    expect(mocks.fetchPictureObjectUrl).not.toHaveBeenCalled()
  })

  it('asks for a replaced public picture under a new version', () => {
    const view = renderPicture(true, true, 'v1')
    const first = screen.getByRole<HTMLImageElement>('img').src
    expect(first).toMatch(/\/picture\?v=v1$/)
    view.rerender(
      <ProfilePicture
        slug="quiet-fern"
        displayName="Quiet Fern"
        hasPicture
        picturePublic
        version="v2"
      />,
    )
    expect(screen.getByRole<HTMLImageElement>('img').src).toMatch(/\?v=v2$/)
  })

  it('fetches a replaced restricted picture again', async () => {
    const view = renderPicture(true, false, 'v1')
    await screen.findByRole('img')
    expect(mocks.fetchPictureObjectUrl).toHaveBeenCalledTimes(1)
    view.rerender(
      <ProfilePicture
        slug="quiet-fern"
        displayName="Quiet Fern"
        hasPicture
        picturePublic={false}
        version="v2"
      />,
    )
    await waitFor(() =>
      expect(mocks.fetchPictureObjectUrl).toHaveBeenCalledTimes(2),
    )
  })

  it('fetches a restricted picture with the token', async () => {
    renderPicture(true, false)
    const img = await screen.findByRole<HTMLImageElement>('img')
    expect(img.src).toBe('blob:pic')
    expect(mocks.fetchPictureObjectUrl).toHaveBeenCalledWith(
      'quiet-fern',
      'tok',
    )
  })

  it('never tries a restricted picture without a login', () => {
    mocks.auth.isAuthenticated = false
    const { container } = renderPicture(true, false)
    expect(container.querySelector('img')).toBeNull()
    expect(mocks.fetchPictureObjectUrl).not.toHaveBeenCalled()
  })

  it('does nothing without a token', async () => {
    mocks.auth.getToken.mockResolvedValue(undefined)
    const { container } = renderPicture(true, false)
    await waitFor(() => expect(mocks.auth.getToken).toHaveBeenCalled())
    expect(container.querySelector('img')).toBeNull()
  })

  it('stays an empty octagon when the fetch is refused', async () => {
    mocks.fetchPictureObjectUrl.mockRejectedValue(new Error('404'))
    const { container } = renderPicture(true, false)
    await waitFor(() => expect(mocks.fetchPictureObjectUrl).toHaveBeenCalled())
    expect(container.querySelector('img')).toBeNull()
  })

  it('releases the object URL when it goes away', async () => {
    const { unmount } = renderPicture(true, false)
    await screen.findByRole('img')
    unmount()
    expect(revoke).toHaveBeenCalledWith('blob:pic')
  })

  it('releases a URL that arrives after it went away', async () => {
    let resolve: (url: string) => void = () => {}
    mocks.fetchPictureObjectUrl.mockReturnValue(
      new Promise<string>((done) => (resolve = done)),
    )
    const { unmount } = renderPicture(true, false)
    await waitFor(() => expect(mocks.fetchPictureObjectUrl).toHaveBeenCalled())
    unmount()
    expect(revoke).not.toHaveBeenCalled()
    resolve('blob:late')
    await waitFor(() => expect(revoke).toHaveBeenCalledWith('blob:late'))
  })
})
