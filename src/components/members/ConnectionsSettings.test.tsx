// @vitest-environment jsdom

import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type * as ConnectionsApi from '#/lib/connections-api'
import type { ConnectionsOverview } from '#/lib/connections-api'
import {
  CONTACTS_EXPLAINED,
  ConnectionsSettings,
  DEFAULT_FOLLOWS_PAGE,
  explained,
  PRIVATE_PAGE_NOTE,
  SAVED,
  SESSION_EXPIRED,
} from './ConnectionsSettings'

const mocks = vi.hoisted(() => ({
  auth: {
    isLoading: false,
    isAuthenticated: true,
    getToken: vi.fn<() => Promise<string | undefined>>(),
  },
  fetchConnections: vi.fn(),
  saveConnectionSettings: vi.fn(),
  sendConnectionRequest: vi.fn(),
  answerConnection: vi.fn(),
  blockMember: vi.fn(),
  unblockMember: vi.fn(),
  reportContent: vi.fn(),
}))

vi.mock('#/lib/auth', () => ({ useOrgAuth: () => mocks.auth }))
vi.mock('#/lib/connections-api', async (original) => ({
  ...(await original<typeof ConnectionsApi>()),
  fetchConnections: mocks.fetchConnections,
  saveConnectionSettings: mocks.saveConnectionSettings,
  sendConnectionRequest: mocks.sendConnectionRequest,
  answerConnection: mocks.answerConnection,
  blockMember: mocks.blockMember,
  unblockMember: mocks.unblockMember,
}))
vi.mock('#/lib/comments-api', async (original) => ({
  ...(await original<object>()),
  reportContent: mocks.reportContent,
}))
vi.mock('@tanstack/react-router', async () => ({
  Link: (await import('../admin/dashboard/test-helpers')).FakeLink,
}))

const TERMS = { singular: 'connection request', plural: 'connection requests' }

function overview(
  over: Partial<ConnectionsOverview> = {},
): ConnectionsOverview {
  return {
    terms: TERMS,
    me: {
      eligible: true,
      visibility: 'public',
      openTo: 'any-member',
      openToChosen: false,
      contacts: [{ method: 'email', value: 'a@example.org' }],
      pendingSent: 1,
      maxPendingSent: 20,
    },
    incoming: [
      {
        id: 'in1',
        member: { name: 'Member C' },
        note: 'Synthetic hello',
        sentAt: '2026-11-18T10:00:00.000Z',
      },
      {
        id: 'in2',
        member: { name: 'Member E', slug: 'member-e' },
        sentAt: '2026-11-18T11:00:00.000Z',
      },
    ],
    outgoing: [
      {
        id: 'out1',
        member: { name: 'Member B', slug: 'member-b' },
        note: 'mine',
        sentAt: '2026-11-17T10:00:00.000Z',
      },
      {
        id: 'out2',
        member: { name: 'Member F', slug: 'member-f' },
        sentAt: '2026-11-17T11:00:00.000Z',
      },
    ],
    connected: [
      {
        id: 'con1',
        member: { name: 'Member D', slug: 'member-d' },
        since: '2026-11-10T10:00:00.000Z',
        contacts: [{ method: 'signal', value: 'd.example' }],
      },
    ],
    blocked: [
      {
        id: 'blk1',
        member: { name: 'A former member' },
        since: '2026-11-01T10:00:00.000Z',
      },
    ],
    ...over,
  }
}

beforeEach(() => {
  mocks.auth.getToken.mockReset().mockResolvedValue('tok')
  mocks.fetchConnections.mockReset().mockResolvedValue(overview())
  for (const write of [
    mocks.saveConnectionSettings,
    mocks.sendConnectionRequest,
    mocks.answerConnection,
    mocks.blockMember,
    mocks.unblockMember,
    mocks.reportContent,
  ]) {
    write.mockReset().mockResolvedValue({ ok: true })
  }
})
afterEach(cleanup)

