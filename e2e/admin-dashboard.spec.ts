import { expect, test } from '@playwright/test'

// The admin dashboard (Chunk 12) as a logged-out visitor sees it. A signed-in
// admin needs a real Clerk session, which this suite does not have.
test.describe('admin dashboard, for a logged-out visitor', () => {
  test('asks a guest to sign in, and asks the server nothing', async ({
    page,
  }) => {
    const adminCalls: Array<string> = []
    page.on('request', (request) => {
      if (/\/api\/v1\/(admin|me)\//.test(request.url())) {
        adminCalls.push(request.url())
      }
    })
    const response = await page.goto('/admin')
    expect(response?.status()).toBe(200)
    await expect(
      page.getByRole('heading', { name: 'Sign in to continue.' }),
    ).toBeVisible()
    await expect(page.getByText('Admin dashboard')).toHaveCount(0)
    await expect(page.getByRole('tab')).toHaveCount(0)
    expect(adminCalls).toEqual([])
  })

  test('the old claims address still works', async ({ page }) => {
    const response = await page.goto('/admin/claims')
    expect(response?.status()).toBe(200)
    await expect(
      page.getByRole('heading', { name: 'Sign in to continue.' }),
    ).toBeVisible()
  })

  test('a guest in the Members Community is offered no EaM request', async ({
    page,
  }) => {
    const eamCalls: Array<string> = []
    page.on('request', (request) => {
      if (request.url().includes('/eam-request')) eamCalls.push(request.url())
    })
    await page.goto('/community')
    await page.getByRole('button', { name: 'Guest' }).click()
    await expect(
      page.getByRole('link', { name: 'Contact Tripp' }),
    ).toBeVisible()
    await expect(page.getByRole('button', { name: 'Request EaM' })).toHaveCount(
      0,
    )
    await expect(
      page.getByRole('heading', { name: 'Entheogen-approved Member' }),
    ).toHaveCount(0)
    expect(eamCalls).toEqual([])
  })
})
