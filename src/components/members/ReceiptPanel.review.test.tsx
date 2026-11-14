// @vitest-environment jsdom
// Chunk 16 review: each test written to fail on the code before its fix.

import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type * as ReceiptsApi from '#/lib/receipts-api'
import type { Receipt, ReceiptVersion } from '#/lib/receipts-api'
import { ReceiptPanel } from './ReceiptPanel'

const mocks = vi.hoisted(() => ({
  auth: {
    isLoading: false,
    isAuthenticated: false,
    getToken: vi.fn<() => Promise<string | undefined>>(),
  },
  fetchReceipt: vi.fn(),
}))

vi.mock('#/lib/auth', () => ({ useOrgAuth: () => mocks.auth }))
vi.mock('#/lib/receipts-api', async (original) => ({
  ...(await original<typeof ReceiptsApi>()),
  fetchReceipt: mocks.fetchReceipt,
}))

const ok = { outcome: 'pass' as const, detail: 'fine' }

function version(
  checks: Partial<
    Record<
      'hash' | 'path' | 'tsa' | 'ots',
      { outcome: 'pass' | 'fail' | 'cannot-measure'; detail: string }
    >
  > = {},
  included = true,
): ReceiptVersion {
  return {
    seq: 1,
    serverTime: '2026-11-13T10:00:00.000Z',
    versionHash: 'a'.repeat(64),
    hashInput: { included },
    anchor: {
      state: 'anchored',
      anchorId: '2026-11-14',
      root: 'b'.repeat(64),
      freetsa: { status: 'granted', genTime: '2026-11-14T03:00:00.000Z' },
      opentimestamps: { status: 'pending', bitcoinHeights: [] },
      serverChecks: { hash: ok, path: ok, tsa: ok, ots: ok, ...checks },
    },
  }
}

const receipt = (versions: Array<ReceiptVersion>): Receipt => ({
  format: 'org-receipt-v1',
  generatedAt: '2026-11-14T08:00:00.000Z',
  notice: [],
  versions,
})

const target = { kind: 'belief' as const, slug: 'quiet-fern', tabId: 't1' }

beforeEach(() => {
  mocks.auth = {
    isLoading: false,
    isAuthenticated: false,
    getToken: vi.fn<() => Promise<string | undefined>>(),
  }
  mocks.fetchReceipt.mockReset()
})
afterEach(cleanup)

const shown = async () => {
  await screen.findByRole('button', { name: 'Download receipt' })
  return screen.getByRole('region').textContent
}

describe('M2: the server’s own checks are shown', () => {
  it('never says "Anchored" when the hash or the path failed', async () => {
    mocks.fetchReceipt.mockResolvedValue(
      receipt([
        version({
          path: {
            outcome: 'fail',
            detail: 'the path does not lead to the anchored root',
          },
        }),
      ]),
    )
    render(<ReceiptPanel target={target} label="x" onClose={() => undefined} />)
    const text = await shown()
    expect(text).not.toContain('Anchored on')
    expect(text).toContain('could not confirm')
    expect(text).toContain('the path does not lead to the anchored root')
  })

  it('shows a failed or unmeasurable proof check as a warning', async () => {
    mocks.fetchReceipt.mockResolvedValue(
      receipt([
        version({
          tsa: { outcome: 'cannot-measure', detail: 'no FreeTSA token yet' },
          ots: { outcome: 'fail', detail: 'unreadable proof' },
        }),
      ]),
    )
    render(<ReceiptPanel target={target} label="x" onClose={() => undefined} />)
    const text = await shown()
    expect(text).toContain(
      'FreeTSA check: could not be checked (no FreeTSA token yet)',
    )
    expect(text).toContain('OpenTimestamps check: FAILED (unreadable proof)')
  })
})

describe('M3: a receipt without the hash input says what it proves', () => {
  it('for a reader who is not the author', async () => {
    mocks.fetchReceipt.mockResolvedValue(receipt([version({}, false)]))
    render(<ReceiptPanel target={target} label="x" onClose={() => undefined} />)
    const text = await shown()
    expect(text).toContain(
      'proves only that this version’s sealed fingerprint (its leaf in the anchor) existed',
    )
    expect(text).toContain('only with the complete receipt')
    expect(text).not.toContain('Anyone can check it with free public tools')
  })

  it('for the author, the complete wording', async () => {
    mocks.fetchReceipt.mockResolvedValue(receipt([version({}, true)]))
    render(<ReceiptPanel target={target} label="x" onClose={() => undefined} />)
    const text = await shown()
    expect(text).toContain('this exact text existed')
    expect(text).not.toContain('complete receipt')
  })
})

describe('L6: what the panel waits on', () => {
  it('starts afresh for another version, and ignores a new auth object with the same values', async () => {
    mocks.fetchReceipt.mockResolvedValueOnce(receipt([version()]))
    const { rerender } = render(
      <ReceiptPanel target={target} label="x" onClose={() => undefined} />,
    )
    await shown()
    // Same sign-in state, new object: no new request.
    mocks.auth = { ...mocks.auth }
    rerender(
      <ReceiptPanel target={target} label="x" onClose={() => undefined} />,
    )
    expect(mocks.fetchReceipt).toHaveBeenCalledTimes(1)
    // Another belief: the old answer is not shown while the new one loads.
    mocks.fetchReceipt.mockReturnValueOnce(new Promise(() => undefined))
    rerender(
      <ReceiptPanel
        target={{ ...target, tabId: 't2' }}
        label="x"
        onClose={() => undefined}
      />,
    )
    await waitFor(() => expect(mocks.fetchReceipt).toHaveBeenCalledTimes(2))
    expect(
      screen.queryByRole('button', { name: 'Download receipt' }),
    ).toBeNull()
    expect(screen.getByRole('status').textContent).toMatch(/Checking/)
  })
})
