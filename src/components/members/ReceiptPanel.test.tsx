// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type * as ReceiptsApi from '#/lib/receipts-api'
import type { Receipt, ReceiptVersion } from '#/lib/receipts-api'
import {
  ANCHORING_PENDING,
  RECEIPT_EXPLAINED,
  ReceiptPanel,
} from './ReceiptPanel'

const mocks = vi.hoisted(() => ({
  auth: {
    isLoading: false,
    isAuthenticated: false,
    getToken: vi.fn<() => Promise<string | undefined>>(),
  },
  fetchReceipt: vi.fn(),
  downloadReceipt: vi.fn(),
}))

vi.mock('#/lib/auth', () => ({ useOrgAuth: () => mocks.auth }))
vi.mock('#/lib/receipts-api', async (original) => ({
  ...(await original<typeof ReceiptsApi>()),
  fetchReceipt: mocks.fetchReceipt,
  downloadReceipt: mocks.downloadReceipt,
}))

const checks = {
  hash: { outcome: 'pass' as const, detail: '' },
  path: { outcome: 'pass' as const, detail: '' },
  tsa: { outcome: 'pass' as const, detail: '' },
  ots: { outcome: 'pass' as const, detail: '' },
}

const anchored = (
  freetsa: { status: string; genTime?: string },
  opentimestamps: { status: string; bitcoinHeights: Array<number> },
  extra: Partial<ReceiptVersion> = {},
): ReceiptVersion => ({
  seq: 2,
  serverTime: '2026-11-13T10:00:00.000Z',
  versionHash: 'a'.repeat(64),
  hashInput: { included: true },
  anchor: {
    state: 'anchored',
    anchorId: '2026-11-14',
    root: 'b'.repeat(64),
    freetsa,
    opentimestamps,
    serverChecks: checks,
  },
  ...extra,
})

const receipt = (versions: Array<ReceiptVersion>): Receipt => ({
  format: 'org-receipt-v1',
  generatedAt: '2026-11-14T08:00:00.000Z',
  notice: [],
  versions,
})

const target = { kind: 'belief' as const, slug: 'quiet-fern', tabId: 't1' }
const onClose = vi.fn()

beforeEach(() => {
  mocks.auth.isLoading = false
  mocks.auth.isAuthenticated = false
  mocks.auth.getToken.mockReset().mockResolvedValue('tok')
  mocks.fetchReceipt.mockReset()
  mocks.downloadReceipt.mockReset().mockResolvedValue('receipt-1.zip')
})
afterEach(cleanup)

