import { expect, test } from '@playwright/test'

// Chunk 10, as a logged-out visitor sees it. Synthetic data only
// (e2e/fake-members-api.mjs).
test.describe('belief votes, for a guest', () => {
  test('the Beliefs page keeps its own text and lists the agreed beliefs, with the buttons off', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/beliefs')
    // The CMS page itself is still there, above the new section.
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    const section = page.getByRole('region', {
      name: "Members' beliefs agreed by 2 or more members",
    })
    const entry = section.getByRole('article', { name: 'First tab' })
    await expect(entry.getByText('First synthetic belief.')).toBeVisible()
    await expect(entry.getByText('3 agree · 1 disagree')).toBeVisible()
    await expect(
      entry.getByText('(2 votes on an earlier wording)'),
    ).toBeVisible()
    await expect(
      entry.getByRole('link', { name: 'Open Example', exact: true }),
    ).toHaveAttribute('href', '/open-example')
    await expect(
      entry.getByRole('link', {
        name: 'Open this belief on Open Example’s page',
      }),
    ).toHaveAttribute('href', '/open-example#belief-t1')
    for (const name of [
      'Agree with “First tab”',
      'Disagree with “First tab”',
      'Agree and comment on “First tab”',
      'Disagree and comment on “First tab”',
      'Comment without a vote on “First tab”',
    ]) {
      await expect(
        entry.getByRole('button', { name, exact: true }),
      ).toBeDisabled()
    }
    await expect(
      entry.getByRole('button', {
        name: 'Agree with “First tab”',
        exact: true,
      }),
    ).toHaveAttribute('aria-pressed', 'false')
    await expect(entry.getByText(/can vote\. Sign in/)).toBeVisible()

    const overflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    )
    expect(overflow).toBeLessThanOrEqual(0)

    await entry
      .getByRole('link', { name: 'Open this belief on Open Example’s page' })
      .click()
    await expect(page).toHaveURL(/\/open-example#belief-t1$/)
    const votes = page.getByRole('group', { name: 'Votes on “First tab”' })
    await expect(votes.getByText('3 agree · 1 disagree')).toBeVisible()
    await expect(
      votes.getByRole('button', {
        name: 'Agree with “First tab”',
        exact: true,
      }),
    ).toBeDisabled()
  })
})
