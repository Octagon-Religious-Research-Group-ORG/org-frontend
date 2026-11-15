// @vitest-environment jsdom
// Chunk 16b: the Anchors view shows the anchor log against its published
// checkpoint, each anchor's place in it, and the log's public key.

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AnchorRow, AnchorsView } from '#/lib/receipts-api'
import { ANCHOR_LOG_VERIFIER_KEY } from '#/lib/anchor-log'
import {
  AnchorsSection,
  LOG_ALERTS,
  LOG_BOOTSTRAP_WARNING,
  LOG_KEY_MISSING,
} from './AnchorsSection'

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
const counts = { pass: 1, fail: 0, 'cannot-measure': 0 }

const anchor = (log?: AnchorRow['verify']['log']): AnchorRow => ({
  anchorId: '2026-11-14',
  status: 'built',
  leaves: 3,
  tsa: { attempts: 1 },
  ots: { attempts: 1, calendars: [], bitcoinHeights: [] },
  verify: {
    root: pass(),
    versions: pass(),
    tsa: pass(),
    ots: pass(),
    bitcoin: pass(),
    ...(log ? { log } : {}),
  },
})

function view(extra: Partial<AnchorsView>, row = anchor()): AnchorsView {
  return {
    enabled: true,
    checkedAt: '2026-11-14T04:00:00.000Z',
    page: 1,
    hasMore: false,
    totalsScope: 'page',
    global: {
      anchors: 1,
      unfinished: 0,
      failedWhenLastChecked: 0,
      neverChecked: 0,
      cannotMeasureWhenLastChecked: 0,
      oldestCheck: null,
    },
    coverage: pass(),
    totals: {
      root: counts,
      versions: counts,
      tsa: counts,
      ots: counts,
      bitcoin: counts,
    },
    anchors: [row],
    ...extra,
  }
}

beforeEach(() => mocks.auth.getToken.mockResolvedValue('t'))
afterEach(cleanup)

describe('the anchor log in the Anchors view', () => {
  it('shows the log against its published checkpoint, and each anchor in it', async () => {
    mocks.fetchAnchors.mockResolvedValue(
      view(
        {
          log: {
            outcome: 'pass',
            detail: '1 day(s) in the published log, all intact here',
            size: 2,
            publishedSize: 1,
          },
          totals: {
            ...view({}).totals,
            log: { pass: 1, fail: 0, 'cannot-measure': 0 },
          },
        },
        anchor({
          outcome: 'pass',
          detail: 'in the published log (entry 0 of 1)',
        }),
      ),
    )
    render(<AnchorsSection />)
    await screen.findByText(/1 day\(s\) in the published log/)
    expect(
      screen.getByText(/2 days in this server's log, 1 published/),
    ).toBeTruthy()
    expect(screen.getByText(/entry 0 of 1/)).toBeTruthy()
    expect(screen.getByText(/Anchor log: 1 pass/)).toBeTruthy()
  })

  it('a failing log is shown as FAIL, and an unpublished one as not published', async () => {
    mocks.fetchAnchors.mockResolvedValue(
      view({
        log: { outcome: 'fail', detail: 'the log was rewritten', size: 3 },
      }),
    )
    render(<AnchorsSection />)
    await screen.findByText(/the log was rewritten/)
    expect(
      screen.getByText(/3 days in this server's log, none published/),
    ).toBeTruthy()
  })

  it("names the log's public key, or says it is not set", async () => {
    mocks.fetchAnchors.mockResolvedValue(view({}))
    render(<AnchorsSection />)
    await screen.findByText(/Every version anchored/)
    expect(
      screen.getByText(ANCHOR_LOG_VERIFIER_KEY ?? LOG_KEY_MISSING, {
        exact: false,
      }),
    ).toBeTruthy()
    // A server from before the log: no log line at all.
    expect(screen.queryByText(/days in this server's log/)).toBeNull()
  })

  it('H1 + L3 (review 2): a missing publication or a forgotten bootstrap flag is an alert, read from the reason code', async () => {
    mocks.fetchAnchors.mockResolvedValue(
      view({
        log: {
          outcome: 'cannot-measure',
          state: 'cannot-measure',
          reason: 'published-missing',
          detail: 'x',
          size: 3,
        },
      }),
    )
    render(<AnchorsSection />)
    expect((await screen.findByRole('alert')).textContent).toContain(
      LOG_ALERTS['published-missing'],
    )
    cleanup()
    mocks.fetchAnchors.mockResolvedValue(
      view({
        log: {
          outcome: 'pass',
          state: 'published',
          reason: 'bootstrap-on',
          detail: 'y',
          size: 3,
          publishedSize: 3,
        },
      }),
    )
    render(<AnchorsSection />)
    expect((await screen.findByRole('alert')).textContent).toContain(
      LOG_ALERTS['bootstrap-on'],
    )
  })

  it('L1 (review 3): a warning whenever the bootstrap flag is set, whatever the check says', async () => {
    mocks.fetchAnchors.mockResolvedValue(
      view({
        log: {
          outcome: 'cannot-measure',
          state: 'cannot-measure',
          reason: 'nothing-published',
          detail: 'nothing is published yet',
          size: 3,
          bootstrap: true,
        },
      }),
    )
    render(<AnchorsSection />)
    expect((await screen.findByRole('alert')).textContent).toContain(
      LOG_BOOTSTRAP_WARNING,
    )
    cleanup()
    mocks.fetchAnchors.mockResolvedValue(
      view({
        log: {
          outcome: 'cannot-measure',
          state: 'cannot-measure',
          reason: 'nothing-published',
          detail: 'nothing is published yet',
          size: 3,
        },
      }),
    )
    render(<AnchorsSection />)
    await screen.findByText(/days in this server's log/)
    expect(screen.queryByRole('alert')).toBeNull()
    cleanup()
    // Flag on with a head published: the one bootstrap-on alert, not two.
    mocks.fetchAnchors.mockResolvedValue(
      view({
        log: {
          outcome: 'pass',
          state: 'published',
          reason: 'bootstrap-on',
          detail: 'y',
          size: 3,
          publishedSize: 3,
          bootstrap: true,
        },
      }),
    )
    render(<AnchorsSection />)
    const alerts = await screen.findAllByRole('alert')
    expect(alerts.map((a) => a.textContent)).toEqual([
      LOG_ALERTS['bootstrap-on'],
    ])
  })
})
