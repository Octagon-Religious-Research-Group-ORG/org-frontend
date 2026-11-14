import { expect, test } from '@playwright/test'

// Chunk 14 (email notifications), as a visitor who is not signed in sees it.
// Synthetic data only (e2e/fake-members-api.mjs). The signed-in settings page
// needs a real Clerk session, which this suite does not have.
const GOOD = 'v1.dXNlcl9ndWVzdA.digest.c3ludGhldGlj'
const FORGED = 'v1.dXNlcl9ndWVzdA.digest.Zm9yZ2Vk'

test.describe('email notifications, for a guest', () => {
  test('the settings page asks for a sign-in and reads nothing', async ({
    page,
  }) => {
    const calls: Array<string> = []
    page.on('request', (request) => {
      if (request.url().includes('/api/v1/me/notification-settings')) {
        calls.push(request.url())
      }
    })
    await page.goto('/settings/notifications')
    await expect(
      page.getByRole('heading', { name: 'Sign in to continue.' }),
    ).toBeVisible()
    await expect(page.getByRole('checkbox')).toHaveCount(0)
    expect(calls).toEqual([])
  })

  test('an email link turns emails off without a sign-in, only on the button', async ({
    page,
  }) => {
    const posts: Array<{ auth?: string; body: string | null }> = []
    page.on('request', (request) => {
      if (request.url().includes('/api/v1/notifications/unsubscribe')) {
        posts.push({
          auth: request.headers().authorization,
          body: request.postData(),
        })
      }
    })
    await page.goto(`/unsubscribe?token=${GOOD}`)
    await expect(
      page.getByText('Turn off the daily summary email?'),
    ).toBeVisible()
    // Opening the page sends nothing: a mail scanner changes nothing.
    await page.waitForLoadState('networkidle')
    expect(posts).toEqual([])
    await page.getByRole('button', { name: 'Turn these emails off' }).click()
    await expect(page.getByRole('status')).toHaveText(
      'Done. Those emails are turned off.',
    )
    expect(posts).toEqual([
      { auth: undefined, body: JSON.stringify({ token: GOOD }) },
    ])
  })

  test('a link the server does not accept says so, and changes nothing', async ({
    page,
  }) => {
    await page.goto(`/unsubscribe?token=${FORGED}`)
    await page.getByRole('button', { name: 'Turn these emails off' }).click()
    await expect(page.getByRole('alert')).toHaveText(
      'This link is not valid. You can change your email settings after signing in.',
    )
    await expect(page.getByRole('status')).toHaveCount(0)
  })

  test('a page opened without a usable link offers no button, only the settings link', async ({
    page,
  }) => {
    await page.goto('/unsubscribe')
    await expect(page.getByRole('alert')).toContainText(
      'This page needs the link from an ORG email.',
    )
    await expect(page.getByRole('button', { name: /Turn/ })).toHaveCount(0)
    await page.goto('/unsubscribe?token=v1.x.everything.sig')
    await expect(page.getByRole('button', { name: /Turn/ })).toHaveCount(0)
    await page
      .getByRole('link', { name: 'Manage all your email settings' })
      .click()
    await expect(page).toHaveURL(/\/settings\/notifications$/)
    await expect(
      page.getByRole('heading', { name: 'Sign in to continue.' }),
    ).toBeVisible()
  })
})
