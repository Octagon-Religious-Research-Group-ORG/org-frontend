import { expect, test } from '@playwright/test'

// Chunk 18 (connection requests), as a visitor who is not signed in sees it.
// Synthetic data only. The signed-in parts need a real Clerk session, which
// this suite does not have; they are covered by the component tests.
test.describe('connection requests, for a guest', () => {
  test('the settings page asks for a sign-in and reads nothing', async ({
    page,
  }) => {
    const calls: Array<string> = []
    page.on('request', (request) => {
      if (request.url().includes('/api/v1/me/connections')) {
        calls.push(request.url())
      }
    })
    await page.goto('/settings/connections')
    await expect(
      page.getByRole('heading', { name: 'Sign in to continue.' }),
    ).toBeVisible()
    await expect(page.getByRole('radio')).toHaveCount(0)
    expect(calls).toEqual([])
    await expect(page).toHaveTitle('Connections — ORG')
  })

  test('a member page shows a guest no request button and asks nothing about one', async ({
    page,
  }) => {
    const calls: Array<string> = []
    page.on('request', (request) => {
      if (request.url().includes('/api/v1/me/connections')) {
        calls.push(request.url())
      }
    })
    await page.goto('/open-example')
    await expect(
      page.getByRole('heading', { name: 'Open Example', level: 1 }),
    ).toBeVisible()
    await expect(
      page.getByRole('button', { name: /connection request/i }),
    ).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Block…' })).toHaveCount(0)
    expect(calls).toEqual([])
  })
})
