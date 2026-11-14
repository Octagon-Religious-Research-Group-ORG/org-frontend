// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type * as NotificationsApi from '#/lib/notifications-api'
import { DONE, NO_LINK, UnsubscribePanel } from './UnsubscribePanel'

const mocks = vi.hoisted(() => ({ unsubscribe: vi.fn() }))

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to }: { children: ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}))
vi.mock('#/lib/notifications-api', async (original) => ({
  ...(await original<typeof NotificationsApi>()),
  unsubscribe: mocks.unsubscribe,
}))

const TOKEN = 'v1.dXNlcl9h.replies.c2ln'

beforeEach(() => {
  mocks.unsubscribe
    .mockReset()
    .mockResolvedValue({ unsubscribed: true, scope: 'replies' })
})
afterEach(cleanup)

describe('UnsubscribePanel (Chunk 14)', () => {
  it('says what the link turns off, and does it only on the button', async () => {
    const user = userEvent.setup()
    render(<UnsubscribePanel token={TOKEN} />)
    expect(
      screen.getByText('Turn off emails about replies to your comments?'),
    ).toBeTruthy()
    // Opening the page changes nothing (a mail scanner may open it).
    expect(mocks.unsubscribe).not.toHaveBeenCalled()
    await user.click(
      screen.getByRole('button', { name: 'Turn these emails off' }),
    )
    expect(mocks.unsubscribe).toHaveBeenCalledWith(TOKEN)
    expect((await screen.findByRole('status')).textContent).toBe(DONE)
    expect(
      screen
        .getByRole('link', { name: 'Manage all your email settings' })
        .getAttribute('href'),
    ).toBe('/settings/notifications')
  })

  it('shows the server’s answer to a bad link, and lets the reader try again', async () => {
    const user = userEvent.setup()
    mocks.unsubscribe
      .mockRejectedValueOnce(new Error('This link is not valid.'))
      .mockRejectedValueOnce('odd')
    render(<UnsubscribePanel token={TOKEN} />)
    const button = screen.getByRole('button', { name: 'Turn these emails off' })
    await user.click(button)
    expect((await screen.findByRole('alert')).textContent).toBe(
      'This link is not valid.',
    )
    await user.click(button)
    expect((await screen.findByRole('alert')).textContent).toBe(
      'That did not work.',
    )
  })

  it('explains itself when opened without a usable link', () => {
    render(<UnsubscribePanel />)
    expect(screen.getByRole('alert').textContent).toBe(NO_LINK)
    cleanup()
    render(<UnsubscribePanel token="v1.x.everything.sig" />)
    expect(screen.getByRole('alert').textContent).toBe(NO_LINK)
    expect(screen.queryByRole('button')).toBeNull()
  })
})
