import { useLayoutEffect, useRef } from 'react'

/** Read by the fixed header; unset, and so 0, on the live site. */
export const BANNER_HEIGHT_VAR = '--test-banner-height'

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
  return <Banner />
}

/**
 * The site's header is fixed to the top of the window, so it has to know how
 * tall this strip is to sit below it. Measured because the text wraps on a
 * phone.
 */
function Banner() {
  const strip = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const root = document.documentElement
    const measure = () =>
      root.style.setProperty(
        BANNER_HEIGHT_VAR,
        `${strip.current!.offsetHeight}px`,
      )
    measure()
    window.addEventListener('resize', measure)
    return () => {
      window.removeEventListener('resize', measure)
      root.style.removeProperty(BANNER_HEIGHT_VAR)
    }
  }, [])

  return (
    <div
      ref={strip}
      role="note"
      aria-label="Test site notice"
      className="sticky top-0 z-[60] bg-[#e8b34b] px-4 py-2 text-center font-mono text-[11px] uppercase tracking-[0.16em] text-[#0b0d12]"
    >
      Test site · accounts and data may be wiped · no real payments or orders
    </div>
  )
}
