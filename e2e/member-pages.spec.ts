import { expect, test } from '@playwright/test'

test.describe('member pages, server rendered for a logged-out visitor', () => {
  test('a public page has its content in the HTML itself', async ({
    request,
  }) => {
    const response = await request.get('/open-example')
    expect(response.status()).toBe(200)
    const html = await response.text()
    expect(html).toContain('Open Example')
    expect(html).toContain('A synthetic public biography.')
    expect(html).toContain('First synthetic belief.')
    expect(html).toContain('Second tab')
    expect(html).toContain('Imported, please review')
    expect(html).toContain('@open-example')
  })

  test('a members-only page sends the name and nothing more', async ({
    request,
  }) => {
    const response = await request.get('/members-example')
    expect(response.status()).toBe(200)
    const html = await response.text()
    expect(html).toContain('Members Example')
    expect(html).toContain('for members only')
    expect(html).not.toContain('synthetic')
  })

  test('a hidden or missing page is a real 404', async ({ request }) => {
    const response = await request.get('/no-such-member')
    expect(response.status()).toBe(404)
    expect(await response.text()).toContain('Page not found')
  })

  test('a malformed address never reaches the page route', async ({
    request,
  }) => {
    const response = await request.get('/not.a.member')
    expect(response.status()).toBe(404)
  })

  test('real pages of the site are not shadowed', async ({ request }) => {
    for (const path of ['/about', '/community', '/membership', '/beliefs']) {
      const response = await request.get(path)
      expect(response.status(), path).toBe(200)
      expect(await response.text(), path).not.toContain(
        'does not exist in the ORG archive',
      )
    }
  })

  test('tabs open, and a phone never scrolls sideways', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/open-example')
    await expect(page.getByText('First synthetic belief.')).toBeVisible()
    await expect(page.getByText(/Second synthetic belief/)).toBeHidden()

    await page.getByRole('button', { name: /Second tab/ }).click()
    await expect(page.getByText(/Second synthetic belief/)).toBeVisible()
    await expect(page.getByText('First synthetic belief.')).toBeHidden()

    const overflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    )
    expect(overflow).toBeLessThanOrEqual(0)
  })

  test('a guest reads a belief’s history and the bio history, and gets no editing', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/open-example')
    await expect(page.getByText('First synthetic belief.')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Edit belief' })).toHaveCount(
      0,
    )
    await expect(page.getByRole('button', { name: 'Edit bio' })).toHaveCount(0)

    await page.getByRole('button', { name: 'History', exact: true }).click()
    const belief = page.getByRole('region', { name: /History of “First tab”/ })
    await expect(belief.getByText('An older synthetic wording.')).toBeVisible()
    await expect(
      belief.getByText(
        'Imported from Apple Pages; originally written before Oct 11, 2026.',
      ),
    ).toBeVisible()
    await expect(belief.getByText('abcdef012345')).toBeVisible()
    await expect(belief.getByText('Nov 1, 2026, 12:30 PM UTC')).toBeVisible()

    await page.getByRole('button', { name: 'Bio history' }).click()
    const bio = page.getByRole('region', { name: 'History of the bio' })
    await expect(bio.getByText('0123456789ab')).toBeVisible()

    const overflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    )
    expect(overflow).toBeLessThanOrEqual(0)

    await belief.getByRole('button', { name: 'Close history' }).click()
    await expect(belief).toHaveCount(0)
  })

  test('a guest reads a belief’s comments and the page thread, and cannot write', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/open-example')
    await expect(page.getByText('4 comments')).toBeVisible()
    const thread = page.getByRole('region', { name: 'Comments' })
    await expect(
      thread.getByText('An imported synthetic comment.'),
    ).toBeVisible()
    await expect(thread.getByText('Synthetic Pages Author')).toBeVisible()
    await expect(
      thread.getByText(/Pages showed May 6, 2020, which is not proof/),
    ).toBeVisible()
    await expect(thread.getByText('“synthetic belief”')).toBeVisible()
    await expect(
      thread.getByText('Comment removed by its author.'),
    ).toBeVisible()
    await expect(
      thread.getByText(/Suggested rewording · Accepted by the page owner/),
    ).toBeVisible()
    await expect(thread.getByText('ORG admin')).toBeVisible()
    await expect(thread.getByRole('textbox')).toHaveCount(0)
    await expect(thread.getByRole('button', { name: /^Reply to/ })).toHaveCount(
      0,
    )
    await expect(
      thread.getByRole('button', { name: 'Suggest a rewording' }),
    ).toHaveCount(0)
    await expect(
      thread.getByText(/Members with an approved page/),
    ).toBeVisible()

    await thread.getByRole('button', { name: /^Edit history/ }).click()
    const history = thread.getByRole('region', {
      name: 'Edit history of this comment',
    })
    await expect(history.getByText('A synthetic reply.')).toBeVisible()
    await expect(history.getByText('2468ace01357')).toBeVisible()

    const about = page.getByRole('region', { name: 'About this page' })
    await expect(about.getByText('No comments yet.')).toBeVisible()

    const overflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    )
    expect(overflow).toBeLessThanOrEqual(0)
  })

  test('the community page lists members after a guest enters', async ({
    page,
  }) => {
    await page.goto('/community')
    await page.getByRole('button', { name: 'Guest' }).click()
    await expect(page.getByRole('link', { name: /Open Example/ })).toBeVisible()
    await expect(
      page.getByRole('link', { name: /Members Example.*Members only/s }),
    ).toBeVisible()
    await expect(
      page.getByRole('link', { name: 'Contact Tripp' }),
    ).toBeVisible()
    await expect(page.getByRole('link', { name: 'Membership' })).toBeVisible()
  })
})
