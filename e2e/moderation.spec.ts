import { expect, test } from '@playwright/test'

// Chunk 13 (reports and moderation), as a logged-out visitor sees it.
// Synthetic data only (e2e/fake-members-api.mjs). Signed-in reporting and the
// admin queue need a real Clerk session, which this suite does not have.
test.describe('moderation, for a guest', () => {
  test('a hidden comment keeps its place as a note, with no text and no badge', async ({
    page,
  }) => {
    await page.goto('/research')
    const section = page.getByRole('region', {
      name: 'Your response to this page',
    })
    await expect(
      section.getByText('A synthetic comment on an ORG page.'),
    ).toBeVisible()
    await expect(section.getByText('Hidden by a moderator.')).toBeVisible()
    // One badge only: the visible comment's.
    await expect(section.getByText('Agrees', { exact: true })).toHaveCount(1)
  })

  test('a guest is offered no "Report" anywhere, and sends no report', async ({
    page,
  }) => {
    const reportCalls: Array<string> = []
    page.on('request', (request) => {
      if (/\/api\/v1\/(me\/reports|admin\/moderation)/.test(request.url())) {
        reportCalls.push(request.url())
      }
    })
    await page.goto('/research')
    await expect(page.getByText('Hidden by a moderator.')).toBeVisible()
    await expect(page.getByRole('button', { name: /^Report/ })).toHaveCount(0)

    await page.goto('/open-example')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await page.waitForLoadState('networkidle')
    await expect(page.getByRole('button', { name: /^Report/ })).toHaveCount(0)

    await page.goto('/admin')
    await expect(
      page.getByRole('heading', { name: 'Sign in to continue.' }),
    ).toBeVisible()
    await expect(page.getByText('Moderation queue')).toHaveCount(0)
    expect(reportCalls).toEqual([])
  })
})
