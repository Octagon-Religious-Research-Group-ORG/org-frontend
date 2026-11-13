// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { FullProfile, MemberProfile } from '#/lib/members-api'
import { ProfileView } from './ProfileView'

const authState = vi.hoisted(() => ({ isAuthenticated: false }))
vi.mock('#/lib/auth', () => ({
  useOrgAuth: () => ({
    isAuthenticated: authState.isAuthenticated,
    getToken: vi.fn(),
  }),
}))
vi.mock('./ReportButton', () => ({
  ReportButton: ({ label }: { label: string }) => <p>report: {label}</p>,
}))
vi.mock('@tanstack/react-router', async (original) => ({
  ...(await original<object>()),
  Link: ({ to, children }: { to: string; children: ReactNode }) => (
    <a href={to}>{children}</a>
  ),
}))
vi.mock('./OwnerTools', () => ({
  OwnerTools: ({ visibility }: { visibility: string }) => (
    <div>owner tools: {visibility}</div>
  ),
}))
vi.mock('./CommentThread', () => ({
  CommentThread: (props: { title: string; tabId?: string }) => (
    <div data-testid="thread">
      {props.title} {props.tabId ?? 'page'}
    </div>
  ),
}))
vi.mock('./ClaimPanel', () => ({
  ClaimPanel: ({ slug }: { slug: string }) => <div>claim panel: {slug}</div>,
}))
vi.mock('./GetStartedChecklist', () => ({
  GetStartedChecklist: () => <div>get started</div>,
}))

afterEach(() => {
  cleanup()
  authState.isAuthenticated = false
})

const nameOnly: MemberProfile = {
  access: 'name-only',
  slug: 'quiet-fern',
  displayName: 'Quiet Fern',
  isOwner: false,
  hasPicture: false,
  picturePublic: false,
}

const paragraph = (blockId: string, text: string) => ({
  blockId,
  kind: 'paragraph' as const,
  label: '',
  text,
})

const full = (overrides: Partial<FullProfile> = {}): FullProfile => ({
  access: 'full',
  slug: 'quiet-fern',
  displayName: 'Quiet Fern',
  isOwner: false,
  hasPicture: false,
  picturePublic: false,
  contacts: [{ method: 'signal', value: '@fern' }],
  bio: [paragraph('b1', 'Synthetic bio')],
  extras: [],
  tabs: [
    {
      tabId: 't1',
      title: 'A belief',
      needsReview: false,
      paragraphs: [paragraph('b2', 'Belief text')],
    },
  ],
  ...overrides,
})

function view(profile: MemberProfile) {
  return render(<ProfileView profile={profile} onChanged={vi.fn()} />)
}

