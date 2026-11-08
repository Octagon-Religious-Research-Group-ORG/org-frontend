// @vitest-environment jsdom

import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '#/lib/api'
import type * as MembershipApi from '#/lib/membership-api'
import { MembershipJoinForm } from './MembershipJoinForm'
import { SLOW_NOTICE_AFTER_MS, SLOW_SERVER_MESSAGE } from './use-slow-notice'

const mocks = vi.hoisted(() => ({
  auth: { getToken: vi.fn(), user: { sub: 'user_a' } as { sub: string } },
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
  sessionStorage.clear()
  mocks.auth = {
    getToken: vi.fn().mockResolvedValue('tok'),
    user: { sub: 'user_a' },
  }
  mocks.fetchMembershipTerms.mockReset().mockResolvedValue(terms)
  mocks.fetchMyMembership.mockReset().mockResolvedValue({ status: 'none' })
  mocks.checkSlug.mockReset().mockResolvedValue({ available: true })
  mocks.joinMembership.mockReset().mockResolvedValue({
    status: 'pending',
    profile: { displayName: 'Quiet Fern' },
  })
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

const type = (label: string | RegExp, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } })
const value = (label: string) =>
  screen.getByLabelText<HTMLInputElement>(label).value
const address = () =>
  document.querySelector<HTMLInputElement>('input[maxlength="80"]')!
const setAddress = (next: string) =>
  fireEvent.change(address(), { target: { value: next } })
const submitButton = () =>
  screen.getByRole<HTMLButtonElement>('button', { name: 'Create my page' })
const agree = () =>
  fireEvent.click(screen.getByLabelText('I have read this and agree.'))
const settle = (ms = 450) =>
  act(async () => {
    await new Promise((done) => setTimeout(done, ms))
  })

async function fillRequired(name = 'Quiet Fern') {
  await screen.findByText('Create your page')
  type(/^(Name|Nickname)$/, name)
  type('Bio', 'First.\n\nSecond.')
  type('Belief 1 title', 'God')
  type('Belief 1', 'One.')
  type('Backup contact 1', '@fern')
  await waitFor(() => expect(screen.getByText('Available.')).toBeTruthy())
}

async function fillAndAgree() {
  await fillRequired()
  agree()
}

describe('MembershipJoinForm', () => {
  it('shows the server terms and starts as a nickname from "Join anonymously"', async () => {
    render(<MembershipJoinForm nickname />)
    expect(await screen.findByText('Admins can read beliefs.')).toBeTruthy()
    expect(screen.getByText('ORG keeps a copy for 5 years.')).toBeTruthy()
    expect(
      screen.getByLabelText<HTMLInputElement>('A nickname (anonymous)').checked,
    ).toBe(true)
    expect(
      screen.getByRole<HTMLInputElement>('radio', { name: /^Members/ }).checked,
    ).toBe(true)
  })

  it('starts public under an own name otherwise, and lets the member change both', async () => {
    render(<MembershipJoinForm nickname={false} />)
    await screen.findByText('Create your page')
    expect(
      screen.getByRole<HTMLInputElement>('radio', { name: /^Public/ }).checked,
    ).toBe(true)
    fireEvent.click(screen.getByLabelText('A nickname (anonymous)'))
    expect(screen.getByLabelText('Nickname')).toBeTruthy()
    fireEvent.click(screen.getByLabelText('My own name'))
    expect(screen.getByLabelText('Name')).toBeTruthy()
    fireEvent.click(screen.getByRole('radio', { name: /^Private/ }))
    expect(
      screen.getByRole<HTMLInputElement>('radio', { name: /^Private/ }).checked,
    ).toBe(true)
  })

  it('stays disabled until the terms are agreed, then sends exactly what was typed', async () => {
    render(<MembershipJoinForm nickname />)
    await fillRequired()
    expect(submitButton().disabled).toBe(true)

    agree()
    expect(submitButton().disabled).toBe(false)
    fireEvent.click(submitButton())

    expect(
      await screen.findByText('Your page is waiting for approval'),
    ).toBeTruthy()
    expect(mocks.checkSlug).toHaveBeenCalledWith('quiet-fern', 'tok')
    expect(mocks.joinMembership).toHaveBeenCalledWith('tok', {
      displayName: 'Quiet Fern',
      slug: 'quiet-fern',
      anonymous: true,
      visibility: 'members',
      bio: 'First.\n\nSecond.',
      beliefs: [{ title: 'God', text: 'One.' }],
      contacts: [],
      backupContacts: [{ method: 'telegram', value: '@fern' }],
      termsVersion: '2026-10-11',
    })
  })

  it('caps each text box at the server limit', async () => {
    render(<MembershipJoinForm nickname={false} />)
    await screen.findByText('Create your page')
    expect(screen.getByLabelText<HTMLTextAreaElement>('Bio').maxLength).toBe(
      20_000,
    )
    expect(
      screen.getByLabelText<HTMLTextAreaElement>('Belief 1').maxLength,
    ).toBe(20_000)
  })

  describe('beliefs and contacts', () => {
    it('adds and removes belief tabs, up to the limit', async () => {
      render(<MembershipJoinForm nickname={false} />)
      await screen.findByText('Create your page')
      const add = () =>
        fireEvent.click(
          screen.getByRole('button', { name: /Add a belief tab/ }),
        )
      expect(
        screen.queryByRole('button', { name: 'Remove belief 1' }),
      ).toBeNull()
      add()
      type('Belief 2', 'Second belief')
      fireEvent.click(screen.getByRole('button', { name: 'Remove belief 1' }))
      expect(value('Belief 1')).toBe('Second belief')
      for (let count = 1; count < 20; count++) add()
      expect(
        screen.queryByRole('button', { name: /Add a belief tab/ }),
      ).toBeNull()
    })

    it('leaves empty contact rows out and sends the method chosen', async () => {
      render(<MembershipJoinForm nickname={false} />)
      await fillAndAgree()
      fireEvent.click(screen.getByRole('button', { name: /Add contact/ }))
      fireEvent.click(screen.getByRole('button', { name: /Add contact/ }))
      type('Contact 1', '@public')
      fireEvent.change(screen.getByLabelText('Contact 1 method'), {
        target: { value: 'signal' },
      })
      fireEvent.click(submitButton())
      await screen.findByText('Your page is waiting for approval')
      expect(mocks.joinMembership.mock.calls[0][1]).toMatchObject({
        contacts: [{ method: 'signal', value: '@public' }],
      })
    })

    it('removes a contact row and stops adding at five', async () => {
      render(<MembershipJoinForm nickname={false} />)
      await screen.findByText('Create your page')
      const add = () =>
        fireEvent.click(
          screen.getByRole('button', { name: /Add backup contact/ }),
        )
      for (let count = 1; count < 5; count++) add()
      expect(
        screen.queryByRole('button', { name: /Add backup contact/ }),
      ).toBeNull()
      type('Backup contact 2', 'keep me')
      fireEvent.click(
        screen.getByRole('button', { name: 'Remove Backup contact 1' }),
      )
      expect(value('Backup contact 1')).toBe('keep me')
    })
  })

  describe('page address', () => {
    it('will not submit an address the server says is unavailable', async () => {
      mocks.checkSlug.mockResolvedValue({ available: false })
      render(<MembershipJoinForm nickname={false} />)
      await screen.findByText('Create your page')
      type('Name', 'Some Member')
      expect(
        await screen.findByText(
          'That address is not available. Please choose another.',
        ),
      ).toBeTruthy()
      agree()
      expect(submitButton().disabled).toBe(true)
    })

    it('explains a bad format without asking the server', async () => {
      render(<MembershipJoinForm nickname={false} />)
      await screen.findByText('Create your page')
      setAddress('Not Valid')
      expect(await screen.findByText(/single hyphens/)).toBeTruthy()
      await settle()
      expect(mocks.checkSlug).not.toHaveBeenCalled()
    })

    it('does not check an address of one letter', async () => {
      render(<MembershipJoinForm nickname={false} />)
      await screen.findByText('Create your page')
      setAddress('a')
      await settle()
      expect(mocks.checkSlug).not.toHaveBeenCalled()
    })

    it('stops following the name once the member edits the address', async () => {
      render(<MembershipJoinForm nickname={false} />)
      await screen.findByText('Create your page')
      type('Name', 'Quiet Fern')
      expect(address().value).toBe('quiet-fern')
      setAddress('my-own')
      type('Name', 'Something Else')
      expect(address().value).toBe('my-own')
    })

    it('needs a completed check before it can submit', async () => {
      mocks.checkSlug.mockReturnValue(new Promise(() => {}))
      render(<MembershipJoinForm nickname={false} />)
      await screen.findByText('Create your page')
      type('Name', 'Quiet Fern')
      type('Bio', 'Text.')
      type('Belief 1 title', 'God')
      type('Belief 1', 'One.')
      type('Backup contact 1', '@fern')
      agree()
      await settle()
      expect(screen.getByText('Checking…')).toBeTruthy()
      expect(submitButton().disabled).toBe(true)
      fireEvent.submit(submitButton().closest('form')!)
      await settle(10)
      expect(mocks.joinMembership).not.toHaveBeenCalled()
    })

    it('says when the check failed, offers another try, and stays closed until it passes', async () => {
      mocks.checkSlug.mockRejectedValueOnce(
        new Error("We couldn't reach the ORG server."),
      )
      render(<MembershipJoinForm nickname={false} />)
      await screen.findByText('Create your page')
      type('Name', 'Quiet Fern')
      expect((await screen.findByRole('alert')).textContent).toMatch(
        /couldn't reach/,
      )
      expect(submitButton().disabled).toBe(true)
      fireEvent.click(screen.getByRole('button', { name: 'Check again' }))
      expect(await screen.findByText('Available.')).toBeTruthy()
      expect(screen.queryByRole('alert')).toBeNull()
    })

    it('words an unknown check failure, and a lapsed session', async () => {
      mocks.checkSlug.mockRejectedValueOnce('odd')
      render(<MembershipJoinForm nickname={false} />)
      await screen.findByText('Create your page')
      type('Name', 'Quiet Fern')
      expect((await screen.findByRole('alert')).textContent).toMatch(
        /could not check that address/,
      )
      mocks.auth.getToken.mockResolvedValue(undefined)
      fireEvent.click(screen.getByRole('button', { name: 'Check again' }))
      await waitFor(() =>
        expect(screen.getByRole('alert').textContent).toMatch(/sign in again/),
      )
    })

    it('ignores a late answer about an earlier address', async () => {
      const answers: Record<string, (result: unknown) => void> = {}
      mocks.checkSlug.mockImplementation(
        (slug: string) => new Promise((done) => (answers[slug] = done)),
      )
      render(<MembershipJoinForm nickname={false} />)
      await screen.findByText('Create your page')
      setAddress('free-one')
      await settle()
      setAddress('taken-one')
      await settle()
      await act(async () => answers['taken-one']({ available: false }))
      await act(async () => answers['free-one']({ available: true }))
      expect(screen.queryByText('Available.')).toBeNull()
      expect(screen.getByText(/not available/)).toBeTruthy()
    })

    it('ignores a late failure about an earlier address', async () => {
      const failures: Record<string, (reason: unknown) => void> = {}
      mocks.checkSlug.mockImplementation((slug: string) =>
        slug === 'free-one'
          ? new Promise((_, fail) => (failures[slug] = fail))
          : Promise.resolve({ available: true }),
      )
      render(<MembershipJoinForm nickname={false} />)
      await screen.findByText('Create your page')
      setAddress('free-one')
      await settle()
      setAddress('other-one')
      expect(await screen.findByText('Available.')).toBeTruthy()
      await act(async () => failures['free-one'](new Error('late')))
      expect(screen.getByText('Available.')).toBeTruthy()
      expect(screen.queryByRole('alert')).toBeNull()
    })
  })

  describe('submitting', () => {
    it('shows the server refusal and lets the member try again', async () => {
      mocks.joinMembership.mockRejectedValueOnce(
        new Error('Please confirm your email address before joining.'),
      )
      render(<MembershipJoinForm nickname />)
      await fillAndAgree()
      fireEvent.click(submitButton())
      expect((await screen.findByRole('alert')).textContent).toMatch(
        /confirm your email/,
      )
      expect(submitButton().disabled).toBe(false)
      fireEvent.click(submitButton())
      expect(
        await screen.findByText('Your page is waiting for approval'),
      ).toBeTruthy()
      expect(mocks.joinMembership).toHaveBeenCalledTimes(2)
    })

    it('posts once however fast the form is submitted twice', async () => {
      let finish: (result: unknown) => void = () => {}
      mocks.joinMembership.mockReturnValue(
        new Promise((done) => {
          finish = done
        }),
      )
      render(<MembershipJoinForm nickname={false} />)
      await fillAndAgree()
      const form = submitButton().closest('form')!
      fireEvent.submit(form)
      fireEvent.submit(form)
      await waitFor(() => expect(mocks.joinMembership).toHaveBeenCalled())
      expect(mocks.joinMembership).toHaveBeenCalledTimes(1)
      expect(
        screen.getByRole<HTMLButtonElement>('button', {
          name: 'Creating your page…',
        }).disabled,
      ).toBe(true)
      await act(async () => finish({ status: 'pending' }))
    })

    it('asks to sign in again when the session has lapsed', async () => {
      render(<MembershipJoinForm nickname={false} />)
      await fillAndAgree()
      mocks.auth.getToken.mockResolvedValue(undefined)
      fireEvent.click(submitButton())
      expect((await screen.findByRole('alert')).textContent).toBe(
        'Please sign in again.',
      )
      expect(mocks.joinMembership).not.toHaveBeenCalled()
    })

    it('words an unknown failure in plain language', async () => {
      mocks.joinMembership.mockRejectedValueOnce('odd')
      render(<MembershipJoinForm nickname={false} />)
      await fillAndAgree()
      fireEvent.click(submitButton())
      expect((await screen.findByRole('alert')).textContent).toBe(
        'Your page could not be created.',
      )
    })

    it('tells the member the server is waking while a submit is slow', async () => {
      mocks.joinMembership.mockReturnValue(new Promise(() => {}))
      render(<MembershipJoinForm nickname={false} />)
      await fillAndAgree()
      vi.useFakeTimers({ shouldAdvanceTime: true })
      fireEvent.click(submitButton())
      await act(async () => {
        await vi.advanceTimersByTimeAsync(SLOW_NOTICE_AFTER_MS + 10)
      })
      expect(screen.getByRole('status').textContent).toBe(SLOW_SERVER_MESSAGE)
    })
  })

  describe('stale terms', () => {
    const conflict = new ApiError('The membership terms changed.', 409)
    const newTerms = {
      version: '2026-12-01',
      hash: 'h2',
      items: [{ id: 'admins-read', text: 'New wording.' }],
    }

    it('fetches the new terms on a 409, asks again, and keeps the page', async () => {
      mocks.joinMembership.mockRejectedValueOnce(conflict)
      render(<MembershipJoinForm nickname={false} />)
      await fillAndAgree()
      mocks.fetchMembershipTerms.mockResolvedValue(newTerms)
      fireEvent.click(submitButton())

      expect(await screen.findByText('New wording.')).toBeTruthy()
      expect(mocks.fetchMembershipTerms).toHaveBeenCalledTimes(2)
      expect(value('Bio')).toBe('First.\n\nSecond.')
      expect(screen.getByRole('alert').textContent).toMatch(/terms changed/)
      expect(screen.getByText(/read them again/)).toBeTruthy()
      expect(submitButton().disabled).toBe(true)

      agree()
      expect(screen.queryByText(/read them again/)).toBeNull()
      fireEvent.click(submitButton())
      await screen.findByText('Your page is waiting for approval')
      expect(mocks.joinMembership.mock.calls[1][1]).toMatchObject({
        termsVersion: '2026-12-01',
      })
    })

    it('keeps the agreement when the terms did not change', async () => {
      mocks.joinMembership.mockRejectedValueOnce(conflict)
      render(<MembershipJoinForm nickname={false} />)
      await fillAndAgree()
      fireEvent.click(submitButton())
      await screen.findByRole('alert')
      await waitFor(() => expect(submitButton().disabled).toBe(false))
      expect(screen.queryByText(/read them again/)).toBeNull()
    })

    it('shows the waiting page when a join that timed out actually landed', async () => {
      mocks.joinMembership.mockRejectedValueOnce(conflict)
      render(<MembershipJoinForm nickname={false} />)
      await fillAndAgree()
      mocks.fetchMyMembership.mockResolvedValue({ status: 'pending' })
      fireEvent.click(submitButton())
      expect(
        await screen.findByText('Your page is waiting for approval'),
      ).toBeTruthy()
    })

    it('keeps the form when even the refresh fails', async () => {
      mocks.joinMembership.mockRejectedValueOnce(new Error('Boom'))
      render(<MembershipJoinForm nickname={false} />)
      await fillAndAgree()
      mocks.fetchMembershipTerms.mockRejectedValue(new Error('Failed to fetch'))
      fireEvent.click(submitButton())
      expect((await screen.findByRole('alert')).textContent).toBe('Boom')
      await waitFor(() => expect(submitButton().disabled).toBe(false))
      expect(value('Bio')).toBe('First.\n\nSecond.')
    })
  })

  describe('loading', () => {
    it('tells an existing member they already joined', async () => {
      mocks.fetchMyMembership.mockResolvedValue({ status: 'approved' })
      render(<MembershipJoinForm nickname={false} />)
      expect(await screen.findByText('You are already a member')).toBeTruthy()
      expect(screen.getByRole('link', { name: /Back to/ })).toBeTruthy()
    })

    it('does not ask for a status without a token', async () => {
      mocks.auth.getToken.mockResolvedValue(undefined)
      render(<MembershipJoinForm nickname={false} />)
      await screen.findByText('Create your page')
      expect(mocks.fetchMyMembership).not.toHaveBeenCalled()
    })

    it('explains a failed first load and can try again', async () => {
      mocks.fetchMembershipTerms.mockRejectedValueOnce(
        new Error("We couldn't reach the ORG server."),
      )
      render(<MembershipJoinForm nickname={false} />)
      expect((await screen.findByRole('alert')).textContent).toMatch(
        /couldn't reach/,
      )
      fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
      expect(await screen.findByText('Create your page')).toBeTruthy()
      expect(screen.queryByRole('alert')).toBeNull()
    })

    it('words an unknown load failure', async () => {
      mocks.fetchMembershipTerms.mockRejectedValueOnce('odd')
      render(<MembershipJoinForm nickname={false} />)
      expect((await screen.findByRole('alert')).textContent).toBe(
        'Membership is unavailable.',
      )
    })

    it('never replaces the form when a later refetch fails', async () => {
      const view = render(<MembershipJoinForm nickname={false} />)
      await fillRequired()
      mocks.fetchMembershipTerms.mockRejectedValue(new Error('Failed to fetch'))
      mocks.auth = { ...mocks.auth }
      view.rerender(<MembershipJoinForm nickname={false} />)
      await settle(20)
      expect(mocks.fetchMembershipTerms).toHaveBeenCalledTimes(2)
      expect(screen.queryByText('Failed to fetch')).toBeNull()
      expect(value('Bio')).toBe('First.\n\nSecond.')
    })

    it('ignores answers that arrive after it closed', async () => {
      let fail: (reason: unknown) => void = () => {}
      let succeed: (result: unknown) => void = () => {}
      mocks.fetchMembershipTerms
        .mockReturnValueOnce(new Promise((_, r) => (fail = r)))
        .mockReturnValueOnce(new Promise((done) => (succeed = done)))
      const first = render(<MembershipJoinForm nickname={false} />)
      await waitFor(() =>
        expect(mocks.fetchMembershipTerms).toHaveBeenCalledTimes(1),
      )
      first.unmount()
      await act(async () => fail(new Error('late')))
      const second = render(<MembershipJoinForm nickname={false} />)
      await waitFor(() =>
        expect(mocks.fetchMembershipTerms).toHaveBeenCalledTimes(2),
      )
      second.unmount()
      await act(async () => succeed(terms))
    })

    it('says why a first load is slow', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true })
      mocks.fetchMembershipTerms.mockReturnValue(new Promise(() => {}))
      render(<MembershipJoinForm nickname={false} />)
      expect(screen.getByText(/Loading/)).toBeTruthy()
      await act(async () => {
        await vi.advanceTimersByTimeAsync(SLOW_NOTICE_AFTER_MS + 10)
      })
      expect(screen.getByRole('status').textContent).toBe(SLOW_SERVER_MESSAGE)
    })
  })

  describe('the draft', () => {
    const remount = () => {
      cleanup()
      render(<MembershipJoinForm nickname={false} />)
    }
    const stored = () => sessionStorage.getItem('org-members-join-draft') ?? ''

    it('survives the form being taken away by a session lapse', async () => {
      render(<MembershipJoinForm nickname={false} />)
      await fillRequired()
      remount()
      await screen.findByText('Create your page')
      expect(value('Name')).toBe('Quiet Fern')
      expect(value('Bio')).toBe('First.\n\nSecond.')
      expect(value('Belief 1')).toBe('One.')
      expect(screen.getByText(/We kept what you had typed/)).toBeTruthy()
    })

    it('never keeps admin-only backup contacts or the agreement', async () => {
      render(<MembershipJoinForm nickname={false} />)
      await fillAndAgree()
      expect(stored()).toContain('First.')
      expect(stored()).not.toContain('@fern')
      remount()
      await screen.findByText('Create your page')
      expect(value('Backup contact 1')).toBe('')
      expect(
        screen.getByLabelText<HTMLInputElement>('I have read this and agree.')
          .checked,
      ).toBe(false)
    })

    it('is removed once the page is created', async () => {
      render(<MembershipJoinForm nickname={false} />)
      await fillAndAgree()
      expect(stored()).not.toBe('')
      fireEvent.click(submitButton())
      await screen.findByText('Your page is waiting for approval')
      expect(stored()).toBe('')
    })

    it('is not shown to a different account in the same tab', async () => {
      render(<MembershipJoinForm nickname={false} />)
      await fillRequired()
      mocks.auth = { ...mocks.auth, user: { sub: 'user_b' } }
      remount()
      await screen.findByText('Create your page')
      expect(value('Bio')).toBe('')
      expect(stored()).toBe('')
    })

    it('cannot undo "Join anonymously", and keeps an anonymous choice', async () => {
      render(<MembershipJoinForm nickname={false} />)
      await fillRequired()
      cleanup()
      render(<MembershipJoinForm nickname />)
      await screen.findByText('Create your page')
      expect(
        screen.getByLabelText<HTMLInputElement>('A nickname (anonymous)')
          .checked,
      ).toBe(true)
      fireEvent.click(screen.getByLabelText('A nickname (anonymous)'))
      await settle(10)
      remount()
      await screen.findByText('Create your page')
      expect(
        screen.getByLabelText<HTMLInputElement>('A nickname (anonymous)')
          .checked,
      ).toBe(true)
    })

    it.each([
      ['only a name', () => type('Name', 'A')],
      ['only a bio', () => type('Bio', 'A')],
      ['only a belief title', () => type('Belief 1 title', 'A')],
      ['only a belief', () => type('Belief 1', 'A')],
    ])('is saved for %s', async (_label, fill) => {
      render(<MembershipJoinForm nickname={false} />)
      await screen.findByText('Create your page')
      expect(stored()).toBe('')
      fill()
      expect(stored()).not.toBe('')
    })

    it('is saved for only a contact on the page', async () => {
      render(<MembershipJoinForm nickname={false} />)
      await screen.findByText('Create your page')
      fireEvent.click(screen.getByRole('button', { name: /Add contact/ }))
      expect(stored()).toBe('')
      type('Contact 1', '@a')
      expect(stored()).toContain('@a')
    })
  })
})
