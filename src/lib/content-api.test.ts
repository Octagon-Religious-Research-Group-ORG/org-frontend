import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  DEFAULT_WEBSITE_PAGES,
  blocksForThisSite,
  getDefaultWebsiteContent,
} from './content-defaults'
import {
  discardAdminDraft,
  loadAdminPage,
  loadPublishedPage,
  loadPublishedPages,
  publishAdminDraft,
  restoreAdminRevision,
  saveAdminDraft,
} from './content-api'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('website content API fallbacks', () => {
  it('uses bundled content when a public content request is unavailable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))

    const page = await loadPublishedPage('community')

    expect(page.revision).toBe(1)
    expect(page.content).toEqual(getDefaultWebsiteContent('community'))
  })

  it('keeps real payment handles out of the fallback only on the test site', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    const handles = ['$trippaardema', '@trippaardema', '@the_org']

    const live = JSON.stringify(await loadPublishedPage('donations'))
    for (const handle of handles) expect(live).toContain(handle)

    vi.stubEnv('VITE_SITE_ENV', 'test')
    vi.resetModules()
    const onTest = await import('./content-api')
    const shown = JSON.stringify(await onTest.loadPublishedPage('donations'))
    vi.unstubAllEnvs()

    for (const handle of handles) expect(shown).not.toContain(handle)
    expect(shown).toContain('(test site: no real payment)')
  })

  it('cleans the bundled copy on the test site without damaging prices', () => {
    const shown = (pageId: string, text: string, siteEnv = 'test') =>
      blocksForThisSite(
        pageId,
        [{ id: 'b', kind: 'paragraph', text }],
        siteEnv,
      )[0].text
    const placeholder = '(test site: no real payment)'

    expect(shown('donations', '$60/g')).toBe('$60/g')
    expect(shown('donations', '(@someone)')).toBe(`(${placeholder})`)
    expect(shown('donations', 'me@example.org')).toBe('me@example.org')
    expect(shown('community', 'Telegram @someone')).toBe('Telegram @someone')
    expect(shown('community', 'Tip @the_org')).toBe(`Tip ${placeholder}`)
    expect(shown('community', 'paypal.me/x')).toBe(placeholder)
    expect(shown('community', 'paypal.message')).toBe('paypal.message')
    expect(shown('community', 'me@paypal.com')).toBe('me@paypal.com')
    expect(shown('community', 'Tip $TrippAardema')).toBe(`Tip ${placeholder}`)
    expect(shown('community', 'venmo.me/x')).toBe(placeholder)
    expect(shown('community', 'cash.me/x')).toBe(placeholder)
    expect(shown('donations', '@someone', 'production')).toBe('@someone')
  })

  it('returns a successfully published page without replacing it', async () => {
    const published = {
      pageId: 'community',
      revision: 7,
      content: getDefaultWebsiteContent('community'),
      publishedAt: '2026-07-23T00:00:00.000Z',
    }
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(JSON.stringify(published))),
    )

    await expect(loadPublishedPage('community')).resolves.toEqual(published)
  })

  it('fills missing pages while preserving pages returned by the API', async () => {
    const about = {
      pageId: 'about',
      revision: 9,
      content: getDefaultWebsiteContent('about'),
      publishedAt: '2026-07-23T00:00:00.000Z',
    }
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(JSON.stringify([about]))),
    )

    const pages = await loadPublishedPages()

    expect(pages).toHaveLength(Object.keys(DEFAULT_WEBSITE_PAGES).length)
    expect(pages.find((page) => page.pageId === 'about')).toEqual(about)
    expect(pages.find((page) => page.pageId === 'community')).toMatchObject({
      revision: 1,
      publishedAt: new Date(0).toISOString(),
    })
  })

  it('fills every page when the page-list request fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))

    const pages = await loadPublishedPages()

    expect(pages.map((page) => page.pageId)).toEqual(
      Object.keys(DEFAULT_WEBSITE_PAGES),
    )
    expect(pages.every((page) => page.revision === 1)).toBe(true)
  })

  it('never converts an admin save failure into a successful fallback', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))

    await expect(
      saveAdminDraft(
        'community',
        'access-token',
        null,
        getDefaultWebsiteContent('community'),
      ),
    ).rejects.toThrow('offline')
  })

  it('sends every admin content operation to its exact endpoint', async () => {
    const fetchMock = vi
      .fn()
      .mockImplementation(() =>
        Promise.resolve(new Response(JSON.stringify({ pageId: 'community' }))),
      )
    vi.stubGlobal('fetch', fetchMock)
    const content = getDefaultWebsiteContent('community')

    await loadAdminPage('community', 'token')
    await saveAdminDraft('community', 'token', null, content)
    await publishAdminDraft('community', 'token', 3)
    await discardAdminDraft('community', 'token', 4)
    await restoreAdminRevision('community', 2, 'token', null)

    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      expect.stringContaining('/admin/content/pages/community'),
      expect.stringContaining('/admin/content/pages/community/draft'),
      expect.stringContaining('/admin/content/pages/community/publish'),
      expect.stringContaining('/admin/content/pages/community/discard-draft'),
      expect.stringContaining(
        '/admin/content/pages/community/revisions/2/restore',
      ),
    ])
    expect(fetchMock.mock.calls.slice(1).map(([, options]) => options)).toEqual(
      [
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify({ expectedDraftRevision: null, content }),
        }),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ expectedDraftRevision: 3 }),
        }),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ expectedDraftRevision: 4 }),
        }),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ expectedDraftRevision: null }),
        }),
      ],
    )
  })
})
