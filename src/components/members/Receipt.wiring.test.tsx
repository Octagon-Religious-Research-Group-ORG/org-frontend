// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { CommentView } from '#/lib/comments-api'
import type { ReceiptTarget } from '#/lib/receipts-api'
import { BeliefTabs } from './BeliefTabs'
import { CommentItem } from './CommentItem'
import type { ThreadActions } from './CommentItem'

vi.mock('#/lib/auth', () => ({
  useOrgAuth: () => ({
    isLoading: false,
    isAuthenticated: false,
    getToken: () => Promise.resolve(undefined),
  }),
}))
vi.mock('@tanstack/react-router', async (original) => ({
  ...(await original<object>()),
  Link: ({ children }: { children: ReactNode }) => <a href="/x">{children}</a>,
}))
vi.mock('./ReceiptPanel', () => ({
  ReceiptPanel: (props: {
    target: ReceiptTarget
    label: string
    onClose: () => void
  }) => (
    <div data-testid="receipt">
      {JSON.stringify(props.target)} {props.label}
      <button type="button" onClick={props.onClose}>
        close receipt stub
      </button>
    </div>
  ),
}))
vi.mock('./CommentThread', () => ({ CommentThread: () => null }))

afterEach(cleanup)

describe('the receipt control on a belief (Chunk 16)', () => {
  it('opens the receipt of the open belief’s current text, and closes it', () => {
    render(
      <BeliefTabs
        onChanged={() => undefined}
        slug="quiet-fern"
        tabs={[
          {
            tabId: 't1',
            title: 'First',
            needsReview: false,
            paragraphs: [
              { blockId: 'b1', kind: 'paragraph', label: '', text: 'One' },
            ],
          },
        ]}
      />,
    )
    const button = screen.getByRole('button', { name: 'Receipt' })
    expect(button.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(button)
    expect(screen.getByTestId('receipt').textContent).toContain(
      '{"kind":"belief","slug":"quiet-fern","tabId":"t1"} “First”',
    )
    fireEvent.click(screen.getByRole('button', { name: 'Receipt' }))
    expect(screen.queryByTestId('receipt')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Receipt' }))
    fireEvent.click(screen.getByText('close receipt stub'))
    expect(screen.queryByTestId('receipt')).toBeNull()
  })
})

const comment = (overrides: Partial<CommentView> = {}): CommentView => ({
  commentId: 'cmt_1',
  kind: 'comment',
  source: 'member',
  author: { kind: 'member', displayName: 'Synthetic Member', slug: 'synth' },
  postedAt: '2026-11-12T09:00:00.000Z',
  removed: false,
  edited: false,
  mine: false,
  body: 'Synthetic words.',
  ...overrides,
})

const actions = (where: { slug: string } | { orgPageId: string }) =>
  ({
    ...where,
    mayReply: false,
    onChanged: vi.fn(),
    onPageChanged: vi.fn(),
  }) as ThreadActions

function show(
  view: CommentView,
  where: { slug: string } | { orgPageId: string },
) {
  render(
    <ol>
      <CommentItem
        comment={view}
        position="comment 1"
        actions={actions(where)}
      />
    </ol>,
  )
}

describe('the receipt control on a comment', () => {
  it('on a member page and on an ORG page', () => {
    show(comment(), { slug: 'open-page' })
    fireEvent.click(
      screen.getByRole('button', { name: /^Receipt for comment 1/ }),
    )
    expect(screen.getByTestId('receipt').textContent).toContain(
      '{"kind":"comment","slug":"open-page","commentId":"cmt_1"}',
    )
    fireEvent.click(
      screen.getByRole('button', { name: /^Receipt for comment 1/ }),
    )
    expect(screen.queryByTestId('receipt')).toBeNull()
    cleanup()
    show(comment(), { orgPageId: 'about' })
    fireEvent.click(
      screen.getByRole('button', { name: /^Receipt for comment 1/ }),
    )
    expect(screen.getByTestId('receipt').textContent).toContain(
      '{"kind":"org-comment","pageId":"about","commentId":"cmt_1"}',
    )
    fireEvent.click(screen.getByText('close receipt stub'))
    expect(screen.queryByTestId('receipt')).toBeNull()
  })

  it('is not offered where there is no version to stamp, or no text to read', () => {
    for (const view of [
      comment({ source: 'imported' }),
      comment({ kind: 'suggestion' }),
      comment({ moderated: 'hidden', body: undefined }),
      comment({ removed: true, body: undefined }),
    ]) {
      show(view, { slug: 'open-page' })
      expect(screen.queryByRole('button', { name: /^Receipt/ })).toBeNull()
      cleanup()
    }
  })
})
