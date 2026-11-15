// @vitest-environment jsdom
// Chunk 16b: a receipt shows where its day stands in ORG's public anchor
// log, and a log that does not hold makes it "could not be confirmed".

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type * as ReceiptsApi from '#/lib/receipts-api'
import type { LogCheck, ReceiptVersion } from '#/lib/receipts-api'
import {
  LOG_FAILED,
  LOG_PENDING,
  LOG_PUBLISHED,
  LOG_UNCHECKED,
  ReceiptPanel,
  UNCONFIRMED_RECEIPT,
} from './ReceiptPanel'

const mocks = vi.hoisted(() => ({
  auth: { isLoading: false, isAuthenticated: false, getToken: vi.fn() },
  fetchReceipt: vi.fn(),
}))

vi.mock('#/lib/auth', () => ({ useOrgAuth: () => mocks.auth }))
vi.mock('#/lib/receipts-api', async (original) => ({
  ...(await original<typeof ReceiptsApi>()),
  fetchReceipt: mocks.fetchReceipt,
}))

afterEach(cleanup)

const ok = { outcome: 'pass' as const, detail: 'fine' }

function versionWith(log?: LogCheck): ReceiptVersion {
  return {
    seq: 1,
    serverTime: '2026-11-13T10:00:00.000Z',
    hashInput: { included: true },
    anchor: {
      state: 'anchored',
      anchorId: '2026-11-14',
      root: 'b'.repeat(64),
      freetsa: {
        status: 'granted',
        genTime: '2026-11-14T03:00:00.000Z',
        responseBase64: 'AAAA',
      },
      opentimestamps: { status: 'pending', bitcoinHeights: [] },
      serverChecks: {
        hash: ok,
        path: ok,
        tsa: ok,
        ots: ok,
        ...(log ? { log } : {}),
      },
    },
  }
}

async function shown(log?: LogCheck) {
  mocks.fetchReceipt.mockResolvedValue({
    format: 'org-receipt-v1',
    generatedAt: '2026-11-14T08:00:00.000Z',
    notice: [],
    versions: [versionWith(log)],
  })
  render(
    <ReceiptPanel
      target={{ kind: 'belief', slug: 'quiet-fern', tabId: 't1' }}
      label="x"
      onClose={() => undefined}
    />,
  )
  await screen.findByRole('button', { name: 'Download receipt' })
  return screen.getByRole('region').textContent
}

describe('the anchor log on a receipt', () => {
  it('a published day says so', async () => {
    const text = await shown({
      outcome: 'pass',
      detail: 'in the published log',
    })
    expect(text).toContain(LOG_PUBLISHED)
    expect(text).not.toContain(UNCONFIRMED_RECEIPT)
  })

  it('a day not published yet says it is pending, never that it is in', async () => {
    const text = await shown({
      outcome: 'cannot-measure',
      state: 'pending',
      detail: 'pending publication: not yet published',
    })
    expect(text).toContain(LOG_PENDING)
    expect(text).not.toContain(LOG_PUBLISHED)
    expect(text).not.toContain(UNCONFIRMED_RECEIPT)
  })

  it('a log that does not hold: could not be confirmed, with the reason', async () => {
    const text = await shown({
      outcome: 'fail',
      detail:
        'the anchor of 2026-11-12 is in the published log but missing here',
    })
    expect(text).toContain(UNCONFIRMED_RECEIPT)
    expect(text).toContain(LOG_FAILED)
    expect(text).toContain('missing here')
    expect(text).not.toContain(LOG_PUBLISHED)
  })

  it('a receipt from before the log says nothing about it', async () => {
    const text = await shown()
    expect(text).not.toContain(LOG_PUBLISHED)
    expect(text).not.toContain(LOG_PENDING)
  })

  it('L4: not set up, or the published copy unreadable: says it could not be checked, never pending', async () => {
    const text = await shown({
      outcome: 'cannot-measure',
      detail:
        'ANCHOR_LOG_PUBLISHED_URL is not set: there is no published log to check against.',
    })
    expect(text).toContain(LOG_UNCHECKED)
    expect(text).toContain('ANCHOR_LOG_PUBLISHED_URL is not set')
    expect(text).not.toContain(LOG_PENDING)
    expect(text).not.toContain(LOG_PUBLISHED)
  })

  it('L3 (review 2): decides from the structured state, never from the detail text', async () => {
    // A pending day whose detail does not start with the old prefix.
    let text = await shown({
      outcome: 'cannot-measure',
      state: 'pending',
      reason: 'pending-publication',
      detail: 'finished, not yet in the published log',
    })
    expect(text).toContain(LOG_PENDING)
    cleanup()
    // An unchecked log whose detail happens to start with that prefix.
    text = await shown({
      outcome: 'cannot-measure',
      state: 'cannot-measure',
      reason: 'published-missing',
      detail: 'pending publication: (a misleading text)',
    })
    expect(text).toContain(LOG_UNCHECKED)
    expect(text).not.toContain(LOG_PENDING)
  })
})
