import { expect, test } from '@playwright/test'

// Claims (Chunk 11) as a logged-out visitor sees them. A signed-in claim
// needs a real Clerk session, which this suite does not have.
test.describe('claims, for a logged-out visitor', () => {
  test('an imported page offers a guest no claim', async ({ page }) => {
    await page.goto('/open-example')
    await expect(page.getByText('First synthetic belief.')).toBeVisible()
    await expect(page.getByText(/This is my page/)).toHaveCount(0)
    await expect(page.getByText(/ask to claim/i)).toHaveCount(0)
  })

  test('the claims queue asks a guest to sign in, and asks the server nothing', async ({
    page,
  }) => {
    const claimCalls: Array<string> = []
    page.on('request', (request) => {
      if (/\/api\/v1\/.*claims/.test(request.url())) {
        claimCalls.push(request.url())
      }
    })
    const response = await page.goto('/admin/claims')
    expect(response?.status()).toBe(200)
    await expect(
      page.getByRole('heading', { name: 'Sign in to continue.' }),
    ).toBeVisible()
    await expect(page.getByText('Page claims')).toHaveCount(0)
    expect(claimCalls).toEqual([])
  })
})
