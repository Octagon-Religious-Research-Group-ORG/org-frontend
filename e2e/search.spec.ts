import { expect, test } from '@playwright/test'

// Search (Chunk 15) as a signed-out visitor, against the fake API in
// e2e/fake-members-api.mjs, which answers a request carrying a token with a
// members-only result: if a guest page ever sent one, these tests would see it.

test.describe('search for a guest', () => {
  test('pages, filters and never shows members-only results', async ({
    page,
  }) => {
    const pageErrors: Array<string> = []
    page.on('pageerror', (error) => pageErrors.push(error.message))
    const sentTokens: Array<string> = []
    page.on('request', (request) => {
      if (request.url().includes('/api/v1/search')) {
        const header = request.headers()['authorization']
        if (header) sentTokens.push(header)
      }
    })

    await page.goto('/search?q=example')
    await expect(
      page.getByRole('heading', { level: 1, name: 'The Perforated Index' }),
    ).toBeVisible()
    await expect(page.getByText('12 results')).toBeVisible()
    await expect(page.getByText('MEMBER · NAME ONLY')).toBeVisible()
    await expect(
      page.getByText(/members-only pages are not searched/),
    ).toBeVisible()
    await expect(page.getByText('MEMBERS-ONLY SECRET')).toHaveCount(0)

    await page.getByRole('button', { name: 'Next' }).click()
    await expect(page).toHaveURL(/page=2/)
    await expect(page.getByText('Page 2 of 2')).toBeVisible()
    await expect(
      page.getByRole('list', { name: 'Search results' }).getByRole('listitem'),
    ).toHaveCount(2)

    await page.getByRole('button', { name: 'Members', exact: true }).click()
    await expect(page).toHaveURL(/type=members/)
    await expect(page.getByText('2 results')).toBeVisible()

    const box = page.getByRole('searchbox', { name: 'Search the archive' })
    await box.fill('nothing here')
    await box.press('Enter')
    await expect(page.getByText(/No matches in the records/)).toBeVisible()

    expect(sentTokens).toEqual([])
    expect(pageErrors).toEqual([])
  })

  test('the Perforated Index suggests frequent searches and opens all results', async ({
    page,
  }) => {
    await page.goto('/about')
    await page
      .locator('button[aria-label="Search the archive"]:visible')
      .click()
    const search = page.getByRole('dialog', { name: 'Search the ORG archive' })
    await expect(
      search.getByRole('button', { name: 'first tab' }),
    ).toBeVisible()
    await search.getByLabel('What vision do you seek?').fill('example')
    await expect(search.getByRole('option')).toHaveCount(10)
    await expect(search.getByText('MEMBERS-ONLY SECRET')).toHaveCount(0)
    await search.getByRole('button', { name: 'See all 12 results' }).click()
    await expect(page).toHaveURL(/\/search\?q=example/)
    await expect(page.getByText('12 results')).toBeVisible()
  })
})
