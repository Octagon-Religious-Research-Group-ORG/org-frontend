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
    expect(mocks.fetchAnchors).toHaveBeenCalledWith('tok')
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
