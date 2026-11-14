// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'
import userEvent from '@testing-library/user-event'
import type * as MemberDataApi from '#/lib/member-data-api'
import {
  DELETED_NOTE,
  DOWNLOADED,
  RESTORED_NOTE,
  SESSION_EXPIRED,
  YourData,
} from './YourData'

const mocks = vi.hoisted(() => ({
  auth: {
    isLoading: false,
    isAuthenticated: true,
    getToken: vi.fn<() => Promise<string | undefined>>(),
  },
  fetchMyData: vi.fn(),
  deleteMyPage: vi.fn(),
  undoPageDeletion: vi.fn(),
  downloadMyData: vi.fn(),
}))

vi.mock('#/lib/auth', () => ({ useOrgAuth: () => mocks.auth }))
vi.mock('#/lib/member-data-api', async (original) => ({
  ...(await original<typeof MemberDataApi>()),
  fetchMyData: mocks.fetchMyData,
  deleteMyPage: mocks.deleteMyPage,
  undoPageDeletion: mocks.undoPageDeletion,
  downloadMyData: mocks.downloadMyData,
}))

const DISCLOSURE = [
  'ORG keeps a private copy of everything on it for five years from today.',
]
const live = {
  page: { slug: 'quiet-fern', displayName: 'Quiet Fern', deleted: false },
  disclosure: DISCLOSURE,
}
const deleted = (extra: Record<string, unknown> = {}) => ({
  page: {
    slug: 'quiet-fern',
    displayName: 'Quiet Fern',
    deleted: true,
    deletedAt: '2026-11-14T12:00:00Z',
    source: 'member',
    undoUntil: '2026-12-14T12:00:00Z',
    purgeAfter: '2031-11-14T12:00:00Z',
    ...extra,
  },
  disclosure: DISCLOSURE,
})

beforeEach(() => {
  mocks.auth.getToken.mockReset().mockResolvedValue('tok')
  mocks.fetchMyData.mockReset().mockResolvedValue(live)
  mocks.deleteMyPage.mockReset().mockResolvedValue({ deleted: true })
  mocks.undoPageDeletion.mockReset().mockResolvedValue({ deleted: false })
  mocks.downloadMyData.mockReset().mockResolvedValue('org-my-data.zip')
})

afterEach(cleanup)

// jsdom has no modal dialogs: a stand-in that opens and closes, so the
// component's own calls can be checked (a real browser runs the real one).
const realShowModal = HTMLDialogElement.prototype.showModal
const realClose = HTMLDialogElement.prototype.close
const showModal = vi.fn(function (this: HTMLDialogElement) {
  this.setAttribute('open', '')
})
const close = vi.fn(function (this: HTMLDialogElement) {
  this.removeAttribute('open')
})
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = showModal
  HTMLDialogElement.prototype.close = close
})
afterAll(() => {
  HTMLDialogElement.prototype.showModal = realShowModal
  HTMLDialogElement.prototype.close = realClose
})

