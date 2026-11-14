import { expect, test } from '@playwright/test'

const API = 'http://127.0.0.1:3001/api/v1'

test.describe('receipts for a logged-out visitor (Chunk 16)', () => {
  test('a members-only page offers no receipt, and asking for one directly is refused', async ({
    page,
    request,
  }) => {
    await page.goto('/members-example')
    await expect(page.getByText('Members Example')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Receipt' })).toHaveCount(0)
    await expect(page.getByText('Download receipt')).toHaveCount(0)
    // A guest who knows the address still gets the 404 of reading.
    for (const path of [
      '/members/profiles/members-example/tabs/m1/receipt',
      '/members/profiles/members-example/tabs/m1/receipt/download',
    ]) {
      const response = await request.get(`${API}${path}`)
      expect(response.status(), path).toBe(404)
      expect(response.headers()['content-type'], path).toContain('json')
    }
  })

  test('a public belief explains its receipt, says anchoring is pending, and downloads it', async ({
    page,
  }) => {
    await page.goto('/open-example')
    await page.getByRole('button', { name: 'Receipt' }).first().click()
    const panel = page.getByRole('region', { name: /Receipt for “First tab”/ })
    await expect(panel).toBeVisible()
    await expect(panel).toContainText(
      'not an EU "qualified" time-stamp authority',
    )
    await expect(panel).toContainText('not legal advice')
    await expect(panel).toContainText('Anchoring pending')
    const download = page.waitForEvent('download')
    await panel.getByRole('button', { name: 'Download receipt' }).click()
    expect((await download).suggestedFilename()).toBe(
      'receipt-open-example-t1-text-2.zip',
    )
    await expect(panel).toContainText(
      'Saved as receipt-open-example-t1-text-2.zip.',
    )
  })
})
