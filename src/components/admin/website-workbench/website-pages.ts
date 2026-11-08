import type { WebsitePageId } from '#/lib/content-types'

export interface WebsitePageLedgerEntry {
  id: WebsitePageId
  label: string
  href: string
}

export const WEBSITE_PAGE_LEDGER: ReadonlyArray<WebsitePageLedgerEntry> = [
  { id: 'about', label: 'About Us', href: '/about' },
  { id: 'community', label: 'Members Community', href: '/community' },
  { id: 'beliefs', label: 'Beliefs', href: '/beliefs' },
  { id: 'infrastructure', label: 'Infrastructure', href: '/infrastructure' },
  { id: 'research', label: 'Research', href: '/research' },
  { id: 'legal', label: 'Legal', href: '/legal' },
  { id: 'future', label: 'Future Ideas', href: '/future-ideas' },
  {
    id: 'donations',
    label: 'Gifts & Contributions',
    href: '/gifts-contributions',
  },
  { id: 'membership', label: 'Membership', href: '/membership' },
]

export function getWebsitePageHref(pageId: WebsitePageId) {
  return WEBSITE_PAGE_LEDGER.find((entry) => entry.id === pageId)?.href
}
