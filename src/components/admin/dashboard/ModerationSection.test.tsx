// @vitest-environment jsdom

import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '#/lib/api'
import type * as AdminApi from '#/lib/admin-api'
import type { QueueEntry, QueueReport } from '#/lib/admin-api'
import {
  ACCEPTED_SUGGESTION_NOTE,
  ModerationSection,
  MODERATION_EXPLAINED,
  OWN_CONTENT_NOTE,
  PAGE_REPORT_NOTE,
} from './ModerationSection'

const mocks = vi.hoisted(() => ({
  auth: {
    isLoading: false,
    isAuthenticated: true,
    user: { sub: 'user_admin' },
    getToken: vi.fn<() => Promise<string | undefined>>(),
  },
  fetchModerationQueue: vi.fn(),
  moderateComment: vi.fn(),
  dismissReports: vi.fn(),
}))

vi.mock('#/lib/auth', () => ({ useOrgAuth: () => mocks.auth }))
vi.mock('#/lib/admin-api', async (original) => ({
  ...(await original<typeof AdminApi>()),
  fetchModerationQueue: mocks.fetchModerationQueue,
  moderateComment: mocks.moderateComment,
  dismissReports: mocks.dismissReports,
}))
vi.mock('@tanstack/react-router', async () => ({
  Link: (await import('./test-helpers')).FakeLink,
}))

const report = (overrides: Record<string, unknown> = {}): QueueReport => ({
  reason: 'harassment',
  reporterUserId: 'user_r1',
  reporter: { kind: 'member', displayName: 'Synthetic Reporter' },
  reportedAt: '2026-11-13T10:00:00Z',
  ...overrides,
})

const commentEntry = (
  overrides: Partial<QueueEntry> = {},
  comment: Record<string, unknown> = {},
): QueueEntry => ({
  targetType: 'comment',
  targetId: 'cmt_1',
  count: 1,
  firstReportedAt: '2026-11-13T10:00:00Z',
  lastReportedAt: '2026-11-13T10:00:00Z',
  reports: [report({ note: 'Synthetic note.' })],
  ownContent: false,
  comment: {
    commentId: 'cmt_1',
    moderation: null,
    removedByAuthor: false,
    kind: 'comment',
    source: 'member',
    author: { kind: 'member', displayName: 'Synthetic Author' },
    authorUserId: 'user_author',
    body: 'Synthetic reported words.',
    postedAt: '2026-11-12T09:00:00Z',
    place: {
      kind: 'member-page',
      slug: 'quiet-fern',
      displayName: 'Quiet Fern',
      belief: { tabId: 'tab_a', title: 'A belief', removed: false },
    },
    ...comment,
  },
  ...overrides,
})

const pageEntry: QueueEntry = {
  targetType: 'member-page',
  targetId: '0123456789abcdef01234567',
  count: 2,
  firstReportedAt: '2026-11-13T10:00:00Z',
  lastReportedAt: '2026-11-13T11:00:00Z',
  reports: [report(), report({ reason: 'mystery' })],
  ownContent: false,
  page: {
    slug: 'loud-page',
    displayName: 'Loud Page',
    reviewStatus: 'approved',
    ownerUserId: 'user_loud',
  },
}

beforeEach(() => {
  mocks.auth.getToken.mockReset().mockResolvedValue('tok')
  mocks.fetchModerationQueue
    .mockReset()
    .mockResolvedValue({ entries: [commentEntry()], hasMore: false })
  mocks.moderateComment
    .mockReset()
    .mockResolvedValue({ moderation: 'hidden', reportsClosed: 1 })
  mocks.dismissReports.mockReset().mockResolvedValue({ dismissed: 1 })
})
afterEach(cleanup)

function renderQueue(onOpenMember = vi.fn()) {
  render(<ModerationSection onOpenMember={onOpenMember} />)
  return onOpenMember
}

