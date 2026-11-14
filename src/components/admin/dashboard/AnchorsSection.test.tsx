// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '#/lib/api'
import type { AnchorRow, AnchorsView } from '#/lib/receipts-api'
import { ADMINS_ONLY } from './admin-shared'
import { ANCHORS_EXPLAINED, AnchorsSection } from './AnchorsSection'

const mocks = vi.hoisted(() => ({
  auth: {
    isLoading: false,
    isAuthenticated: true,
    getToken: vi.fn<() => Promise<string | undefined>>(),
  },
  fetchAnchors: vi.fn(),
  runAnchorsNow: vi.fn(),
}))

vi.mock('#/lib/auth', () => ({ useOrgAuth: () => mocks.auth }))
vi.mock('#/lib/receipts-api', () => ({
  fetchAnchors: mocks.fetchAnchors,
  runAnchorsNow: mocks.runAnchorsNow,
}))

const pass = (detail = 'ok') => ({ outcome: 'pass' as const, detail })
const unknown = (detail: string) => ({
  outcome: 'cannot-measure' as const,
  detail,
})

const built: AnchorRow = {
  anchorId: '2026-11-14',
  status: 'built',
  builtAt: '2026-11-14T03:00:00.000Z',
  leaves: 3,
  merkleRoot: 'c'.repeat(64),
  tsa: {
    status: 'granted',
    attempts: 2,
    genTime: '2026-11-14T03:00:05.000Z',
    lastError: 'HTTP 503',
  },
  ots: {
    status: 'confirmed',
    attempts: 1,
    calendars: [
      { url: 'https://a.example.test', ok: true },
      { url: 'https://b.example.test', ok: false, error: 'HTTP 503' },
    ],
    bitcoinHeights: [870123],
    lastUpgradeAt: '2026-11-14T09:00:00.000Z',
    nextAttemptAt: '2026-11-14T15:00:00.000Z',
    lastError: 'b: timeout',
  },
  verify: {
    root: pass('the leaves rebuild the stored root'),
    versions: { outcome: 'fail', detail: 'b:1: version missing' },
    tsa: pass(),
    ots: pass(),
    bitcoin: unknown('no Bitcoin node'),
  },
}

const building: AnchorRow = {
  anchorId: '2026-11-15',
  status: 'building',
  leaves: 1,
  tsa: { attempts: 1, nextAttemptAt: '2026-11-15T04:00:00.000Z' },
  ots: { attempts: 0, calendars: [], bitcoinHeights: [] },
  verify: {
    root: unknown('still being built'),
    versions: unknown('still being built'),
    tsa: unknown('still being built'),
    ots: unknown('still being built'),
    bitcoin: unknown('still being built'),
  },
}

const totals = { pass: 1, fail: 0, 'cannot-measure': 1 }
const view = (overrides: Partial<AnchorsView> = {}): AnchorsView => ({
  enabled: true,
  checkedAt: '2026-11-14T10:00:00.000Z',
  page: 1,
  hasMore: false,
  totalsScope: 'page',
  global: {
    anchors: 2,
    unfinished: 1,
    failedWhenLastChecked: 0,
    cannotMeasureWhenLastChecked: 0,
    neverChecked: 0,
    oldestCheck: '2026-11-14T10:00:00.000Z',
  },
  coverage: pass('every version up to now is anchored'),
  totals: {
    root: totals,
    versions: { pass: 0, fail: 1, 'cannot-measure': 1 },
    tsa: totals,
    ots: totals,
    bitcoin: { pass: 0, fail: 0, 'cannot-measure': 2 },
  },
  anchors: [building, built],
  ...overrides,
})

beforeEach(() => {
  mocks.auth.getToken.mockReset().mockResolvedValue('tok')
  mocks.fetchAnchors.mockReset().mockResolvedValue(view())
  mocks.runAnchorsNow.mockReset()
})
afterEach(cleanup)

