import { useEffect, useState } from 'react'
import { Link, useLocation } from '@tanstack/react-router'
import { X, Search, UserPlus } from 'lucide-react'
import { GRID_ORDER } from '#/lib/sections'
import aboutImg from '#/assets/about.webp'
import beliefsImg from '#/assets/beliefs.webp'
import communityImg from '#/assets/community.webp'
import donationsImg from '#/assets/gifts_donations.webp'
import futureImg from '#/assets/future_ideas.webp'
import homeRainbowImg from '#/assets/home_rainbow.jpeg'
import infrastructureImg from '#/assets/infrastructure.webp'
import legalImg from '#/assets/legal.webp'
import researchImg from '#/assets/research.webp'

const LABELS: Record<string, string> = {
  about: 'About',
  community: 'Community',
  beliefs: 'Beliefs',
  infrastructure: 'Infrastructure',
  home: 'ORG',
  research: 'Research',
  legal: 'Legal',
  future: 'Future',
  donations: 'GIFTS AND CONTRIBUTIONS',
}

const IMAGES: Record<string, string> = {
  about: aboutImg,
  community: communityImg,
  beliefs: beliefsImg,
  infrastructure: infrastructureImg,
  research: researchImg,
  legal: legalImg,
  future: futureImg,
  donations: donationsImg,
}

function NavSquare({
  item,
  active,
  compact,
  onNavigate,
}: {
  item: (typeof GRID_ORDER)[number]
  active: boolean
  compact?: boolean
  onNavigate?: () => void
}) {
  const isHome = item.id === 'home'
  const img = isHome ? homeRainbowImg : (IMAGES[item.id] ?? null)

  return (
    <div className="relative w-full">
      <Link
        to={item.href}
        onClick={onNavigate}
        title={item.label}
        aria-label={item.label}
        className="group block w-full no-underline transition-all duration-300"
      >
        <div
          className={`relative aspect-square w-full overflow-hidden transition-all duration-300 ${
            active
              ? 'border-solid border-[#ece2c4] bg-[#ece2c4]'
              : 'bg-[rgba(11,13,18,0.74)] hover:border-solid hover:border-[#d4a24a] hover:bg-[rgba(212,162,74,0.12)]'
          }`}
        >
          {img ? (
            <span
              aria-hidden
              className={`absolute inset-0 bg-cover bg-center ${isHome ? 'animate-[v2-rotate_28s_linear_infinite]' : ''} transition-opacity duration-300 ${active ? 'opacity-20' : 'opacity-20 group-hover:opacity-40'}`}
              style={{ backgroundImage: `url(${img})` }}
            />
          ) : null}
          <span
            aria-hidden
            className={`pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100 ${
              active ? 'opacity-0' : ''
            }`}
            style={{
              background:
                'linear-gradient(135deg, rgba(212,162,74,0.22), transparent 38%, rgba(120,174,162,0.12))',
            }}
          />

          <span
            className={`pointer-events-none absolute right-0 bottom-0 left-0 z-10 pb-1.5 text-center leading-none tracking-[0.04em] uppercase ${
              compact
                ? 'text-[10px] font-semibold'
                : 'text-[clamp(7px,calc(1vw-2px),11px)] font-bold'
            } ${active ? 'text-[#d4a24a]' : 'text-[#ece2c4] group-hover:text-[#f0e6d0]'}`}
            style={
              !active
                ? {
                    background:
                      'linear-gradient(to top, rgba(11,13,18,0.65) 0%, rgba(11,13,18,0.3) 55%, transparent 100%)',
                  }
                : undefined
            }
          >
            {LABELS[item.id] ?? item.label}
          </span>
        </div>
      </Link>

      {isHome ? (
        <>
          <Link
            to="/join"
            onClick={onNavigate}
            aria-label="Join the ORG or access member portal"
            title="Join or sign in as a member"
            className="absolute top-1 left-1 z-20 grid h-4 w-4 place-items-center border border-[rgba(236,226,196,0.35)] bg-[rgba(11,13,18,0.7)] text-[#d4a24a] transition-colors hover:border-[#d4a24a] hover:text-[#f0e6d0]"
          >
            <UserPlus size={10} />
          </Link>

          <button
            type="button"
            onClick={() => {
              onNavigate?.()
              window.dispatchEvent(new CustomEvent('org:open-search'))
            }}
            aria-label="Search the archive"
            title="Search the ORG archive (⌘K)"
            className="absolute top-1 right-1 z-20 grid h-4 w-4 place-items-center border border-[rgba(236,226,196,0.35)] bg-[rgba(11,13,18,0.7)] text-[#d4a24a] transition-colors hover:border-[#d4a24a] hover:text-[#f0e6d0]"
          >
            <Search size={10} />
          </button>
        </>
      ) : null}
    </div>
  )
}

