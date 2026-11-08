import { describe, expect, it } from 'vitest'
import { getWebsitePageHref, WEBSITE_PAGE_LEDGER } from './website-pages'

describe('website page ledger', () => {
  it('lets the Membership guide be edited in the workbench', () => {
    expect(getWebsitePageHref('membership')).toBe('/membership')
  })

  it('uses the Members Community name, keeping the page id', () => {
    expect(
      WEBSITE_PAGE_LEDGER.find((entry) => entry.id === 'community')?.label,
    ).toBe('Members Community')
  })

  it('maps every managed page to a unique public URL', () => {
    expect(WEBSITE_PAGE_LEDGER).toHaveLength(9)
    expect(new Set(WEBSITE_PAGE_LEDGER.map((entry) => entry.href)).size).toBe(9)
    for (const entry of WEBSITE_PAGE_LEDGER) {
      expect(getWebsitePageHref(entry.id)).toBe(entry.href)
    }
  })
})
