import { Link } from '@tanstack/react-router'
import { SECTIONS } from '#/lib/sections'

/** Every ORG reference page, for members finding their way around. */
const PAGES = [
  ...SECTIONS.map(({ label, href }) => ({ label, href })),
  { label: 'Gifts & Contributions', href: '/gifts-contributions' },
  { label: 'Membership', href: '/membership' },
]

export function ReferenceLinks() {
  return (
    <nav
      aria-label="ORG reference pages"
      className="mt-12 border-t border-[rgba(236,226,196,0.16)] pt-6"
    >
      <h2 className="font-mono text-[10px] uppercase tracking-[0.28em] text-[#9f9676]">
        ORG reference pages
      </h2>
      <ul className="mt-4 flex flex-wrap gap-x-6 gap-y-3 text-sm">
        {PAGES.map((page) => (
          <li key={page.href}>
            <Link
              to={page.href}
              className="text-[#f1d78a] underline underline-offset-4"
            >
              {page.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}