describe('ProfileView', () => {
  it('lets a signed-in reader report someone else’s page, not a guest or the owner (Chunk 13)', () => {
    view(full())
    expect(screen.queryByText(/^report:/)).toBeNull()
    cleanup()
    authState.isAuthenticated = true
    view(full())
    expect(screen.getByText('report: Report the page Quiet Fern')).toBeTruthy()
    cleanup()
    view(nameOnly)
    expect(screen.getByText('report: Report the page Quiet Fern')).toBeTruthy()
    cleanup()
    view(full({ isOwner: true }))
    expect(screen.queryByText(/^report:/)).toBeNull()
  })

  it('shows only the name and a note on a name-only page', () => {
    view(nameOnly)
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(
      'Quiet Fern',
    )
    expect(screen.getByText(/for members only/)).toBeTruthy()
    expect(document.querySelector('.octagon')).toBeNull()
  })

  it('offers a claim only on a page the server marked claimable (Chunk 11)', () => {
    view({ ...nameOnly, claimable: true })
    expect(screen.getByText('claim panel: quiet-fern')).toBeTruthy()
    cleanup()
    view(full({ claimable: true }))
    expect(screen.getByText('claim panel: quiet-fern')).toBeTruthy()
    cleanup()
    view(nameOnly)
    expect(screen.queryByText(/claim panel/)).toBeNull()
    cleanup()
    view(full())
    expect(screen.queryByText(/claim panel/)).toBeNull()
  })

  it('shows bio, contact rows, tabs and the picture box', () => {
    view(full())
    expect(screen.getByText('Synthetic bio')).toBeTruthy()
    expect(screen.getByText('Signal')).toBeTruthy()
    expect(screen.getByText('@fern')).toBeTruthy()
    expect(screen.getAllByText('A belief').length).toBeGreaterThan(0)
    expect(document.querySelector('.octagon')).not.toBeNull()
  })

  it('ends with the page’s own thread, "About this page"; a name-only page has none', () => {
    render(<ProfileView profile={full()} onChanged={() => undefined} />)
    expect(
      screen.getAllByTestId('thread').map((thread) => thread.textContent),
    ).toContain('About this page page')
    cleanup()
    render(<ProfileView profile={nameOnly} onChanged={() => undefined} />)
    expect(screen.queryByTestId('thread')).toBeNull()
  })

  it('leaves out empty sections', () => {
    view(full({ contacts: [], bio: [], tabs: [] }))
    expect(screen.queryByText('Contact')).toBeNull()
    expect(screen.queryByRole('region', { name: 'About' })).toBeNull()
  })

  it('shows a member’s other sections, titled where they have no heading', () => {
    view(
      full({
        extras: [
          { section: 'considering', paragraphs: [paragraph('c', 'Maybe')] },
          { section: 'other', paragraphs: [paragraph('o', 'Their own')] },
        ],
      }),
    )
    expect(screen.getByRole('heading', { name: 'Considering' })).toBeTruthy()
    expect(screen.getByText('Their own')).toBeTruthy()
  })

  it('gives a new member their tools and checklist', () => {
    view(
      full({
        isOwner: true,
        manage: {
          visibility: 'members',
          reviewStatus: 'approved',
          source: 'native',
        },
      }),
    )
    expect(screen.getByText('owner tools: members')).toBeTruthy()
    expect(screen.getByText('get started')).toBeTruthy()
  })

  it.each([['migrated'], [undefined]] as const)(
    'shows an owner whose page is %s the tools but no checklist',
    (source) => {
      view(
        full({
          isOwner: true,
          manage: { visibility: 'members', reviewStatus: 'approved', source },
        }),
      )
      expect(screen.getByText('owner tools: members')).toBeTruthy()
      expect(screen.queryByText('get started')).toBeNull()
    },
  )

  it('does not give a checklist to an admin viewing a native page', () => {
    view(
      full({
        manage: {
          visibility: 'members',
          reviewStatus: 'approved',
          source: 'native',
        },
      }),
    )
    expect(screen.queryByText('get started')).toBeNull()
  })

  it('passes the picture version on, so a replacement shows at once', () => {
    view(full({ hasPicture: true, picturePublic: true, pictureVersion: 'f2' }))
    expect(screen.getByRole<HTMLImageElement>('img').src).toMatch(/\?v=f2$/)
  })

  it('shows no tools to anyone but the owner', () => {
    view(full({ manage: { visibility: 'members', reviewStatus: 'approved' } }))
    expect(screen.queryByText(/owner tools/)).toBeNull()
    expect(screen.queryByText('get started')).toBeNull()
  })

  it('gives no tools when the server sends no settings', () => {
    view(full({ isOwner: true }))
    expect(screen.queryByText(/owner tools/)).toBeNull()
  })

  it('says a pending page is waiting for approval', () => {
    view(
      full({
        isOwner: true,
        manage: { visibility: 'members', reviewStatus: 'pending' },
      }),
    )
    expect(screen.getByText(/Waiting for an admin/)).toBeTruthy()
  })

  it('tells an admin a page is removed (Chunk 12)', () => {
    view(
      full({
        manage: { visibility: 'public', reviewStatus: 'removed' },
      }),
    )
    expect(screen.getByText(/Removed by an admin/)).toBeTruthy()
  })

  it('gives the owner editing on their bio and beliefs, from the versions the page showed', () => {
    view(
      full({
        isOwner: true,
        revisions: { bio: 2, tabs: { t1: { text: 3, title: 0 } } },
        manage: { visibility: 'public', reviewStatus: 'approved' },
      }),
    )
    expect(screen.getByRole('button', { name: 'Edit bio' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Edit belief' })).toBeTruthy()
  })

  it('gives no editing to a reader, an admin, or an owner whose server sent no versions', () => {
    for (const profile of [
      full(),
      full({
        manage: { visibility: 'public', reviewStatus: 'approved' },
        revisions: { bio: 2, tabs: {} },
      }),
      full({
        isOwner: true,
        manage: { visibility: 'public', reviewStatus: 'approved' },
      }),
    ]) {
      view(profile)
      expect(screen.queryByRole('button', { name: 'Edit bio' })).toBeNull()
      expect(screen.queryByRole('button', { name: 'Edit belief' })).toBeNull()
      expect(screen.getByRole('button', { name: 'Bio history' })).toBeTruthy()
      cleanup()
    }
  })

  it('lists removed beliefs only when the server sends some', () => {
    view(
      full({
        manage: {
          visibility: 'public',
          reviewStatus: 'approved',
          removedTabs: [
            {
              tabId: 'tg',
              title: 'Gone belief',
              removedAt: '2026-11-02T09:15:00.000Z',
            },
          ],
        },
      }),
    )
    expect(screen.getByRole('region', { name: 'Removed beliefs' })).toBeTruthy()
    expect(screen.getByText('Gone belief')).toBeTruthy()
    cleanup()
    view(
      full({
        manage: {
          visibility: 'public',
          reviewStatus: 'approved',
          removedTabs: [],
        },
      }),
    )
    expect(screen.queryByRole('region', { name: 'Removed beliefs' })).toBeNull()
  })
})
