import { expect, test } from '@playwright/test'

test.describe('public website', () => {
  test('navigates the archive and opens a highlighted search result', async ({
    page,
  }) => {
    const pageErrors: string[] = []
    page.on('pageerror', (error) => pageErrors.push(error.message))

    await page.goto('/')
    await expect(
      page.getByRole('link', { name: 'Members Community', exact: true }),
    ).toBeVisible()
    await page
      .getByRole('link', { name: 'Members Community', exact: true })
      .first()
      .click()
    await expect(page).toHaveURL(/\/community$/)
    await expect(
      page.getByRole('heading', { level: 1, name: 'Members Community' }),
    ).toBeVisible()

    await page
      .locator('button[aria-label="Search the archive"]:visible')
      .click()
    const search = page.getByRole('dialog', {
      name: 'Search the ORG archive',
    })
    await expect(search).toBeVisible()
    await search.getByRole('textbox').fill('community')
    await expect(search.getByRole('option').first()).toBeVisible()
    await search.getByRole('option').first().click()

    await expect(page).toHaveURL(/q=community/)
    await expect(page.getByText(/SEARCHING “community”/i)).toBeVisible()
    expect(pageErrors).toEqual([])
  })

  test('renders every published public document', async ({ page }) => {
    const pages = [
      ['/about', 'About Us'],
      ['/community', 'Community'],
      ['/beliefs', 'Beliefs'],
      ['/infrastructure', 'Infrastructure'],
      ['/research', 'Research'],
      ['/legal', 'Legal'],
      ['/future-ideas', 'Future Ideas'],
      ['/gifts-contributions', 'Offerings'],
    ] as const

    for (const [path, title] of pages) {
      const response = await page.goto(path)
      expect(
        response?.ok(),
        `${path} should return a successful response`,
      ).toBe(true)
      await expect(
        page.getByRole('heading', { level: 1, name: title }),
      ).toBeVisible()
    }
  })

  test('supports search and navigation on a mobile viewport', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/about')

    await page.getByRole('button', { name: 'Open navigation' }).click()
    let mobileNav = page.getByRole('navigation', { name: 'Primary mobile' })
    await mobileNav.getByRole('button', { name: 'Search the archive' }).click()
    await expect(
      page.getByRole('dialog', { name: 'Search the ORG archive' }),
    ).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(
      page.getByRole('dialog', { name: 'Search the ORG archive' }),
    ).toBeHidden()

    await page.getByRole('button', { name: 'Open navigation' }).click()
    mobileNav = page.getByRole('navigation', { name: 'Primary mobile' })
    await expect(mobileNav).toBeVisible()
    await mobileNav.getByRole('link', { name: 'Beliefs', exact: true }).click()
    await expect(page).toHaveURL(/\/beliefs$/)
    await expect(
      page.getByRole('heading', { level: 1, name: 'Beliefs' }),
    ).toBeVisible()
  })
})

test('server functions keep their cross-site request protection', async ({
  request,
}) => {
  const response = await request.get('/_serverFn/nope')
  expect(response.status()).toBe(403)
})

test('other sites cannot frame a server-rendered page', async ({ request }) => {
  const response = await request.get('/about')
  expect(response.headers()['x-frame-options']).toBe('DENY')
  expect(response.headers()['content-security-policy']).toBe(
    "frame-ancestors 'none'",
  )
})