describe('YourData', () => {
  it('downloads the member’s data and says where it went', async () => {
    render(<YourData />)
    await userEvent.click(
      await screen.findByRole('button', { name: 'Download my data' }),
    )
    expect(mocks.downloadMyData).toHaveBeenCalledWith('tok')
    expect(await screen.findByText(DOWNLOADED('org-my-data.zip'))).toBeTruthy()
  })

  it('says why a download failed', async () => {
    mocks.downloadMyData.mockRejectedValue(new Error('Come back tomorrow.'))
    render(<YourData />)
    await userEvent.click(
      await screen.findByRole('button', { name: 'Download my data' }),
    )
    expect((await screen.findByRole('alert')).textContent).toBe(
      'Come back tomorrow.',
    )
    mocks.downloadMyData.mockRejectedValue('plain')
    await userEvent.click(
      screen.getByRole('button', { name: 'Download my data' }),
    )
    expect((await screen.findByRole('alert')).textContent).toBe(
      'That did not work.',
    )
    mocks.auth.getToken.mockResolvedValue(undefined)
    await userEvent.click(
      screen.getByRole('button', { name: 'Download my data' }),
    )
    expect((await screen.findByRole('alert')).textContent).toBe(SESSION_EXPIRED)
  })

  it('asks in a dialog with the five-year wording, and only deletes on the exact address', async () => {
    render(<YourData />)
    await userEvent.click(
      await screen.findByRole('button', { name: 'Delete my page…' }),
    )
    const dialog = screen.getByRole('dialog', { name: 'Delete your page?' })
    // A native modal (review #10), not role="dialog" on a div.
    expect(dialog.tagName).toBe('DIALOG')
    expect(showModal).toHaveBeenCalled()
    expect(dialog.hasAttribute('open')).toBe(true)
    expect(dialog.getAttribute('aria-modal')).toBeNull()
    expect(dialog.textContent).toContain(DISCLOSURE[0])
    const field = screen.getByLabelText(/type your page's address/)
    expect(document.activeElement).toBe(field)
    const confirm = screen.getByRole('button', { name: 'Delete my page' })
    expect((confirm as HTMLButtonElement).disabled).toBe(true)
    await userEvent.type(field, 'quiet-fen')
    expect((confirm as HTMLButtonElement).disabled).toBe(true)
    await userEvent.type(field, '{Enter}')
    // Even a forced submit with the wrong address does nothing.
    fireEvent.submit(field.closest('form')!)
    expect(mocks.deleteMyPage).not.toHaveBeenCalled()
    await userEvent.clear(field)
    await userEvent.type(field, ' Quiet-Fern ')
    mocks.fetchMyData.mockResolvedValue(deleted())
    await userEvent.click(confirm)
    expect(mocks.deleteMyPage).toHaveBeenCalledWith('tok', ' Quiet-Fern ')
    expect(await screen.findByText(DELETED_NOTE)).toBeTruthy()
    expect(
      await screen.findByText(/You can bring it back until 14 December 2026/),
    ).toBeTruthy()
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('keeps the dialog open and says why when deleting fails', async () => {
    mocks.deleteMyPage.mockRejectedValue(new Error('This page changed.'))
    render(<YourData />)
    await userEvent.click(
      await screen.findByRole('button', { name: 'Delete my page…' }),
    )
    await userEvent.type(
      screen.getByLabelText(/type your page's address/),
      'quiet-fern',
    )
    await userEvent.click(
      screen.getByRole('button', { name: 'Delete my page' }),
    )
    expect((await screen.findByRole('alert')).textContent).toBe(
      'This page changed.',
    )
    expect(screen.getByRole('dialog')).toBeTruthy()
  })

  it('closes on "Keep my page" or Escape and returns focus to the button', async () => {
    render(<YourData />)
    await userEvent.click(
      await screen.findByRole('button', { name: 'Delete my page…' }),
    )
    await userEvent.click(screen.getByRole('button', { name: 'Keep my page' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    await userEvent.click(
      screen.getByRole('button', { name: 'Delete my page…' }),
    )
    // The browser turns Escape into a cancel event on the dialog.
    const escape = new Event('cancel', { cancelable: true })
    fireEvent(screen.getByRole('dialog'), escape)
    expect(escape.defaultPrevented).toBe(true)
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(close).toHaveBeenCalled()
    expect(document.activeElement).toBe(
      screen.getByRole('button', { name: 'Delete my page…' }),
    )
    await userEvent.keyboard('a')
    expect(mocks.deleteMyPage).not.toHaveBeenCalled()
  })

  it('brings the page back during the undo window', async () => {
    mocks.fetchMyData.mockResolvedValue(deleted())
    render(<YourData />)
    expect(
      await screen.findByText(
        /ORG keeps a private copy until 14 November 2031/,
      ),
    ).toBeTruthy()
    mocks.fetchMyData.mockResolvedValue(live)
    await userEvent.click(
      screen.getByRole('button', { name: 'Bring my page back' }),
    )
    expect(mocks.undoPageDeletion).toHaveBeenCalledWith('tok')
    expect(await screen.findByText(RESTORED_NOTE)).toBeTruthy()
    expect(
      await screen.findByRole('button', { name: 'Delete my page…' }),
    ).toBeTruthy()
  })

  it('says why bringing it back failed', async () => {
    mocks.fetchMyData.mockResolvedValue(deleted())
    mocks.undoPageDeletion.mockRejectedValue(new Error('Too late.'))
    render(<YourData />)
    await userEvent.click(
      await screen.findByRole('button', { name: 'Bring my page back' }),
    )
    expect((await screen.findByRole('alert')).textContent).toBe('Too late.')
  })

  it('points to an admin after the window, and after an account deletion', async () => {
    mocks.fetchMyData.mockResolvedValue(
      deleted({ undoUntil: undefined, source: 'account-deleted' }),
    )
    render(<YourData />)
    expect(
      await screen.findByText(/when your account was deleted/),
    ).toBeTruthy()
    expect(
      screen.getByText('To bring it back now, please ask an ORG admin.'),
    ).toBeTruthy()
    expect(
      screen.queryByRole('button', { name: 'Bring my page back' }),
    ).toBeNull()
  })

  it('has nothing to delete without a page, and still offers the download', async () => {
    mocks.fetchMyData.mockResolvedValue({ page: null, disclosure: [] })
    render(<YourData />)
    expect(await screen.findByText(/You have no member page/)).toBeTruthy()
    expect(
      screen.getByRole('button', { name: 'Download my data' }),
    ).toBeTruthy()
  })

  it('shows a load failure with a retry', async () => {
    mocks.fetchMyData.mockRejectedValueOnce(new Error('Server trouble.'))
    render(<YourData />)
    expect((await screen.findByRole('alert')).textContent).toBe(
      'Server trouble.',
    )
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(
      await screen.findByRole('button', { name: 'Download my data' }),
    ).toBeTruthy()
    cleanup()
    mocks.fetchMyData.mockRejectedValueOnce('plain')
    render(<YourData />)
    expect((await screen.findByRole('alert')).textContent).toBe(
      'That did not work.',
    )
  })

  it('asks for a sign-in when the session is gone', async () => {
    mocks.auth.getToken.mockResolvedValue(undefined)
    render(<YourData />)
    expect((await screen.findByRole('alert')).textContent).toBe(SESSION_EXPIRED)
    expect(mocks.fetchMyData).not.toHaveBeenCalled()
  })

  it('refuses a write when the session ran out meanwhile', async () => {
    render(<YourData />)
    await userEvent.click(
      await screen.findByRole('button', { name: 'Delete my page…' }),
    )
    await userEvent.type(
      screen.getByLabelText(/type your page's address/),
      'quiet-fern',
    )
    mocks.auth.getToken.mockResolvedValue(undefined)
    await userEvent.click(
      screen.getByRole('button', { name: 'Delete my page' }),
    )
    expect((await screen.findByRole('alert')).textContent).toBe(SESSION_EXPIRED)
    expect(mocks.deleteMyPage).not.toHaveBeenCalled()
  })

  it('ignores an answer that arrives after it closed', async () => {
    let resolve: (value: unknown) => void = () => undefined
    mocks.fetchMyData.mockReturnValue(new Promise((r) => (resolve = r)))
    const view = render(<YourData />)
    view.unmount()
    resolve(live)
    await new Promise((r) => setTimeout(r, 0))
    let reject: (value: unknown) => void = () => undefined
    mocks.fetchMyData.mockReturnValue(new Promise((_, r) => (reject = r)))
    const again = render(<YourData />)
    again.unmount()
    reject(new Error('late'))
    await new Promise((r) => setTimeout(r, 0))
    expect(mocks.fetchMyData).toHaveBeenCalledTimes(2)
  })
})

describe('YourData: focus and a changed page (Chunk 17 round 10)', () => {
  const heading = () => screen.getByRole('heading', { name: 'Delete my page' })

  it('moves focus to the section heading once the page is deleted', async () => {
    render(<YourData />)
    await userEvent.click(
      await screen.findByRole('button', { name: 'Delete my page…' }),
    )
    await userEvent.type(
      screen.getByLabelText(/type your page's address/),
      'quiet-fern',
    )
    mocks.fetchMyData.mockResolvedValue(deleted())
    await userEvent.click(
      screen.getByRole('button', { name: 'Delete my page' }),
    )
    await screen.findByText(/You can bring it back until/)
    expect(document.activeElement).toBe(heading())
    expect(heading().getAttribute('tabindex')).toBe('-1')
  })

  it('moves focus to the section heading once the page is back', async () => {
    mocks.fetchMyData.mockResolvedValue(deleted())
    render(<YourData />)
    const undo = await screen.findByRole('button', {
      name: 'Bring my page back',
    })
    mocks.fetchMyData.mockResolvedValue(live)
    await userEvent.click(undo)
    await screen.findByRole('button', { name: 'Delete my page…' })
    expect(document.activeElement).toBe(heading())
  })

  it('re-reads the page when deleting meets a 409', async () => {
    const { ApiError } = await import('#/lib/api')
    mocks.deleteMyPage.mockRejectedValue(
      new ApiError('This page changed.', 409),
    )
    render(<YourData />)
    await userEvent.click(
      await screen.findByRole('button', { name: 'Delete my page…' }),
    )
    await userEvent.type(
      screen.getByLabelText(/type your page's address/),
      'quiet-fern',
    )
    mocks.fetchMyData.mockResolvedValue(deleted())
    await userEvent.click(
      screen.getByRole('button', { name: 'Delete my page' }),
    )
    expect((await screen.findByRole('alert')).textContent).toBe(
      'This page changed.',
    )
    expect(await screen.findByText(/You can bring it back until/)).toBeTruthy()
    expect(mocks.fetchMyData).toHaveBeenCalledTimes(2)
  })

  it('does not re-read on an error other than 409', async () => {
    const { ApiError } = await import('#/lib/api')
    mocks.deleteMyPage.mockRejectedValue(new ApiError('Try later.', 503))
    render(<YourData />)
    await userEvent.click(
      await screen.findByRole('button', { name: 'Delete my page…' }),
    )
    await userEvent.type(
      screen.getByLabelText(/type your page's address/),
      'quiet-fern',
    )
    await userEvent.click(
      screen.getByRole('button', { name: 'Delete my page' }),
    )
    await screen.findByRole('alert')
    expect(mocks.fetchMyData).toHaveBeenCalledTimes(1)
  })
})