describe('ConnectionsSettings (Chunk 18)', () => {
  it('explains the feature and shows the four lists', async () => {
    render(<ConnectionsSettings />)
    expect(await screen.findByText(explained(TERMS))).toBeTruthy()
    expect(explained(TERMS)).toMatch(/^A connection request asks/)
    expect(
      screen.getByText(
        '1 of 20 connection requests you sent are waiting for an answer.',
      ),
    ).toBeTruthy()
    const incoming = screen.getByRole('region', {
      name: 'Connection requests you received',
    })
    expect(incoming.textContent).toContain('Member C · 2026-11-18')
    expect(incoming.textContent).toContain('Synthetic hello')
    // A Private member's name is not a link; another member's is.
    expect(within(incoming).getAllByRole('link')).toHaveLength(1)
    const connected = screen.getByRole('region', { name: 'Connected' })
    expect(connected.textContent).toContain('d.example')
    expect(
      screen.getByRole('region', { name: 'Blocked' }).textContent,
    ).toContain('A former member')
    expect(screen.getByText(DEFAULT_FOLLOWS_PAGE)).toBeTruthy()
    expect(screen.getByText(CONTACTS_EXPLAINED)).toBeTruthy()
  })

  it('acts on each row, then reloads', async () => {
    const user = userEvent.setup()
    render(<ConnectionsSettings />)
    await user.click(
      await screen.findByRole('button', { name: 'Accept Member C' }),
    )
    expect(mocks.answerConnection).toHaveBeenCalledWith('tok', 'in1', 'accept')
    await user.click(screen.getByRole('button', { name: 'Decline Member E' }))
    expect(mocks.answerConnection).toHaveBeenCalledWith('tok', 'in2', 'decline')
    await user.click(
      screen.getByRole('button', {
        name: 'Withdraw your connection request to Member B',
      }),
    )
    expect(mocks.answerConnection).toHaveBeenCalledWith(
      'tok',
      'out1',
      'withdraw',
    )
    await user.click(
      screen.getByRole('button', { name: 'Disconnect from Member D' }),
    )
    expect(mocks.answerConnection).toHaveBeenCalledWith(
      'tok',
      'con1',
      'disconnect',
    )
    await user.click(screen.getByRole('button', { name: 'Block Member C' }))
    expect(mocks.blockMember).toHaveBeenCalledWith('tok', {
      connectionId: 'in1',
    })
    await user.click(
      screen.getByRole('button', { name: 'Unblock A former member' }),
    )
    expect(mocks.unblockMember).toHaveBeenCalledWith('tok', 'blk1')
    expect(mocks.fetchConnections).toHaveBeenCalledTimes(7)
  })

  it('reports a note it received', async () => {
    const user = userEvent.setup()
    render(<ConnectionsSettings />)
    await user.click(
      await screen.findByRole('button', {
        name: 'Report the note from Member C',
      }),
    )
    await user.click(screen.getByRole('button', { name: 'Send report' }))
    expect(mocks.reportContent).toHaveBeenCalledWith(
      'tok',
      { targetType: 'connection-note', connectionId: 'in1' },
      'harassment',
      '',
    )
  })

  it('says why an action failed and changes nothing', async () => {
    const user = userEvent.setup()
    mocks.answerConnection.mockRejectedValue(new Error('Changed meanwhile.'))
    render(<ConnectionsSettings />)
    await user.click(
      await screen.findByRole('button', { name: 'Accept Member C' }),
    )
    expect((await screen.findByRole('alert')).textContent).toBe(
      'Changed meanwhile.',
    )
    expect(mocks.fetchConnections).toHaveBeenCalledTimes(1)
  })

  it('saves who may send requests, and the contact rows for connections', async () => {
    const user = userEvent.setup()
    render(<ConnectionsSettings />)
    await user.click(await screen.findByLabelText('Public members only'))
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(mocks.saveConnectionSettings).toHaveBeenCalledWith('tok', {
      openTo: 'public-members',
    })
    expect((await screen.findByRole('status')).textContent).toBe(SAVED)
    await user.clear(screen.getByLabelText('Contact for connections 1'))
    await user.type(
      screen.getByLabelText('Contact for connections 1'),
      'b@example.org',
    )
    await user.click(
      screen.getByRole('button', { name: 'Save contact details' }),
    )
    expect(mocks.saveConnectionSettings).toHaveBeenLastCalledWith('tok', {
      contacts: [{ method: 'email', value: 'b@example.org' }],
    })
    mocks.saveConnectionSettings.mockRejectedValue(new Error('Too long.'))
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect((await screen.findByRole('alert')).textContent).toBe('Too long.')
  })

  it('shows only the lists to a member without an approved page', async () => {
    mocks.fetchConnections.mockResolvedValue(
      overview({
        me: { ...overview().me, eligible: false, openToChosen: true },
        incoming: [],
        outgoing: [],
        connected: [],
        blocked: [],
      }),
    )
    render(<ConnectionsSettings />)
    expect(
      await screen.findByText(
        'Only members with an approved page can send or receive connection requests.',
      ),
    ).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Save' })).toBeNull()
    expect(screen.getAllByText('None.')).toHaveLength(4)
  })

  it('offers a retry when the lists do not load', async () => {
    const user = userEvent.setup()
    mocks.auth.getToken.mockResolvedValueOnce(undefined)
    render(<ConnectionsSettings />)
    expect((await screen.findByRole('alert')).textContent).toBe(SESSION_EXPIRED)
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByText(explained(TERMS))).toBeTruthy()
    cleanup()
    mocks.fetchConnections.mockRejectedValue('not an error')
    render(<ConnectionsSettings />)
    expect((await screen.findByRole('alert')).textContent).toBe(
      'That did not load.',
    )
  })

  it('ignores an answer that arrives after the page was left', async () => {
    let answer: (value: ConnectionsOverview) => void = () => undefined
    let fail: (error: Error) => void = () => undefined
    mocks.fetchConnections.mockReturnValueOnce(
      new Promise((resolve) => {
        answer = resolve
      }),
    )
    const first = render(<ConnectionsSettings />)
    await vi.waitFor(() => expect(mocks.fetchConnections).toHaveBeenCalled())
    first.unmount()
    answer(overview())
    mocks.fetchConnections.mockReturnValueOnce(
      new Promise((_, reject) => {
        fail = reject
      }),
    )
    const second = render(<ConnectionsSettings />)
    await vi.waitFor(() =>
      expect(mocks.fetchConnections).toHaveBeenCalledTimes(2),
    )
    second.unmount()
    fail(new Error('late'))
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(screen.queryByRole('alert')).toBeNull()
  })
})

