import { useEffect, useState } from 'react'
import { Link, useLocation } from '@tanstack/react-router'
import { X, Search, UserPlus } from 'lucide-react'
import { BlotterPerforations } from '#/components/BlotterPerforations'
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
            {/* Blotter-sheet perforations, same as the home page sheet. */}
            <BlotterPerforations cols={9} rows={1} tabsPerCell={3} seamWidth={2} />
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
            {/* Blotter-sheet perforations for the mobile 3x3 menu. */}
            <BlotterPerforations cols={3} rows={3} tabsPerCell={3} />
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
