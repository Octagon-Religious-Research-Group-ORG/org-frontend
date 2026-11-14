import { expect, test } from '@playwright/test'

// Chunk 17 ("Your data"), as a visitor who is not signed in sees it.
// Synthetic data only. The signed-in page needs a real Clerk session, which
// this suite does not have.
test.describe('your data, for a guest', () => {
  test('the page asks for a sign-in and reads or exports nothing', async ({
    page,
  }) => {
    const calls: Array<string> = []
    page.on('request', (request) => {
      if (request.url().includes('/api/v1/me/data')) calls.push(request.url())
    })
    await page.goto('/settings/data')
    await expect(
      page.getByRole('heading', { name: 'Sign in to continue.' }),
    ).toBeVisible()
    await expect(
      page.getByRole('button', { name: 'Download my data' }),
    ).toHaveCount(0)
    await expect(page.getByRole('dialog')).toHaveCount(0)
    expect(calls).toEqual([])
    await expect(page).toHaveTitle('Your data — ORG')
  })
})
