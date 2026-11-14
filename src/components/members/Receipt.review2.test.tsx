// @vitest-environment jsdom
// Chunk 16 review round 2: each test written to fail on the code before its
// fix.

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type * as ReceiptsApi from '#/lib/receipts-api'
import type { Receipt, ReceiptVersion } from '#/lib/receipts-api'
import { CommentHistory } from './CommentHistory'
import { HistoryPanel } from './HistoryPanel'
import { ReceiptPanel } from './ReceiptPanel'

const mocks = vi.hoisted(() => ({
  auth: { isLoading: false, isAuthenticated: false, getToken: vi.fn() },
  fetchReceipt: vi.fn(),
  fetchHistory: vi.fn(),
  fetchCommentHistory: vi.fn(),
}))

vi.mock('#/lib/auth', () => ({ useOrgAuth: () => mocks.auth }))
vi.mock('#/lib/receipts-api', async (original) => ({
  ...(await original<typeof ReceiptsApi>()),
  fetchReceipt: mocks.fetchReceipt,
}))
vi.mock('#/lib/members-api', async (original) => ({
  ...(await original<object>()),
  fetchHistory: mocks.fetchHistory,
}))
vi.mock('#/lib/comments-api', async (original) => ({
  ...(await original<object>()),
  fetchCommentHistory: mocks.fetchCommentHistory,
}))

const ok = { outcome: 'pass' as const, detail: 'fine' }
const target = { kind: 'belief' as const, slug: 'quiet-fern', tabId: 't1' }

const receipt = (versions: Array<ReceiptVersion>): Receipt => ({
  format: 'org-receipt-v1',
  generatedAt: '2026-11-14T08:00:00.000Z',
  notice: [],
  versions,
})

beforeEach(() => {
  mocks.fetchReceipt.mockReset()
  mocks.fetchHistory.mockReset()
  mocks.fetchCommentHistory.mockReset()
})
afterEach(cleanup)

const shown = async () => {
  await screen.findByRole('button', { name: 'Download receipt' })
  return screen.getByRole('region').textContent
}

describe('L-d: a provider whose check failed is not reported as having stamped', () => {
  it('no "time-stamped" line for FreeTSA, no "confirmed" line for OpenTimestamps', async () => {
    mocks.fetchReceipt.mockResolvedValue(
      receipt([
        {
          seq: 1,
          serverTime: '2026-11-13T10:00:00.000Z',
          hashInput: { included: true },
          anchor: {
            state: 'anchored',
            anchorId: '2026-11-14',
            root: 'b'.repeat(64),
            freetsa: { status: 'granted', genTime: '2026-11-14T03:00:00.000Z' },
            opentimestamps: { status: 'confirmed', bitcoinHeights: [870123] },
            serverChecks: {
              hash: ok,
              path: ok,
              tsa: { outcome: 'fail', detail: 'bad signature' },
              ots: { outcome: 'fail', detail: 'unreadable proof' },
            },
          },
        },
      ]),
    )
    render(<ReceiptPanel target={target} label="x" onClose={() => undefined} />)
    const text = await shown()
    expect(text).not.toContain('FreeTSA: time-stamped')
    expect(text).not.toContain('confirmed in Bitcoin block')
    expect(text).toContain('FreeTSA check: FAILED (bad signature)')
  })

  it('a complete receipt still pending says so, rather than claiming the time-stamps', async () => {
    mocks.fetchReceipt.mockResolvedValue(
      receipt([
        {
          seq: 1,
          serverTime: '2026-11-13T10:00:00.000Z',
          versionHash: 'a'.repeat(64),
          hashInput: { included: true },
          anchor: { state: 'pending', message: 'x' },
        },
      ]),
    )
    render(<ReceiptPanel target={target} label="x" onClose={() => undefined} />)
    const text = await shown()
    expect(text).not.toContain('existed no later than those time-stamps')
    expect(text).toContain('no time-stamp yet')
  })
})