export function SiteNav() {
  const location = useLocation()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    setOpen(false)
  }, [location.pathname])

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-50 bg-[rgba(11,13,18,0.78)] backdrop-blur-md">
        <div className="mx-auto hidden max-w-[1180px] px-[clamp(14px,3vw,32px)] py-4 md:block relative">
          <nav aria-label="Primary" className="relative grid grid-cols-9 gap-0">
            {/* Grid-level larger perforation lines matching the home page blotter sheet: 6px thick, sparse dashes (d=25px, g=20px) at every tab division + outer frame. */}
            {(() => {
              const perfColor = 'rgba(236,226,196,0.85)'
              const d = '25px'
              const g = '20px'
              const t = '6px'
              const vGrad = `repeating-linear-gradient(to bottom, ${perfColor} 0, ${perfColor} ${d}, transparent ${d}, transparent calc(${d} + ${g}))`
              const hGrad = `repeating-linear-gradient(to right, ${perfColor} 0, ${perfColor} ${d}, transparent ${d}, transparent calc(${d} + ${g}))`
              const numTabs = 9
              const step = 100 / numTabs
              const vPositions = Array.from({ length: numTabs + 1 }, (_, k) => `${(k * step).toFixed(3)}%`)
              const hPositions = ['0%', '100%']
              const vBgImages = vPositions.map(() => vGrad).join(',')
              const vBgSizes = vPositions.map(() => `${t} 100%`).join(',')
              const vBgPositions = vPositions.map((p) => `${p} 0%`).join(',')
              const vBgRepeats = vPositions.map(() => 'no-repeat').join(',')
              const hBgImages = hPositions.map(() => hGrad).join(',')
              const hBgSizes = hPositions.map(() => `100% ${t}`).join(',')
              const hBgPositions = hPositions.map((p) => `0% ${p}`).join(',')
              const hBgRepeats = hPositions.map(() => 'no-repeat').join(',')
              return (
                <>
                  <div
                    aria-hidden
                    className="absolute inset-0 pointer-events-none z-[5]"
                    style={{
                      backgroundImage: vBgImages,
                      backgroundSize: vBgSizes,
                      backgroundPosition: vBgPositions,
                      backgroundRepeat: vBgRepeats,
                    }}
                  />
                  <div
                    aria-hidden
                    className="absolute inset-0 pointer-events-none z-[6]"
                    style={{
                      backgroundImage: hBgImages,
                      backgroundSize: hBgSizes,
                      backgroundPosition: hBgPositions,
                      backgroundRepeat: hBgRepeats,
                    }}
                  />
                </>
              )
            })()}
            {GRID_ORDER.map((item) => (
              <NavSquare
                key={item.id}
                item={item}
                active={
                  item.href === '/'
                    ? location.pathname === '/'
                    : location.pathname === item.href ||
                      location.pathname.startsWith(`${item.href}/`)
                }
              />
            ))}
          </nav>
        </div>

        <div className="flex h-16 items-center justify-between px-4 md:hidden">
          <Link
            to="/"
            className="inline-flex items-center text-[11px] uppercase tracking-[0.34em] text-[#ece2c4] no-underline"
            aria-label="ORG home"
          >
            ORG
          </Link>

          <button
            type="button"
            aria-label={open ? 'Close navigation' : 'Open navigation'}
            aria-expanded={open}
            onClick={() => setOpen((value) => !value)}
            className="grid h-10 w-10 place-items-center bg-[rgba(11,13,18,0.86)] text-[#ece2c4]"
          >
            {open ? (
              <X size={18} />
            ) : (
              <span
                aria-hidden
                className="h-full w-full bg-cover bg-center animate-[v2-rotate_28s_linear_infinite]"
                style={{ backgroundImage: `url(${homeRainbowImg})` }}
              />
            )}
          </button>
        </div>
      </header>

      {open ? (
        <div className="fixed inset-0 z-40 bg-[rgba(11,13,18,0.94)] px-4 pb-8 pt-24 backdrop-blur-md md:hidden">
          <nav aria-label="Primary mobile" className="relative mx-auto max-w-[420px] grid grid-cols-3 gap-0">
            {/* Matching larger perforation overlay for mobile 3-col menu (6px thick, d=25px, g=20px, separate v/h to avoid overlap). */}
            {(() => {
              const perfColor = 'rgba(236,226,196,0.85)'
              const d = '25px'
              const g = '20px'
              const t = '6px'
              const vGrad = `repeating-linear-gradient(to bottom, ${perfColor} 0, ${perfColor} ${d}, transparent ${d}, transparent calc(${d} + ${g}))`
              const hGrad = `repeating-linear-gradient(to right, ${perfColor} 0, ${perfColor} ${d}, transparent ${d}, transparent calc(${d} + ${g}))`
              // For 3x3 grid (3 cols, 3 rows): 4 vertical + 4 horizontal perf lines
              // Separate elements to prevent color overlap at line crossings
              const positions = Array.from({ length: 4 }, (_, k) => `${(k * 100 / 3).toFixed(3)}%`)
              const vBgImages = positions.map(() => vGrad).join(',')
              const vBgSizes = positions.map(() => `${t} 100%`).join(',')
              const vBgPositions = positions.map((p) => `${p} 0%`).join(',')
              const vBgRepeats = positions.map(() => 'no-repeat').join(',')
              const hBgImages = positions.map(() => hGrad).join(',')
              const hBgSizes = positions.map(() => `100% ${t}`).join(',')
              const hBgPositions = positions.map((p) => `0% ${p}`).join(',')
              const hBgRepeats = positions.map(() => 'no-repeat').join(',')
              return (
                <>
                  <div
                    aria-hidden
                    className="absolute inset-0 pointer-events-none z-[5]"
                    style={{
                      backgroundImage: vBgImages,
                      backgroundSize: vBgSizes,
                      backgroundPosition: vBgPositions,
                      backgroundRepeat: vBgRepeats,
                    }}
                  />
                  <div
                    aria-hidden
                    className="absolute inset-0 pointer-events-none z-[6]"
                    style={{
                      backgroundImage: hBgImages,
                      backgroundSize: hBgSizes,
                      backgroundPosition: hBgPositions,
                      backgroundRepeat: hBgRepeats,
                    }}
                  />
                </>
              )
            })()}
            {GRID_ORDER.map((item) => (
              <NavSquare
                key={item.id}
                item={item}
                active={
                  item.href === '/'
                    ? location.pathname === '/'
                    : location.pathname === item.href ||
                      location.pathname.startsWith(`${item.href}/`)
                }
                compact
                onNavigate={() => setOpen(false)}
              />
            ))}
          </nav>
        </div>
      ) : null}
    </>
  )
}