describe('ReceiptPanel', () => {
  it('explains what a receipt proves and does not, honestly about FreeTSA and imports', async () => {
    mocks.fetchReceipt.mockResolvedValue(
      receipt([
        {
          seq: 1,
          serverTime: '2026-11-13T10:00:00.000Z',
          versionHash: 'c'.repeat(64),
          hashInput: { included: false },
          anchor: { state: 'pending', message: 'x' },
        },
      ]),
    )
    render(<ReceiptPanel target={target} label="“First”" onClose={onClose} />)
    expect(screen.getByRole('status').textContent).toMatch(/Checking/)
    for (const line of RECEIPT_EXPLAINED) {
      expect(screen.getByText(line)).toBeTruthy()
    }
    expect(RECEIPT_EXPLAINED.join(' ')).toContain('not an EU “qualified”')
    expect(RECEIPT_EXPLAINED.join(' ')).toContain('not legal advice')
    expect(await screen.findByText(ANCHORING_PENDING)).toBeTruthy()
    expect(mocks.fetchReceipt).toHaveBeenCalledWith(target, undefined)
    fireEvent.click(screen.getByRole('button', { name: 'Close receipt' }))
    expect(onClose).toHaveBeenCalled()
  })

  it('says each provider’s state, and the import wording, then downloads with the token', async () => {
    mocks.auth.isAuthenticated = true
    mocks.fetchReceipt.mockResolvedValue(
      receipt([
        anchored(
          { status: 'granted', genTime: '2026-11-14T03:01:00.000Z' },
          { status: 'confirmed', bitcoinHeights: [870123] },
          {
            outlineLabel: 'I.',
            imported:
              'imported from Apple Pages; originally written before 2026-10-12',
          },
        ),
        anchored(
          { status: 'pending' },
          { status: 'pending', bitcoinHeights: [] },
          { seq: 3, versionHash: 'd'.repeat(64) },
        ),
        anchored(
          { status: 'failed' },
          { status: 'failed', bitcoinHeights: [] },
          { seq: 4, versionHash: 'e'.repeat(64) },
        ),
      ]),
    )
    render(<ReceiptPanel target={target} label="“First”" onClose={onClose} />)
    expect(
      await screen.findByText(
        /Imported from Apple Pages; originally written before 2026-10-12/,
      ),
    ).toBeTruthy()
    const text = screen.getByRole('region').textContent
    expect(text).toContain('Anchored on Nov 14, 2026.')
    expect(text).toContain('FreeTSA: time-stamped Nov 14, 2026, 3:01 AM UTC.')
    expect(text).toContain('OpenTimestamps: confirmed in Bitcoin block 870123.')
    expect(text).toContain('OpenTimestamps: waiting for Bitcoin')
    expect(text).toContain('FreeTSA: not received yet')
    expect(text).toContain('OpenTimestamps: not received yet')
    expect(screen.getByText('I.')).toBeTruthy()
    expect(mocks.fetchReceipt).toHaveBeenCalledWith(target, 'tok')
    fireEvent.click(screen.getByRole('button', { name: 'Download receipt' }))
    expect(
      screen
        .getByRole('button', { name: 'Preparing…' })
        .hasAttribute('disabled'),
    ).toBe(true)
    expect(await screen.findByText('Saved as receipt-1.zip.')).toBeTruthy()
    expect(mocks.downloadReceipt).toHaveBeenCalledWith(target, 'tok')
  })

  it('shows the server’s refusal, as for reading (a guest on a members-only belief)', async () => {
    mocks.fetchReceipt.mockRejectedValue(new Error('That page does not exist.'))
    render(<ReceiptPanel target={target} label="“First”" onClose={onClose} />)
    expect((await screen.findByRole('alert')).textContent).toBe(
      'That page does not exist.',
    )
    expect(
      screen.queryByRole('button', { name: 'Download receipt' }),
    ).toBeNull()
  })

  it('names a failed download, and a failure that is not an Error', async () => {
    mocks.fetchReceipt.mockResolvedValue(
      receipt([
        anchored(
          { status: 'granted' },
          { status: 'pending', bitcoinHeights: [] },
        ),
      ]),
    )
    mocks.downloadReceipt
      .mockRejectedValueOnce(new Error('That page does not exist.'))
      .mockRejectedValueOnce('odd')
    render(<ReceiptPanel target={target} label="“First”" onClose={onClose} />)
    fireEvent.click(
      await screen.findByRole('button', { name: 'Download receipt' }),
    )
    expect((await screen.findByRole('alert')).textContent).toBe(
      'That page does not exist.',
    )
    fireEvent.click(screen.getByRole('button', { name: 'Download receipt' }))
    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toBe(
        'The receipt did not download.',
      ),
    )
    // FreeTSA granted without a time reads as not received.
    expect(screen.getByRole('region').textContent).toContain(
      'FreeTSA: not received yet',
    )
  })

  it('waits for sign-in to settle, refuses an unconfirmed session, and drops a late answer', async () => {
    mocks.auth.isLoading = true
    const { rerender, unmount } = render(
      <ReceiptPanel target={target} label="x" onClose={onClose} />,
    )
    expect(mocks.fetchReceipt).not.toHaveBeenCalled()
    // Signing in settles: a new auth state, as the real hook gives.
    mocks.auth = { ...mocks.auth, isLoading: false, isAuthenticated: true }
    mocks.auth.getToken.mockResolvedValue(undefined)
    rerender(<ReceiptPanel target={target} label="x" onClose={onClose} />)
    expect((await screen.findByRole('alert')).textContent).toMatch(
      /couldn't confirm that you're signed in/,
    )
    unmount()

    mocks.auth.getToken.mockResolvedValue('tok')
    let answer!: (value: Receipt) => void
    mocks.fetchReceipt.mockReturnValueOnce(
      new Promise((resolve) => {
        answer = resolve
      }),
    )
    const late = render(
      <ReceiptPanel target={target} label="x" onClose={onClose} />,
    )
    await waitFor(() => expect(mocks.fetchReceipt).toHaveBeenCalled())
    late.unmount()
    answer(receipt([]))
    let reject!: (error: unknown) => void
    mocks.fetchReceipt.mockReturnValueOnce(
      new Promise((_, no) => {
        reject = no
      }),
    )
    const lateError = render(
      <ReceiptPanel target={target} label="x" onClose={onClose} />,
    )
    await waitFor(() => expect(mocks.fetchReceipt).toHaveBeenCalledTimes(2))
    lateError.unmount()
    reject('gone')
    await Promise.resolve()
  })

  it('a refusal that is not an Error still says something', async () => {
    mocks.fetchReceipt.mockRejectedValue('odd')
    render(<ReceiptPanel target={target} label="x" onClose={onClose} />)
    expect((await screen.findByRole('alert')).textContent).toBe(
      'No receipt is available.',
    )
  })
})
