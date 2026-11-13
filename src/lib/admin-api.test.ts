// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  adminTime,
  decideOnPage,
  dismissReports,
  fetchAdminMembers,
  fetchAdmins,
  fetchAdminSettings,
  fetchInbox,
  fetchInvitations,
  fetchModerationLog,
  fetchModerationQueue,
  fetchMyEamRequest,
  inviteByEmail,
  isVotingInvite,
  markInboxHandled,
  moderateComment,
  promoteToAdmin,
  removeAdminRole,
  requestEam,
  resetEamRequest,
  revokeInvitation,
  setAnonymousVoting,
  setVotingInvite,
} from './admin-api'

const fetchMock = vi.fn()

beforeEach(() => {
  fetchMock.mockReset()
  fetchMock.mockImplementation(() =>
    Promise.resolve(new Response('{"ok":true}', { status: 200 })),
  )
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

function last() {
  const [url, init] = fetchMock.mock.calls.at(-1) as [string, RequestInit]
  return {
    path: url.replace(/^.*\/api\/v1/, ''),
    method: init.method ?? 'GET',
    auth: (init.headers as Record<string, string>).Authorization,
    body: init.body ? (JSON.parse(init.body as string) as unknown) : undefined,
  }
}

describe('admin API', () => {
  it('reads every section with the token', async () => {
    const reads: Array<[() => Promise<unknown>, string]> = [
      [() => fetchAdmins('tok'), '/admin/roles'],
      [() => fetchInvitations('tok'), '/admin/invitations'],
      [() => fetchModerationLog('tok', 2), '/admin/log?page=2'],
      [
        () => fetchInbox('tok', 'handled', 3),
        '/admin/inbox?status=handled&page=3',
      ],
      [() => fetchAdminSettings('tok'), '/admin/settings'],
      [() => fetchMyEamRequest('tok'), '/me/eam-request'],
    ]
    for (const [read, path] of reads) {
      await read()
      expect(last()).toEqual({
        path,
        method: 'GET',
        auth: 'Bearer tok',
        body: undefined,
      })
    }
  })

  it('searches members only when there is something typed', async () => {
    await fetchAdminMembers('tok', 'pending', '   ', 1)
    expect(last().path).toBe('/admin/members?status=pending&page=1')
    await fetchAdminMembers('tok', 'all', ' Fern & co ', 2)
    expect(last().path).toBe('/admin/members?status=all&page=2&q=Fern+%26+co')
  })

  it('changes roles with a reason', async () => {
    await promoteToAdmin('tok', 'user_a', 'Synthetic')
    expect(last()).toMatchObject({
      path: '/admin/roles/user_a/promote',
      method: 'POST',
      body: { reason: 'Synthetic' },
    })
    await removeAdminRole('tok', 'user_a', 'Stepping back')
    expect(last()).toMatchObject({
      path: '/admin/roles/user_a/demote',
      body: { reason: 'Stepping back' },
    })
  })

  it('invites, sending a note only when given, and withdraws', async () => {
    await inviteByEmail('tok', ' a@example.org ', 'admin', '  ')
    expect(last()).toMatchObject({
      path: '/admin/invitations',
      method: 'POST',
      body: { email: 'a@example.org', as: 'admin' },
    })
    await inviteByEmail('tok', 'b@example.org', 'member', ' Met at a meeting ')
    expect(last().body).toEqual({
      email: 'b@example.org',
      as: 'member',
      reason: 'Met at a meeting',
    })
    await revokeInvitation('tok', 'inv_1')
    expect(last()).toMatchObject({
      path: '/admin/invitations/inv_1',
      method: 'DELETE',
    })
  })

  it('decides on pages: approve without a body, the rest with a reason', async () => {
    await decideOnPage('tok', 'a-page', 'approve')
    expect(last()).toMatchObject({
      path: '/admin/members/a-page/approve',
      method: 'POST',
      body: undefined,
    })
    for (const decision of ['reject', 'remove', 'restore'] as const) {
      await decideOnPage('tok', 'a-page', decision, 'Synthetic')
      expect(last()).toMatchObject({
        path: `/admin/members/a-page/${decision}`,
        body: { reason: 'Synthetic' },
      })
    }
  })

  it('handles inbox notices', async () => {
    await markInboxHandled('tok', 'e1')
    expect(last()).toMatchObject({
      path: '/admin/inbox/e1/handled',
      method: 'POST',
      body: undefined,
    })
    await resetEamRequest('tok', 'e2')
    expect(last().path).toBe('/admin/inbox/e2/reset-eam')
  })

  it('changes the settings', async () => {
    await setAnonymousVoting('tok', true)
    expect(last()).toMatchObject({
      path: '/admin/settings/vote-eligibility',
      method: 'PUT',
      body: { anonymousMayVote: true },
    })
    await setVotingInvite('tok', ' https://t.me/+abc ')
    expect(last()).toMatchObject({
      path: '/admin/settings/voting-invite',
      method: 'PUT',
      body: { inviteUrl: 'https://t.me/+abc' },
    })
  })

  it('asks for EaM with a note only when one is written', async () => {
    await requestEam('tok', '   ')
    expect(last()).toMatchObject({
      path: '/me/eam-request',
      method: 'POST',
      body: {},
    })
    await requestEam('tok', ' Ready ')
    expect(last().body).toEqual({ note: 'Ready' })
  })

  it.each([
    ['https://t.me/+AbC_1', true],
    ['https://t.me/joinchat/AbC', true],
    [' https://t.me/ORG_Voting ', true],
    ['http://t.me/+abc', false],
    ['https://example.org/+abc', false],
    ['https://t.me/+abc/more', false],
    ['', false],
  ])('treats %j as a voting invite: %s', (value, expected) => {
    expect(isVotingInvite(value)).toBe(expected)
  })

  it('shows times in UTC', () => {
    expect(adminTime('2026-11-13T10:05:00Z')).toBe('Nov 13, 2026, 10:05 AM')
  })
})

describe('moderation API (Chunk 13)', () => {
  it('reads the queue and acts on a comment or a target, each with a reason', async () => {
    await fetchModerationQueue('tok', 'resolved', 2)
    expect(last()).toMatchObject({
      path: '/admin/moderation/queue?status=resolved&page=2',
      method: 'GET',
      auth: 'Bearer tok',
    })
    await moderateComment('tok', 'cmt/1', 'hide', 'Synthetic')
    expect(last()).toMatchObject({
      path: '/admin/moderation/comments/cmt%2F1/hide',
      method: 'POST',
      body: { reason: 'Synthetic' },
    })
    await dismissReports('tok', 'member-page', 'p1', 'Synthetic')
    expect(last()).toMatchObject({
      path: '/admin/moderation/member-page/p1/dismiss',
      method: 'POST',
      body: { reason: 'Synthetic' },
    })
  })
})
