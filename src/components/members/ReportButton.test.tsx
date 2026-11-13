// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type * as CommentsApi from '#/lib/comments-api'
import { ApiError } from '#/lib/api'
import { REPORT_EXPLAINED, REPORT_SENT, ReportButton } from './ReportButton'

const mocks = vi.hoisted(() => ({
  auth: {
    isLoading: false,
    isAuthenticated: true,
    getToken: vi.fn<() => Promise<string | undefined>>(),
  },
  reportContent: vi.fn(),
}))

vi.mock('#/lib/auth', () => ({ useOrgAuth: () => mocks.auth }))
vi.mock('#/lib/comments-api', async (original) => ({
  ...(await original<typeof CommentsApi>()),
  reportContent: mocks.reportContent,
}))

beforeEach(() => {
  mocks.auth.getToken.mockReset().mockResolvedValue('tok')
  mocks.reportContent.mockReset().mockResolvedValue({ reported: true })
})
afterEach(cleanup)

describe('ReportButton (Chunk 13)', () => {
  it('sends a reason and a note, then says only that it arrived', async () => {
    const user = userEvent.setup()
    render(
      <ReportButton
        target={{ targetType: 'comment', commentId: 'cmt_1' }}
        label="Report comment 1"
      />,
    )
    await user.click(screen.getByRole('button', { name: 'Report comment 1' }))
    expect(screen.getByText(REPORT_EXPLAINED)).toBeTruthy()
    await user.selectOptions(
      screen.getByLabelText('What is wrong'),
      'Spam or advertising',
    )
    const note = screen.getByLabelText(/Anything the admins should know/)
    expect(note.getAttribute('maxlength')).toBe('1000')
    await user.type(note, 'Synthetic note.')
    await user.click(screen.getByRole('button', { name: 'Send report' }))
    expect(mocks.reportContent).toHaveBeenCalledWith(
      'tok',
      { targetType: 'comment', commentId: 'cmt_1' },
      'spam',
      'Synthetic note.',
    )
    expect((await screen.findByRole('status')).textContent).toBe(REPORT_SENT)
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('shows the server’s refusal and keeps the form; cancel closes it', async () => {
    const user = userEvent.setup()
    mocks.reportContent.mockRejectedValueOnce(
      new ApiError('You have already reported this.', 409),
    )
    render(
      <ReportButton
        target={{ targetType: 'member-page', slug: 'some-page' }}
        label="Report the page"
        text="Report this page"
      />,
    )
    await user.click(screen.getByRole('button', { name: 'Report the page' }))
    await user.click(screen.getByRole('button', { name: 'Send report' }))
    expect((await screen.findByRole('alert')).textContent).toBe(
      'You have already reported this.',
    )
    expect(mocks.reportContent).toHaveBeenCalledWith(
      'tok',
      { targetType: 'member-page', slug: 'some-page' },
      'harassment',
      '',
    )
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(
      screen.getByRole('button', { name: 'Report the page' }).textContent,
    ).toBe('Report this page')
  })
})
