// @vitest-environment jsdom
// Chunk 16 review round 10: each test written to fail on the code before
// its fix.

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type * as ReceiptsApi from '#/lib/receipts-api'
import type { ReceiptVersion } from '#/lib/receipts-api'
import * as panel from './ReceiptPanel'
import { ReceiptPanel } from './ReceiptPanel'

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

describe('LOW-1: an OpenTimestamps proof whose check failed is not "in but unconfirmed"', () => {
  it('no "in but not yet confirmed" line, only the pending wording', async () => {
    const version: ReceiptVersion = {
      seq: 1,
      serverTime: '2026-11-13T10:00:00.000Z',
      hashInput: { included: true },
      anchor: {
        state: 'anchored',
        anchorId: '2026-11-14',
        root: 'b'.repeat(64),
        freetsa: { status: 'pending' },
        opentimestamps: {
          status: 'pending',
          bitcoinHeights: [],
          proofBase64: 'AAAA',
        },
        serverChecks: {
          hash: ok,
          path: ok,
          tsa: { outcome: 'cannot-measure', detail: 'x' },
          ots: { outcome: 'fail', detail: 'the proof is for another digest' },
        },
      },
    }
    mocks.fetchReceipt.mockResolvedValue({
      format: 'org-receipt-v1',
      generatedAt: '2026-11-14T08:00:00.000Z',
      notice: [],
      versions: [version],
    })
    render(
      <ReceiptPanel
        target={{ kind: 'belief', slug: 'quiet-fern', tabId: 't1' }}
        label="x"
        onClose={() => undefined}
      />,
    )
    await screen.findByRole('button', { name: 'Download receipt' })
    const text = screen.getByRole('region').textContent
    expect(text).toContain('no time-stamp yet')
    expect(text).not.toContain('An OpenTimestamps proof is in')
  })
})

describe('LOW-2: every receipt notice uses straight apostrophes and quotes, as the server does', () => {
  it('no exported notice holds a curly one', () => {
    const texts = Object.entries(panel).flatMap(([name, value]) =>
      typeof value === 'string'
        ? [[name, value]]
        : typeof value === 'object'
          ? Object.entries(value as Record<string, unknown>)
              .filter(([, inner]) => typeof inner === 'string')
              .map(([key, inner]) => [`${name}.${key}`, inner as string])
          : [],
    )
    expect(texts.length).toBeGreaterThanOrEqual(10)
    for (const [name, text] of texts) {
      expect([name, /[’“”]/.test(text)]).toEqual([name, false])
    }
  })
})
