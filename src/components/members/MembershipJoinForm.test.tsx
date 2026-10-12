// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type * as MembershipApi from '#/lib/membership-api'
import { MembershipJoinForm } from './MembershipJoinForm'

const mocks = vi.hoisted(() => ({
  auth: { getToken: vi.fn() },
  fetchMembershipTerms: vi.fn(),
  fetchMyMembership: vi.fn(),
  checkSlug: vi.fn(),
  joinMembership: vi.fn(),
}))

vi.mock('#/lib/auth', () => ({ useOrgAuth: () => mocks.auth }))
vi.mock('@tanstack/react-router', () => ({
  Link: ({ to, children }: { to: string; children: ReactNode }) => (
    <a href={to}>{children}</a>
  ),
}))
vi.mock('#/lib/membership-api', async (original) => ({
  ...(await original<typeof MembershipApi>()),
  fetchMembershipTerms: mocks.fetchMembershipTerms,
  fetchMyMembership: mocks.fetchMyMembership,
  checkSlug: mocks.checkSlug,
  joinMembership: mocks.joinMembership,
}))

const terms = {
  version: '2026-10-11',
  hash: 'h',
  items: [
    { id: 'admins-read', text: 'Admins can read beliefs.' },
    { id: 'retention', text: 'ORG keeps a copy for 5 years.' },
  ],
}

beforeEach(() => {
  mocks.auth.getToken.mockReset().mockResolvedValue('tok')
  mocks.fetchMembershipTerms.mockReset().mockResolvedValue(terms)
  mocks.fetchMyMembership.mockReset().mockResolvedValue({ status: 'none' })
  mocks.checkSlug.mockReset().mockResolvedValue({ available: true })
  mocks.joinMembership.mockReset().mockResolvedValue({
    status: 'pending',
    profile: { displayName: 'Stalemate' },
  })
})

afterEach(cleanup)

const type = (label: string | RegExp, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } })

async function fillRequired() {
  await screen.findByText('Create your page')
  type('Nickname', 'Stalemate')
  type('Bio', 'First.\n\nSecond.')
  type('Belief 1 title', 'God')
  type('Belief 1', 'One.')
  type('Backup contact 1', '@stale')
  await waitFor(() => expect(screen.getByText('Available.')).toBeTruthy())
}

describe('MembershipJoinForm', () => {
  it('shows the server terms and starts as a nickname from "Join anonymously"', async () => {
    render(<MembershipJoinForm nickname />)
    expect(await screen.findByText('Admins can read beliefs.')).toBeTruthy()
    expect(screen.getByText('ORG keeps a copy for 5 years.')).toBeTruthy()
    expect(
      screen.getByLabelText<HTMLInputElement>('A nickname (anonymous)').checked,
    ).toBe(true)
  })

  it('stays disabled until the terms are agreed, then sends exactly what was typed', async () => {
    render(<MembershipJoinForm nickname />)
    await fillRequired()
    const submit = screen.getByRole('button', { name: 'Create my page' })
    expect((submit as HTMLButtonElement).disabled).toBe(true)

    fireEvent.click(screen.getByLabelText('I have read this and agree.'))
    expect((submit as HTMLButtonElement).disabled).toBe(false)
    fireEvent.click(submit)

    expect(
      await screen.findByText('Your page is waiting for approval'),
    ).toBeTruthy()
    expect(mocks.checkSlug).toHaveBeenCalledWith('stalemate')
    expect(mocks.joinMembership).toHaveBeenCalledWith('tok', {
      displayName: 'Stalemate',
      slug: 'stalemate',
      anonymous: true,
      visibility: 'members',
      bio: 'First.\n\nSecond.',
      beliefs: [{ title: 'God', text: 'One.' }],
      contacts: [],
      backupContacts: [{ method: 'telegram', value: '@stale' }],
      termsVersion: '2026-10-11',
    })
  })

  it('will not submit a taken address', async () => {
    mocks.checkSlug.mockResolvedValue({ available: false, reason: 'taken' })
    render(<MembershipJoinForm nickname={false} />)
    await screen.findByText('Create your page')
    type('Name', 'Tripp')
    expect(
      await screen.findByText('That address is already taken.'),
    ).toBeTruthy()
    fireEvent.click(screen.getByLabelText('I have read this and agree.'))
    expect(
      screen.getByRole<HTMLButtonElement>('button', {
        name: 'Create my page',
      }).disabled,
    ).toBe(true)
  })

  it('shows the server refusal and lets the member try again', async () => {
    mocks.joinMembership.mockRejectedValueOnce(
      new Error('Please confirm your email address before joining.'),
    )
    render(<MembershipJoinForm nickname />)
    await fillRequired()
    fireEvent.click(screen.getByLabelText('I have read this and agree.'))
    fireEvent.click(screen.getByRole('button', { name: 'Create my page' }))
    expect((await screen.findByRole('alert')).textContent).toMatch(
      /confirm your email/,
    )
  })

  it('tells an existing member they already joined', async () => {
    mocks.fetchMyMembership.mockResolvedValue({ status: 'approved' })
    render(<MembershipJoinForm nickname={false} />)
    expect(await screen.findByText('You are already a member')).toBeTruthy()
  })
})