describe('AnchorsSection', () => {
  it('lists each anchor with both providers and every check, never counting "cannot check" as a pass', async () => {
    render(<AnchorsSection />)
    expect(screen.getByText(ANCHORS_EXPLAINED)).toBeTruthy()
    expect(
      await screen.findByText(/2026-11-14 · built · 3 versions/),
    ).toBeTruthy()
    expect(screen.getByText(/2026-11-15 · building · 1 version$/)).toBeTruthy()
    const text = document.body.textContent
    expect(text).toContain(`Root ${'c'.repeat(64)}`)
    expect(text).toContain(
      'FreeTSA: granted after 2 attempts, stamped Nov 14, 2026, 3:00 AM UTC; last error: HTTP 503',
    )
    expect(text).toContain(
      'FreeTSA: not started after 1 attempt; next try Nov 15, 2026, 4:00 AM UTC',
    )
    expect(text).toContain(
      'OpenTimestamps: confirmed; 1 of 2 calendars answered; Bitcoin block 870123; next check Nov 14, 2026, 3:00 PM UTC; last error: b: timeout',
    )
    expect(text).toContain(
      'OpenTimestamps: not started; 0 of 0 calendars answered',
    )
    expect(text).toContain('Versions: FAIL · b:1: version missing')
    expect(text).toContain('Bitcoin block: Cannot check · no Bitcoin node')
    expect(text).toContain('Every version anchored: Pass')
    expect(text).toContain('Versions: 0 pass, 1 fail, 1 cannot check.')
    expect(mocks.fetchAnchors).toHaveBeenCalledWith('tok', 1)
  })

  it('runs now, reports what happened, and reloads', async () => {
    mocks.runAnchorsNow
      .mockResolvedValueOnce({
        build: { state: 'built', anchorId: '2026-11-14', leaves: 3 },
        tsa: [{ anchorId: '2026-11-14', outcome: 'granted' }],
        ots: [{ anchorId: '2026-11-14', outcome: 'pending' }],
      })
      .mockResolvedValueOnce({
        build: { state: 'already-built' },
        tsa: [],
        ots: [],
      })
      .mockRejectedValueOnce(new Error('Too many tries.'))
    render(<AnchorsSection />)
    fireEvent.click(await screen.findByRole('button', { name: 'Run now' }))
    expect(
      await screen.findByText(
        'Anchored 3 version(s) for 2026-11-14. Steps: 2026-11-14 granted, 2026-11-14 pending.',
      ),
    ).toBeTruthy()
    expect(mocks.runAnchorsNow).toHaveBeenCalledWith('tok')
    expect(mocks.fetchAnchors).toHaveBeenCalledTimes(2)
    fireEvent.click(await screen.findByRole('button', { name: 'Run now' }))
    expect(
      await screen.findByText("Today's anchor: already-built."),
    ).toBeTruthy()
    fireEvent.click(await screen.findByRole('button', { name: 'Run now' }))
    expect((await screen.findByRole('alert')).textContent).toBe(
      'Too many tries.',
    )
  })

  it('says loudly when anchoring is switched off, and cannot run', async () => {
    mocks.fetchAnchors.mockResolvedValue(view({ enabled: false, anchors: [] }))
    render(<AnchorsSection />)
    expect((await screen.findByRole('alert')).textContent).toContain(
      'ANCHORING_ENABLED=false',
    )
    expect(screen.getByText('No anchor yet.')).toBeTruthy()
    expect(
      screen.getByRole('button', { name: 'Run now' }).hasAttribute('disabled'),
    ).toBe(true)
  })

  it('shows only "admins only" to anyone else', async () => {
    mocks.fetchAnchors.mockRejectedValue(new ApiError('Forbidden', 403))
    render(<AnchorsSection />)
    expect((await screen.findByRole('alert')).textContent).toBe(ADMINS_ONLY)
  })
})

