/**
 * A strip across the top of every page on the TEST site, so nobody mistakes
 * it for the real ORG website. Shown only when the build sets
 * `VITE_SITE_ENV=test`; the live site never renders it.
 */
export function TestSiteBanner({
  siteEnv = import.meta.env.VITE_SITE_ENV,
}: {
  siteEnv?: string
}) {
  if (siteEnv !== 'test') return null

  return (
    <div
      role="note"
      aria-label="Test site notice"
      className="bg-[#e8b34b] px-4 py-2 text-center font-mono text-[11px] uppercase tracking-[0.16em] text-[#0b0d12]"
    >
      Test site · accounts and data may be wiped · no real payments or orders
    </div>
  )
}
