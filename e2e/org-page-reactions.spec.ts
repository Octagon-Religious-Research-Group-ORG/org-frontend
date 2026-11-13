import { expect, test } from '@playwright/test'

// Chunk 10b, as a logged-out visitor sees it. Synthetic data only
// (e2e/fake-members-api.mjs).
test.describe('reactions on ORG’s own pages, for a guest', () => {
  test('a page shows its counts, the five buttons off with the reason, and its thread', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/research')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    const section = page.getByRole('region', {
      name: 'Your response to this page',
    })
    await expect(section.getByText('2 agree · 1 disagree')).toBeVisible()
    await expect(
      section.getByText('(1 vote on an earlier version)'),
    ).toBeVisible()
    for (const name of [
      'Agree with',
      'Disagree with',
      'Agree and comment on',
      'Disagree and comment on',
      'Comment without a vote on',
    ]) {
      await expect(
        section.getByRole('button', { name: new RegExp(`^${name} “`) }),
      ).toBeDisabled()
    }
    await expect(section.getByText(/can vote\. Sign in/)).toBeVisible()
    await expect(
      section.getByText('A synthetic comment on an ORG page.'),
    ).toBeVisible()
    await expect(section.getByText('Agrees', { exact: true })).toBeVisible()
    await expect(
      section.getByRole('button', { name: 'Suggest a rewording' }),
    ).toHaveCount(0)

    const overflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    )
    expect(overflow).toBeLessThanOrEqual(0)
  })

  test('a page the server does not answer for shows no reactions', async ({
    page,
  }) => {
    await page.goto('/legal')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    // Give the browser read time to come back as "not found".
    await page.waitForLoadState('networkidle')
    await expect(
      page.getByRole('region', { name: 'Your response to this page' }),
    ).toHaveCount(0)
  })
})