describe('review L1: the anchors are paged', () => {
  it('asks for the next page, and back', async () => {
    mocks.fetchAnchors.mockResolvedValue(view({ page: 1, hasMore: true }))
    render(<AnchorsSection />)
    fireEvent.click(await screen.findByRole('button', { name: 'Older' }))
    await screen.findByText('Page 2')
    expect(mocks.fetchAnchors).toHaveBeenLastCalledWith('tok', 2)
    fireEvent.click(screen.getByRole('button', { name: 'Newer' }))
    await screen.findByText('Page 1')
    expect(mocks.fetchAnchors).toHaveBeenLastCalledWith('tok', 1)
  })
})

describe('review round 2, M-C: what the totals cover', () => {
  it('labels the totals as this page’s, and shows counts over every anchor', async () => {
    mocks.fetchAnchors.mockResolvedValue(
      view({
        totalsScope: 'page',
        global: {
          anchors: 41,
          unfinished: 2,
          failedWhenLastChecked: 1,
          cannotMeasureWhenLastChecked: 0,
          neverChecked: 11,
          oldestCheck: null,
        },
      }),
    )
    render(<AnchorsSection />)
    await screen.findByRole('button', { name: 'Run now' })
    const text = document.body.textContent
    expect(text).toContain('On this page:')
    expect(text).toContain(
      'All 41 anchors: 2 unfinished, 1 failed a check when last checked, 0 could not be checked when last checked, 11 never checked;',
    )
  })
})

describe('review round 3, MEDIUM-2: unmeasured and stale checks are visible', () => {
  it('shows the cannot-measure count and the oldest check', async () => {
    mocks.fetchAnchors.mockResolvedValue(
      view({
        global: {
          anchors: 41,
          unfinished: 2,
          failedWhenLastChecked: 1,
          cannotMeasureWhenLastChecked: 3,
          neverChecked: 11,
          oldestCheck: '2026-10-01T09:00:00.000Z',
        },
      }),
    )
    render(<AnchorsSection />)
    await screen.findByRole('button', { name: 'Run now' })
    const text = document.body.textContent
    expect(text).toContain('3 could not be checked when last checked')
    expect(text).toContain('oldest check: Oct 1, 2026, 9:00 AM UTC')
  })

  it('says when no check is stored yet', async () => {
    mocks.fetchAnchors.mockResolvedValue(
      view({
        global: {
          anchors: 1,
          unfinished: 1,
          failedWhenLastChecked: 0,
          cannotMeasureWhenLastChecked: 0,
          neverChecked: 1,
          oldestCheck: null,
        },
      }),
    )
    render(<AnchorsSection />)
    await screen.findByRole('button', { name: 'Run now' })
    expect(document.body.textContent).toContain('no check stored yet')
  })
})

describe('round 7: one anchoring run at a time', () => {
  it('"Run now" while another run holds the lock says so plainly', async () => {
    mocks.runAnchorsNow.mockResolvedValueOnce({
      busy: true,
      build: { state: 'busy' },
      tsa: [],
      ots: [],
    })
    render(<AnchorsSection />)
    fireEvent.click(await screen.findByRole('button', { name: 'Run now' }))
    expect(
      await screen.findByText(
        'Another anchoring run is in progress, so nothing was done. Try again in a few minutes.',
      ),
    ).toBeTruthy()
  })

  it('a run that lost its lock part-way says it stopped early', async () => {
    mocks.runAnchorsNow.mockResolvedValueOnce({
      interrupted: true,
      build: { state: 'built', anchorId: '2026-11-14', leaves: 1 },
      tsa: [],
      ots: [],
    })
    render(<AnchorsSection />)
    fireEvent.click(await screen.findByRole('button', { name: 'Run now' }))
    expect(
      await screen.findByText(
        'Anchored 1 version(s) for 2026-11-14. It stopped early: another run took over its lock.',
      ),
    ).toBeTruthy()
  })
})
