// @vitest-environment jsdom

import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type * as ConnectionsApi from '#/lib/connections-api'
import type { Relation } from '#/lib/connections-api'
import {
  BLOCK_EXPLAINED,
  ConnectionButton,
  reasonText,
  SharedContacts,
} from './ConnectionButton'
import { forgetConnectionTerms } from './use-connection-terms'

const mocks = vi.hoisted(() => ({
  auth: {
    isLoading: false,
    isAuthenticated: true,
    getToken: vi.fn<() => Promise<string | undefined>>(),
  },
  fetchConnectionTerms: vi.fn(),
  fetchRelation: vi.fn(),
  sendConnectionRequest: vi.fn(),
  answerConnection: vi.fn(),
  blockMember: vi.fn(),
  unblockMember: vi.fn(),
}))

vi.mock('#/lib/auth', () => ({ useOrgAuth: () => mocks.auth }))
vi.mock('#/lib/connections-api', async (original) => ({
  ...(await original<typeof ConnectionsApi>()),
  fetchConnectionTerms: mocks.fetchConnectionTerms,
  fetchRelation: mocks.fetchRelation,
  sendConnectionRequest: mocks.sendConnectionRequest,
  answerConnection: mocks.answerConnection,
  blockMember: mocks.blockMember,
  unblockMember: mocks.unblockMember,
}))
vi.mock('@tanstack/react-router', async () => ({
  Link: (await import('../admin/dashboard/test-helpers')).FakeLink,
}))

const TERMS = { singular: 'introduction', plural: 'introductions' }

beforeEach(() => {
  forgetConnectionTerms()
  mocks.auth.getToken.mockReset().mockResolvedValue('tok')
  mocks.fetchConnectionTerms.mockReset().mockResolvedValue(TERMS)
  mocks.fetchRelation.mockReset()
  for (const write of [
    mocks.sendConnectionRequest,
    mocks.answerConnection,
    mocks.blockMember,
    mocks.unblockMember,
  ]) {
    write.mockReset().mockResolvedValue({ ok: true })
  }
})
afterEach(cleanup)

function show(relation: Relation | Error) {
  if (relation instanceof Error) mocks.fetchRelation.mockRejectedValue(relation)
  else mocks.fetchRelation.mockResolvedValue(relation)
  return render(<ConnectionButton slug="member-b" displayName="Member B" />)
}