describe('review round 1', () => {
  it('#1 offers no sending by page address', async () => {
    render(<ConnectionsSettings />)
    await screen.findByText(explained(TERMS))
    expect(screen.queryByLabelText('Page address')).toBeNull()
  })

  it('#1 tells a Private member that nobody can find their page', async () => {
    mocks.fetchConnections.mockResolvedValue(
      overview({ me: { ...overview().me, visibility: 'unlisted' } }),
    )
    render(<ConnectionsSettings />)
    expect(await screen.findByText(PRIVATE_PAGE_NOTE(TERMS))).toBeTruthy()
  })

  it('#2 lists a request to a member no longer available, and withdraws it', async () => {
    const user = userEvent.setup()
    mocks.fetchConnections.mockResolvedValue(
      overview({
        outgoing: [
          {
            id: 'gone1',
            member: { name: 'A member' },
            sentAt: '2026-11-17T10:00:00.000Z',
            unavailable: true,
          },
        ],
      }),
    )
    render(<ConnectionsSettings />)
    const sent = await screen.findByRole('region', {
      name: 'Connection requests you sent',
    })
    expect(sent.textContent).toContain('no longer available')
    await user.click(
      within(sent).getByRole('button', {
        name: 'Withdraw your connection request to A member',
      }),
    )
    expect(mocks.answerConnection).toHaveBeenCalledWith(
      'tok',
      'gone1',
      'withdraw',
    )
  })
})