describe('M-A: no hash prefix when the server sends none', () => {
  it('belief history shows no fingerprint for an entry without one', async () => {
    mocks.fetchHistory.mockResolvedValue({
      page: 1,
      hasMore: false,
      entries: [
        {
          seq: 1,
          savedAt: '2026-11-12T08:15:00.000Z',
          text: 'Synthetic words',
          source: 'member',
          beforeFirstEdit: false,
        },
      ],
    })
    render(
      <HistoryPanel slug="s" tabId="t" label="x" onClose={() => undefined} />,
    )
    await screen.findByText('Synthetic words')
    expect(document.body.textContent).not.toContain('undefined')
    expect(document.querySelector('[title*="hash"]')).toBeNull()
  })

  it('comment history the same', async () => {
    mocks.fetchCommentHistory.mockResolvedValue({
      page: 1,
      hasMore: false,
      entries: [
        {
          seq: 1,
          savedAt: '2026-11-12T08:15:00.000Z',
          text: 'Synthetic words',
        },
      ],
    })
    render(<CommentHistory slug="s" commentId="c" onClose={() => undefined} />)
    await screen.findByText('Synthetic words')
    expect(document.querySelector('[title*="hash"]')).toBeNull()
  })
})

describe('round 3: a reader allowed to know the author gets the hashes, not the hash input', () => {
  it('says the hash can be checked onwards, and the text step needs the author’s receipt', async () => {
    mocks.fetchReceipt.mockResolvedValue(
      receipt([
        {
          seq: 1,
          serverTime: '2026-11-13T10:00:00.000Z',
          versionHash: 'a'.repeat(64),
          disclosure: 'hashes',
          hashInput: { included: false },
          anchor: {
            state: 'anchored',
            anchorId: '2026-11-14',
            root: 'b'.repeat(64),
            freetsa: { status: 'granted', genTime: '2026-11-14T03:00:00.000Z' },
            opentimestamps: { status: 'pending', bitcoinHeights: [] },
            serverChecks: { hash: ok, path: ok, tsa: ok, ots: ok },
          },
        },
      ]),
    )
    render(<ReceiptPanel target={target} label="x" onClose={() => undefined} />)
    const text = await shown()
    expect(text).toContain('from that fingerprint on')
    expect(text).toContain('needs the author’s complete receipt')
    expect(text).not.toContain('sealed fingerprint')
  })
})

describe('round 3, L-4: the hashes wording while anchoring is pending', () => {
  it('does not claim time-stamps that are not there yet', async () => {
    mocks.fetchReceipt.mockResolvedValue(
      receipt([
        {
          seq: 1,
          serverTime: '2026-11-13T10:00:00.000Z',
          versionHash: 'a'.repeat(64),
          disclosure: 'hashes',
          hashInput: { included: false },
          anchor: { state: 'pending', message: 'x' },
        },
      ]),
    )
    render(<ReceiptPanel target={target} label="x" onClose={() => undefined} />)
    const text = await shown()
    expect(text).not.toContain('existed no later than those time-stamps')
    expect(text).toContain('no time-stamp yet')
    expect(text).toContain('needs the author’s complete receipt')
  })
})

describe('round 4, LOW-2: the leaf-only wording while anchoring is pending', () => {
  it('does not claim time-stamps that are not there yet', async () => {
    mocks.fetchReceipt.mockResolvedValue(
      receipt([
        {
          seq: 1,
          serverTime: '2026-11-13T10:00:00.000Z',
          disclosure: 'none',
          hashInput: { included: false },
          anchor: { state: 'pending', message: 'x' },
        },
      ]),
    )
    render(<ReceiptPanel target={target} label="x" onClose={() => undefined} />)
    const text = await shown()
    expect(text).not.toContain('existed no later than those time-stamps')
    expect(text).toContain('no time-stamp yet')
    expect(text).toContain('author’s complete receipt')
  })
})
