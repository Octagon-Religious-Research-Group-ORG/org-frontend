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
            freetsa: {
              status: 'granted',
              genTime: '2026-11-14T03:00:00.000Z',
              responseBase64: 'AAAA',
            },
            opentimestamps: {
              status: 'pending',
              bitcoinHeights: [],
              proofBase64: 'AAAA',
            },
            serverChecks: { hash: ok, path: ok, tsa: ok, ots: ok },
          },
        },
      ]),
    )
    render(<ReceiptPanel target={target} label="x" onClose={() => undefined} />)
    const text = await shown()
    expect(text).toContain('from that fingerprint on')
    expect(text).toContain("needs the author's complete receipt")
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
    expect(text).toContain("needs the author's complete receipt")
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
    expect(text).toContain("author's complete receipt")
  })
})

describe('round 7, LOW-3: the wording names the stamps the receipt holds', () => {
  const anchoredWith = (stamps: {
    tsa?: boolean
    ots?: boolean
    /** The OpenTimestamps proof is confirmed in Bitcoin (round 8). */
    inBitcoin?: boolean
  }): ReceiptVersion => ({
    seq: 1,
    serverTime: '2026-11-13T10:00:00.000Z',
    hashInput: { included: true },
    anchor: {
      state: 'anchored',
      anchorId: '2026-11-14',
      root: 'b'.repeat(64),
      freetsa: {
        status: stamps.tsa ? 'granted' : 'pending',
        ...(stamps.tsa ? { responseBase64: 'AAAA' } : {}),
      },
      opentimestamps: {
        status: stamps.ots ? 'pending' : 'submit',
        bitcoinHeights: stamps.inBitcoin ? [975755] : [],
        ...(stamps.ots ? { proofBase64: 'AAAA' } : {}),
      },
      serverChecks: {
        hash: ok,
        path: ok,
        tsa: { outcome: 'cannot-measure', detail: 'x' },
        ots: { outcome: 'cannot-measure', detail: 'x' },
      },
    },
  })

  it('anchored, but neither proof received yet: the pending wording', async () => {
    mocks.fetchReceipt.mockResolvedValue(receipt([anchoredWith({})]))
    render(<ReceiptPanel target={target} label="x" onClose={() => undefined} />)
    const text = await shown()
    expect(text).toContain('no time-stamp yet')
    expect(text).not.toContain('no later than those time-stamps')
  })

  it.each([
    [
      { tsa: true },
      'Only the FreeTSA time-stamp gives a time so far; the OpenTimestamps proof is not confirmed in Bitcoin yet.',
    ],
    [
      { ots: true, inBitcoin: true },
      'Only the OpenTimestamps proof, confirmed in Bitcoin, gives a time so far; the FreeTSA time-stamp is not in yet.',
    ],
  ])('one stamp: names it (%o)', async (stamps, phrase) => {
    mocks.fetchReceipt.mockResolvedValue(receipt([anchoredWith(stamps)]))
    render(<ReceiptPanel target={target} label="x" onClose={() => undefined} />)
    const text = await shown()
    expect(text).toContain(phrase)
    expect(text).not.toContain('no time-stamp yet')
  })

  it('both stamps, the OpenTimestamps proof confirmed in Bitcoin: the complete wording, no note', async () => {
    mocks.fetchReceipt.mockResolvedValue(
      receipt([anchoredWith({ tsa: true, ots: true, inBitcoin: true })]),
    )
    render(<ReceiptPanel target={target} label="x" onClose={() => undefined} />)
    const text = await shown()
    expect(text).toContain('no later than those time-stamps')
    expect(text).not.toContain('Only the')
    expect(text).not.toContain('not yet confirmed')
  })

  it('round 8, LOW-1: only an OpenTimestamps proof not yet in Bitcoin is pending, and says why', async () => {
    mocks.fetchReceipt.mockResolvedValue(receipt([anchoredWith({ ots: true })]))
    render(<ReceiptPanel target={target} label="x" onClose={() => undefined} />)
    const text = await shown()
    expect(text).toContain('no time-stamp yet')
    expect(text).toContain(
      'An OpenTimestamps proof is in but not yet confirmed in a Bitcoin block, so it gives no time yet.',
    )
    expect(text).not.toContain('Only the OpenTimestamps proof')
  })

  it('round 8, LOW-2: versions holding different stamps are stamped, with a neutral sentence', async () => {
    mocks.fetchReceipt.mockResolvedValue(
      receipt([
        anchoredWith({ tsa: true }),
        { ...anchoredWith({ ots: true, inBitcoin: true }), seq: 2 },
      ]),
    )
    render(<ReceiptPanel target={target} label="x" onClose={() => undefined} />)
    const text = await shown()
    expect(text).not.toContain('no time-stamp yet')
    expect(text).toContain(
      'Some versions hold only one of the two time-stamps.',
    )
  })
})

describe('round 9, L2: a stamp whose check failed is not a stamp', () => {
  const version = (
    checks: Partial<Record<'hash' | 'path' | 'tsa' | 'ots', 'fail'>>,
    tier: Pick<ReceiptVersion, 'hashInput' | 'disclosure'>,
  ): ReceiptVersion => ({
    seq: 1,
    serverTime: '2026-11-13T10:00:00.000Z',
    ...tier,
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
        hash: checks.hash ? { outcome: 'fail', detail: 'x' } : ok,
        path: checks.path ? { outcome: 'fail', detail: 'x' } : ok,
        tsa: checks.tsa ? { outcome: 'fail', detail: 'x' } : ok,
        ots: { outcome: 'cannot-measure', detail: 'x' },
      },
    },
  })
  const complete = { hashInput: { included: true as const } }

  it('a FreeTSA token whose check failed gives no time: pending', async () => {
    mocks.fetchReceipt.mockResolvedValue(
      receipt([version({ tsa: 'fail' }, complete)]),
    )
    render(<ReceiptPanel target={target} label="x" onClose={() => undefined} />)
    const text = await shown()
    expect(text).toContain('no time-stamp yet')
    expect(text).not.toContain('no later than those time-stamps')
  })

  it.each([
    ['complete', complete],
    [
      'hashes',
      {
        hashInput: { included: false as const },
        disclosure: 'hashes' as const,
      },
    ],
    [
      'leaf only',
      { hashInput: { included: false as const }, disclosure: 'none' as const },
    ],
  ])(
    '%s: a failed hash or path check says it could not be confirmed',
    async (_tier, tier) => {
      for (const failed of ['hash', 'path'] as const) {
        cleanup()
        mocks.fetchReceipt.mockResolvedValue(
          receipt([version({ [failed]: 'fail' }, tier)]),
        )
        render(
          <ReceiptPanel target={target} label="x" onClose={() => undefined} />,
        )
        const text = await shown()
        expect(text).toContain('could not be confirmed')
        expect(text).not.toContain('no later than those time-stamps')
      }
    },
  )
})
