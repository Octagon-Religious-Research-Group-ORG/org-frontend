// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { CommentView } from '#/lib/comments-api'
import {
  CommentItem,
  MODERATED_ADMIN_LABELS,
  MODERATED_MINE,
  MODERATED_NOTES,
  REMOVED_NOTE,
} from './CommentItem'
import type { ThreadActions } from './CommentItem'

vi.mock('#/lib/auth', () => ({
  useOrgAuth: () => ({
    isLoading: false,
    isAuthenticated: true,
    getToken: () => Promise.resolve('tok'),
  }),
}))
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

afterEach(cleanup)

const comment = (overrides: Partial<CommentView> = {}): CommentView => ({
  commentId: 'cmt_1',
  kind: 'comment',
  source: 'member',
  author: { kind: 'member', displayName: 'Synthetic Member', slug: 'synth' },
  postedAt: '2026-11-12T09:00:00.000Z',
  removed: false,
  edited: true,
  mine: false,
  ...overrides,
})

const actions = (mayReply = true): ThreadActions => ({
  slug: 'open-page',
  mayReply,
  onChanged: vi.fn(),
  onPageChanged: vi.fn(),
})

function show(view: CommentView, mayReply = true) {
  render(
    <ol>
      <CommentItem
        comment={view}
        position="comment 1"
        actions={actions(mayReply)}
      />
    </ol>,
  )
}

describe('a comment and moderation (Chunk 13)', () => {
  it('shows readers a hidden comment as a note in place, with no buttons', () => {
    show(comment({ moderated: 'hidden' }))
    expect(screen.getByText(MODERATED_NOTES.hidden)).toBeTruthy()
    expect(screen.queryByText(MODERATED_MINE)).toBeNull()
    // No reply, no history, no report: there is nothing to act on.
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('tells the author, who may still take it down but not edit it', () => {
    show(comment({ moderated: 'removed', mine: true }))
    expect(screen.getByText(MODERATED_NOTES.removed)).toBeTruthy()
    expect(screen.getByText(MODERATED_MINE)).toBeTruthy()
    expect(
      screen.queryByRole('button', { name: /^Edit your comment/ }),
    ).toBeNull()
    expect(
      screen.getByRole('button', { name: /^Remove your comment/ }),
    ).toBeTruthy()
  })

  it('lets an admin read the text, marked as moderated, and its history', () => {
    show(comment({ moderated: 'hidden', body: 'Synthetic hidden words.' }))
    expect(screen.getByText(MODERATED_ADMIN_LABELS.hidden)).toBeTruthy()
    expect(screen.getByText('Synthetic hidden words.')).toBeTruthy()
    expect(screen.getByRole('button', { name: /^Edit history/ })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /^Reply/ })).toBeNull()
    expect(screen.queryByRole('button', { name: /^Report/ })).toBeNull()
  })

  it('keeps the author’s own removal first', () => {
    show(comment({ moderated: 'hidden', removed: true }))
    expect(screen.getByText(REMOVED_NOTE)).toBeTruthy()
    expect(screen.queryByText(MODERATED_NOTES.hidden)).toBeNull()
  })

  it('offers "Report" to a reader who may write, never on their own words', () => {
    show(comment({ body: 'Synthetic words.' }))
    expect(
      screen.getByRole('button', {
        name: /^Report comment 1, by Synthetic Member/,
      }),
    ).toBeTruthy()
    cleanup()
    show(comment({ body: 'Synthetic words.', mine: true, seq: 1 }))
    expect(screen.queryByRole('button', { name: /^Report/ })).toBeNull()
    cleanup()
    show(comment({ body: 'Synthetic words.' }), false)
    expect(screen.queryByRole('button', { name: /^Report/ })).toBeNull()
  })
})