describe('ConnectionButton (Chunk 18)', () => {
  it('sends a request with a note, in the admins’ name for it', async () => {
    const user = userEvent.setup()
    show({ state: 'none', canRequest: true })
    await user.click(
      await screen.findByRole('button', { name: 'Send an introduction' }),
    )
    const form = screen.getByRole('form', {
      name: 'Send an introduction to Member B',
    })
    await user.type(within(form).getByLabelText('A note (optional)'), 'hi')
    mocks.fetchRelation.mockResolvedValue({ state: 'outgoing', id: 'c1' })
    mocks.sendConnectionRequest.mockResolvedValue({
      status: 'pending',
      id: 'c1',
    })
    await user.click(within(form).getByRole('button', { name: 'Send' }))
    expect(mocks.sendConnectionRequest).toHaveBeenCalledWith(
      'tok',
      'member-b',
      'hi',
    )
    expect((await screen.findByRole('status')).textContent).toBe(
      'Introduction sent.',
    )
    expect(
      await screen.findByText('Introduction sent. Waiting for an answer.'),
    ).toBeTruthy()
  })

  it('says when sending connected the two at once, and lets the form close', async () => {
    const user = userEvent.setup()
    show({ state: 'none', canRequest: true })
    await user.click(
      await screen.findByRole('button', { name: 'Send an introduction' }),
    )
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    await user.click(
      screen.getByRole('button', { name: 'Send an introduction' }),
    )
    mocks.sendConnectionRequest.mockResolvedValue({
      status: 'accepted',
      id: 'c1',
      crossed: true,
    })
    await user.click(screen.getByRole('button', { name: 'Send' }))
    expect((await screen.findByRole('status')).textContent).toBe(
      'Member B had already sent you an introduction, so you are now connected.',
    )
  })

  it('keeps the form and says why when sending is refused', async () => {
    const user = userEvent.setup()
    show({ state: 'none', canRequest: true })
    await user.click(
      await screen.findByRole('button', { name: 'Send an introduction' }),
    )
    mocks.sendConnectionRequest.mockRejectedValue(new Error('Not open.'))
    await user.click(screen.getByRole('button', { name: 'Send' }))
    expect((await screen.findByRole('alert')).textContent).toBe('Not open.')
    expect(screen.getByLabelText('A note (optional)')).toBeTruthy()
  })

  it('disables sending and says why, for each reason', async () => {
    show({
      state: 'none',
      canRequest: false,
      reason: 'cooldown',
      until: '2026-12-01T00:00:00.000Z',
    })
    const button = await screen.findByRole('button', {
      name: 'Send an introduction',
    })
    expect((button as HTMLButtonElement).disabled).toBe(true)
    expect(
      document.getElementById(button.getAttribute('aria-describedby')!)
        ?.textContent,
    ).toBe(
      'This member did not accept your last introduction. You can send another after 2026-12-01.',
    )
    expect(reasonText('not-eligible', TERMS)).toBe(
      'Only members with an approved page can send introductions.',
    )
    expect(reasonText('private-needs-public', TERMS)).toContain(
      'only to members whose page is Public',
    )
    expect(reasonText('limit', TERMS)).toContain('too many introductions')
    expect(reasonText('not-open', TERMS)).toBe(
      'This member is not open to introductions from you.',
    )
    expect(reasonText('cooldown', TERMS)).toContain('after a while')
  })

  it('reads "not open" when the server gives no reason, and offers no block without a page', async () => {
    const { unmount } = show({ state: 'none', canRequest: false })
    expect(
      await screen.findByText(
        'This member is not open to introductions from you.',
      ),
    ).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Block…' })).toBeTruthy()
    unmount()
    show({ state: 'none', canRequest: false, reason: 'not-eligible' })
    await screen.findByText(
      'Only members with an approved page can send introductions.',
    )
    expect(screen.queryByRole('button', { name: 'Block…' })).toBeNull()
  })

  it('withdraws a request waiting for an answer', async () => {
    const user = userEvent.setup()
    show({ state: 'outgoing', id: 'c1' })
    await user.click(await screen.findByRole('button', { name: 'Withdraw' }))
    expect(mocks.answerConnection).toHaveBeenCalledWith('tok', 'c1', 'withdraw')
    expect((await screen.findByRole('status')).textContent).toBe(
      'You withdrew your introduction.',
    )
  })

  it('accepts or declines a request received, linking to its note', async () => {
    const user = userEvent.setup()
    show({ state: 'incoming', id: 'c2' })
    const link = await screen.findByRole('link', {
      name: 'See it with its note',
    })
    expect(link.getAttribute('href')).toBe('/settings/connections')
    await user.click(screen.getByRole('button', { name: 'Accept' }))
    expect(mocks.answerConnection).toHaveBeenCalledWith('tok', 'c2', 'accept')
    expect((await screen.findByRole('status')).textContent).toBe(
      'You are now connected.',
    )
    cleanup()
    show({ state: 'incoming', id: 'c3' })
    await user.click(await screen.findByRole('button', { name: 'Decline' }))
    expect(mocks.answerConnection).toHaveBeenCalledWith('tok', 'c3', 'decline')
  })

  it('shows a connection’s contact details and disconnects', async () => {
    const user = userEvent.setup()
    show({
      state: 'connected',
      id: 'c4',
      contacts: [
        { method: 'signal', value: 'alice.example' },
        { method: 'other', value: 'by post' },
      ],
    })
    const contacts = await screen.findByRole('region', {
      name: 'Contact details for connections',
    })
    expect(contacts.textContent).toContain('Signalalice.example')
    expect(contacts.textContent).toContain('Otherby post')
    await user.click(screen.getByRole('button', { name: 'Disconnect' }))
    expect(mocks.answerConnection).toHaveBeenCalledWith(
      'tok',
      'c4',
      'disconnect',
    )
  })

  it('blocks after saying what a block does, and unblocks', async () => {
    const user = userEvent.setup()
    show({ state: 'none', canRequest: true })
    await user.click(await screen.findByRole('button', { name: 'Block…' }))
    expect(screen.getByText(BLOCK_EXPLAINED)).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    await user.click(screen.getByRole('button', { name: 'Block…' }))
    mocks.fetchRelation.mockResolvedValue({ state: 'blocked', blockId: 'b1' })
    await user.click(screen.getByRole('button', { name: 'Block Member B' }))
    expect(mocks.blockMember).toHaveBeenCalledWith('tok', { slug: 'member-b' })
    expect(await screen.findByText('You blocked this member.')).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Unblock' }))
    expect(mocks.unblockMember).toHaveBeenCalledWith('tok', 'b1')
    expect((await screen.findByRole('status')).textContent).toBe(
      'You unblocked Member B.',
    )
  })

  it('keeps the button when an action fails', async () => {
    const user = userEvent.setup()
    show({ state: 'outgoing', id: 'c1' })
    mocks.answerConnection.mockRejectedValue(new Error('Changed meanwhile.'))
    await user.click(await screen.findByRole('button', { name: 'Withdraw' }))
    expect((await screen.findByRole('alert')).textContent).toBe(
      'Changed meanwhile.',
    )
  })

  it('shows nothing on the owner’s own page, a page it cannot see, or signed out', async () => {
    const { container, unmount } = show({ state: 'self' })
    await vi.waitFor(() => expect(mocks.fetchRelation).toHaveBeenCalled())
    expect(container.innerHTML).toBe('')
    unmount()
    const hidden = show(new Error('That page does not exist.'))
    await vi.waitFor(() => expect(mocks.fetchRelation).toHaveBeenCalledTimes(2))
    expect(hidden.container.innerHTML).toBe('')
    hidden.unmount()
    mocks.auth.getToken.mockResolvedValue(undefined)
    const out = show({ state: 'none', canRequest: true })
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(out.container.innerHTML).toBe('')
    expect(mocks.fetchRelation).toHaveBeenCalledTimes(2)
  })

  it('stops quietly when the page is left before the answer', async () => {
    let answer: (value: Relation) => void = () => undefined
    mocks.fetchRelation.mockReturnValue(
      new Promise<Relation>((resolve) => {
        answer = resolve
      }),
    )
    const { unmount } = render(
      <ConnectionButton slug="member-b" displayName="Member B" />,
    )
    await vi.waitFor(() => expect(mocks.fetchRelation).toHaveBeenCalled())
    unmount()
    answer({ state: 'none', canRequest: true })
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(screen.queryByRole('button')).toBeNull()
  })
})

describe('SharedContacts', () => {
  it('says when a connection has no contact details yet', () => {
    render(<SharedContacts contacts={[]} title="Contact details" />)
    expect(
      screen.getByText('This member has not added any contact details yet.'),
    ).toBeTruthy()
  })
})