describe('ModerationSection (Chunk 13)', () => {
  it('shows a reported comment with its text, place, reporters and actions', async () => {
    renderQueue()
    const card = await screen.findByRole('article', {
      name: 'Comment by Synthetic Author',
    })
    expect(screen.getByText(MODERATION_EXPLAINED)).toBeTruthy()
    expect(mocks.fetchModerationQueue).toHaveBeenCalledWith('tok', 'open', 1)
    const text = card.textContent
    expect(text).toContain('1 report')
    expect(text).toContain('Synthetic reported words.')
    expect(text).toContain('belief “A belief”')
    expect(text).toContain('account user_author')
    expect(text).toContain('Harassment or bullying')
    expect(text).toContain('Synthetic Reporter (user_r1)')
    expect(text).toContain('Synthetic note.')
    expect(card.querySelector('a')?.getAttribute('href')).toBe('/quiet-fern')
    const buttons = within(card)
      .getAllByRole('button')
      .map((b) => b.textContent)
    expect(buttons).toEqual(['Hide…', 'Remove…', 'Dismiss the reports…'])
  })

  it('hides a comment with a reason, then reloads the queue', async () => {
    const user = userEvent.setup()
    renderQueue()
    await user.click(await screen.findByRole('button', { name: 'Hide…' }))
    const submit = screen.getByRole('button', { name: 'Hide the comment' })
    expect((submit as HTMLButtonElement).disabled).toBe(true)
    await user.type(
      screen.getByLabelText('Why (for the admins and the log)'),
      'Synthetic: abuse',
    )
    await user.click(submit)
    expect(mocks.moderateComment).toHaveBeenCalledWith(
      'tok',
      'cmt_1',
      'hide',
      'Synthetic: abuse',
    )
    expect(mocks.fetchModerationQueue).toHaveBeenCalledTimes(2)
    expect(
      screen.queryByLabelText('Why (for the admins and the log)'),
    ).toBeNull()
  })

  it('keeps the form and the reason when the server refuses', async () => {
    const user = userEvent.setup()
    mocks.moderateComment.mockRejectedValueOnce(
      new ApiError('The comment is being saved right now.', 409),
    )
    renderQueue()
    await user.click(await screen.findByRole('button', { name: 'Remove…' }))
    await user.type(
      screen.getByLabelText('Why (for the admins and the log)'),
      'r',
    )
    await user.click(screen.getByRole('button', { name: 'Remove the comment' }))
    expect((await screen.findByRole('alert')).textContent).toBe(
      'The comment is being saved right now.',
    )
    expect(
      screen.getByLabelText('Why (for the admins and the log)'),
    ).toHaveProperty('value', 'r')
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.getByRole('button', { name: 'Remove…' })).toBeTruthy()
  })

  it('restores a hidden comment and dismisses reports', async () => {
    const user = userEvent.setup()
    mocks.fetchModerationQueue.mockResolvedValue({
      entries: [
        commentEntry({}, { moderation: 'hidden', removedByAuthor: true }),
      ],
      hasMore: false,
    })
    renderQueue()
    const card = await screen.findByRole('article')
    expect(card.textContent).toContain('Hidden by a moderator')
    expect(card.textContent).toContain('removed by its author')
    expect(
      within(card)
        .getAllByRole('button')
        .map((b) => b.textContent),
    ).toEqual(['Remove…', 'Restore…', 'Dismiss the reports…'])
    await user.click(screen.getByRole('button', { name: 'Restore…' }))
    await user.type(screen.getByLabelText(/Why/), 'Synthetic: fine')
    await user.click(
      screen.getByRole('button', { name: 'Restore the comment' }),
    )
    expect(mocks.moderateComment).toHaveBeenCalledWith(
      'tok',
      'cmt_1',
      'restore',
      'Synthetic: fine',
    )
    await user.click(
      await screen.findByRole('button', { name: 'Dismiss the reports…' }),
    )
    await user.type(screen.getByLabelText(/Why/), 'Synthetic: fine')
    await user.click(
      screen.getByRole('button', { name: 'Dismiss the reports' }),
    )
    expect(mocks.dismissReports).toHaveBeenCalledWith(
      'tok',
      'comment',
      'cmt_1',
      'Synthetic: fine',
    )
  })

  it('sends a reported page to the Members section, and dismisses its reports', async () => {
    const user = userEvent.setup()
    mocks.fetchModerationQueue.mockResolvedValue({
      entries: [pageEntry],
      hasMore: false,
    })
    const openMember = renderQueue()
    const card = await screen.findByRole('article', {
      name: 'Member page Loud Page',
    })
    expect(card.textContent).toContain('2 reports')
    expect(card.textContent).toContain(PAGE_REPORT_NOTE)
    expect(card.textContent).toContain('account user_loud')
    // An unknown reason is shown as sent.
    expect(card.textContent).toContain('mystery')
    expect(card.querySelector('a')?.getAttribute('href')).toBe('/loud-page')
    await user.click(screen.getByRole('button', { name: 'Open in Members' }))
    expect(openMember).toHaveBeenCalledWith('loud-page')
    await user.click(
      screen.getByRole('button', { name: 'Dismiss the reports…' }),
    )
    await user.type(screen.getByLabelText(/Why/), 'r')
    await user.click(
      screen.getByRole('button', { name: 'Dismiss the reports' }),
    )
    expect(mocks.dismissReports).toHaveBeenCalledWith(
      'tok',
      'member-page',
      pageEntry.targetId,
      'r',
    )
  })

  it('shows the admin’s own content without actions, and other kinds of target', async () => {
    mocks.fetchModerationQueue.mockResolvedValue({
      entries: [
        commentEntry({ ownContent: true }),
        commentEntry(
          { targetId: 'cmt_2', count: 25 },
          {
            commentId: 'cmt_2',
            kind: 'suggestion',
            source: 'imported',
            author: { kind: 'imported', name: 'Synthetic Pages Author' },
            authorUserId: undefined,
            proposedText: 'Synthetic rewording.',
            stance: 'agree',
            place: { kind: 'org-page', pageId: 'about' },
          },
        ),
        commentEntry(
          { targetId: 'cmt_3' },
          {
            commentId: 'cmt_3',
            place: { kind: 'member-page' },
            moderation: 'removed',
          },
        ),
        commentEntry(
          { targetId: 'cmt_4' },
          {
            commentId: 'cmt_4',
            place: {
              kind: 'member-page',
              slug: 'quiet-fern',
              displayName: 'Quiet Fern',
              belief: { tabId: 't', title: 'Gone', removed: true },
            },
          },
        ),
        commentEntry(
          { targetId: 'cmt_5' },
          {
            commentId: 'cmt_5',
            place: {
              kind: 'member-page',
              slug: 'quiet-fern',
              displayName: 'Quiet Fern',
            },
          },
        ),
        {
          ...pageEntry,
          targetType: 'comment',
          targetId: 'cmt_gone',
          page: undefined,
          missing: true,
        },
        { ...pageEntry, targetId: 'p_gone', page: undefined, missing: true },
        {
          ...pageEntry,
          targetId: 'p_imported',
          page: { ...pageEntry.page!, ownerUserId: undefined },
        },
      ],
      hasMore: false,
    })
    renderQueue()
    const cards = await screen.findAllByRole('article')
    expect(cards[0].textContent).toContain(OWN_CONTENT_NOTE)
    expect(within(cards[0]).queryAllByRole('button')).toHaveLength(0)
    expect(cards[1].getAttribute('aria-label')).toBe(
      'Suggested rewording by Synthetic Pages Author',
    )
    expect(cards[1].textContent).toContain('Synthetic rewording.')
    expect(cards[1].textContent).toContain('Showing the first 1.')
    expect(cards[1].textContent).toContain('agree')
    expect(cards[1].querySelector('a')?.getAttribute('href')).toBe('/about')
    expect(cards[2].textContent).toContain('a page that no longer exists')
    expect(cards[2].textContent).toContain('Removed by a moderator')
    expect(
      within(cards[2])
        .getAllByRole('button')
        .map((b) => b.textContent),
    ).toEqual(['Hide…', 'Restore…', 'Dismiss the reports…'])
    expect(cards[3].textContent).toContain('(removed by its owner)')
    expect(cards[4].textContent).toContain('About this page')
    expect(cards[5].getAttribute('aria-label')).toBe(
      'A comment that no longer exists',
    )
    expect(cards[6].getAttribute('aria-label')).toBe(
      'A page that no longer exists',
    )
    expect(cards[7].textContent).toContain('imported, unclaimed')
  })

  it('lists closed reports with how they were closed, and pages', async () => {
    const user = userEvent.setup()
    renderQueue()
    await screen.findByRole('article')
    mocks.fetchModerationQueue.mockResolvedValue({
      entries: [
        commentEntry(
          {
            reports: [
              report({
                resolution: 'member-removed',
                resolvedBy: 'user_admin_b',
                resolvedAt: '2026-11-13T12:00:00Z',
              }),
              report({ resolution: 'dismissed' }),
            ],
          },
          { moderation: 'hidden' },
        ),
      ],
      hasMore: true,
    })
    await user.click(screen.getByRole('tab', { name: 'Closed' }))
    const card = await screen.findByRole('article')
    expect(mocks.fetchModerationQueue).toHaveBeenLastCalledWith(
      'tok',
      'resolved',
      1,
    )
    expect(card.textContent).toContain('Page removed Nov 13, 2026, 12:00 PM')
    expect(card.textContent).toContain('Dismissed')
    // Nothing open to dismiss here.
    expect(
      within(card)
        .getAllByRole('button')
        .map((b) => b.textContent),
    ).toEqual(['Remove…', 'Restore…'])
    await user.click(screen.getByRole('button', { name: 'Older' }))
    expect(mocks.fetchModerationQueue).toHaveBeenLastCalledWith(
      'tok',
      'resolved',
      2,
    )
    await user.click(screen.getByRole('tab', { name: 'Open' }))
    expect(mocks.fetchModerationQueue).toHaveBeenLastCalledWith(
      'tok',
      'open',
      1,
    )
  })

  it('says when nothing is reported', async () => {
    mocks.fetchModerationQueue.mockResolvedValue({
      entries: [],
      hasMore: false,
    })
    renderQueue()
    expect(await screen.findByText('Nothing here.')).toBeTruthy()
  })
})

describe('an accepted suggestion in the queue (review L-2)', () => {
  it('says the belief keeps its wording, and still offers hiding it', async () => {
    mocks.fetchModerationQueue.mockResolvedValue({
      entries: [
        commentEntry(
          {},
          {
            kind: 'suggestion',
            proposedText: 'Synthetic accepted wording.',
            suggestionStatus: 'accepted',
          },
        ),
        commentEntry(
          { targetId: 'cmt_2' },
          {
            commentId: 'cmt_2',
            kind: 'suggestion',
            proposedText: 'Synthetic pending wording.',
            suggestionStatus: 'pending',
          },
        ),
      ],
      hasMore: false,
    })
    renderQueue()
    const cards = await screen.findAllByRole('article')
    expect(cards[0].textContent).toContain(ACCEPTED_SUGGESTION_NOTE)
    expect(within(cards[0]).getByRole('button', { name: 'Hide…' })).toBeTruthy()
    expect(cards[1].textContent).not.toContain(ACCEPTED_SUGGESTION_NOTE)
  })
})
