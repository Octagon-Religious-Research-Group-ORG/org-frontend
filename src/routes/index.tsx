import { Link, createFileRoute } from '@tanstack/react-router'
import type { SECTIONS } from '#/lib/sections'
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
import { svgCoord } from '#/lib/svg'
import { BlotterPerforations, TabPerforations } from '#/components/BlotterPerforations'
import { UserPlus, Search } from 'lucide-react'

export const Route = createFileRoute('/')({ component: SacredGeometry })

function octagonPoints(cx: number, cy: number, r: number) {
  const pts: Array<string> = []
  for (let i = 0; i < 8; i++) {
    const angle = (Math.PI / 4) * i - Math.PI / 8
    const x = cx + Math.cos(angle) * r
    const y = cy + Math.sin(angle) * r
    pts.push(`${x.toFixed(2)},${y.toFixed(2)}`)
  }
  return pts.join(' ')
}

const NOISE_URL =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='240' height='240'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='1.8' numOctaves='2' seed='3'/></filter><rect width='100%' height='100%' filter='url(%23n)' opacity='0.7'/></svg>\")"

const VIGNETTE_BG =
  'radial-gradient(60% 50% at 50% 52%, rgba(212,162,74,0.07), transparent 60%), radial-gradient(80% 70% at 50% 50%, rgba(236,226,196,0.04), transparent 65%)'

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

const cellWrapper =
  'group relative z-[1] block w-full h-full no-underline text-[#ece2c4] opacity-0 scale-[0.92] animate-[v2-pop_900ms_cubic-bezier(0.2,0.8,0.2,1)_forwards]'

/** Caption BELOW the art, outside it (Tripp, 2026-10-05): text on the image had contrast problems. */
const tileLabel =
  'block text-center leading-none tracking-[0.04em] uppercase pt-[8px] pb-[10px] pointer-events-none text-[clamp(7px,calc(1.8vw-4px),24px)] font-bold text-[#ece2c4] group-hover:text-[#d4a24a]'

const perforatedSquare =
  'aspect-square w-full overflow-hidden transition-all duration-300'

function SacredGeometry() {
  const cx = 500
  const cy = 500

  function openSearch() {
    window.dispatchEvent(new CustomEvent('org:open-search'))
  }

  return (
    <div className="relative min-h-screen w-full overflow-x-hidden bg-[#0b0d12] text-[#ece2c4]">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ background: VIGNETTE_BG }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.08] mix-blend-overlay"
        style={{ backgroundImage: NOISE_URL }}
      />

      <svg
        viewBox="0 0 1000 1000"
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 h-[min(95vmin,1100px)] w-[min(95vmin,1100px)] -translate-x-1/2 -translate-y-1/2"
      >
        <g>
          {[480, 420, 360, 300, 240, 180, 120, 60].map((r, i) => (
            <polygon
              key={r}
              points={octagonPoints(cx, cy, r)}
              fill="none"
              stroke="rgba(232,224,206,0.18)"
              strokeWidth={i === 0 ? 0.8 : 0.4}
              style={{
                strokeDasharray: 2400,
                strokeDashoffset: 2400,
                animation: `v2-draw 1800ms cubic-bezier(0.6,0,0.3,1) forwards`,
                animationDelay: `${i * 110}ms`,
              }}
            />
          ))}
        </g>
        <g>
          {Array.from({ length: 16 }).map((_, i) => {
            const a = (Math.PI / 8) * i - Math.PI / 16
            const x2 = svgCoord(cx + Math.cos(a) * 480)
            const y2 = svgCoord(cy + Math.sin(a) * 480)
            return (
              <line
                key={i}
                x1={cx}
                y1={cy}
                x2={x2}
                y2={y2}
                stroke="rgba(232,224,206,0.08)"
                strokeWidth={0.5}
                style={{
                  strokeDasharray: 600,
                  strokeDashoffset: 600,
                  animation: `v2-draw 1400ms ease-out forwards`,
                  animationDelay: `${1100 + i * 35}ms`,
                }}
              />
            )
          })}
        </g>
      </svg>

      <main className="relative z-[3] flex min-h-screen items-center justify-center px-[clamp(12px,4vw,56px)] py-[clamp(16px,4vw,28px)]">
        <div className="relative grid w-full max-w-[min(1400px,calc(100vh-60px))] grid-cols-3 gap-0">
          {/* Blotter-sheet perforations: fine tab grid across every tile + tear lines between tiles. */}
          <BlotterPerforations cols={3} rows={3} fine={false} />

          {GRID_ORDER.map((entry, i) => {
            const isCenter = entry.id === 'home'
            const order = [0, 1, 2, 5, 8, 7, 6, 3].indexOf(i)
            const delay = isCenter
              ? 2500
              : 1600 + (order >= 0 ? order : 0) * 110

            if (isCenter) {
              return (
                <div
                  key={entry.id}
                  className={cellWrapper}
                  style={{ animationDelay: `${delay}ms` }}
                >
                  <div className="flex flex-col">
                  <div
                    className={`${perforatedSquare} relative group-hover:border-[3px] group-hover:border-solid group-hover:border-[#d4a24a]`}
                  >
                    <div
                      aria-hidden
                      className="absolute inset-0 bg-cover bg-center animate-[v2-rotate_28s_linear_infinite]"
                      style={{ backgroundImage: `url(${homeRainbowImg})` }}
                    />

                    {/* Join button (person +) - upper left of ORG tab, same as nav tabs */}
                    <Link
                      to="/join"
                      onClick={(e) => e.stopPropagation()}
                      aria-label="Join the ORG or access member portal"
                      title="Join or sign in as a member"
                      className="absolute top-1 left-1 z-[30] grid h-8 w-8 place-items-center border border-[rgba(236,226,196,0.4)] bg-[rgba(11,13,18,0.85)] text-[#d4a24a] backdrop-blur transition-colors hover:border-[#d4a24a] hover:text-[#f0e6d0]"
                    >
                      <UserPlus size={20} />
                    </Link>

                    {/* Search button (magnifying glass) - upper right of ORG tab, same as nav tabs */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        openSearch();
                      }}
                      aria-label="Search the archive"
                      title="Search the ORG archive (⌘K)"
                      className="absolute top-1 right-1 z-[30] grid h-8 w-8 place-items-center border border-[rgba(236,226,196,0.4)] bg-[rgba(11,13,18,0.85)] text-[#d4a24a] backdrop-blur transition-colors hover:border-[#d4a24a] hover:text-[#f0e6d0]"
                    >
                      <Search size={20} />
                    </button>

                    <TabPerforations />
                  </div>
                  <span aria-hidden className={tileLabel}>
                    {LABELS.home}
                  </span>
                  </div>
                </div>
              )
            }

            const s = entry as (typeof SECTIONS)[number]
            const img = IMAGES[s.id]
            const isInternal = s.href.startsWith('/')
            const inner = (
              <div className="flex flex-col">
                <div
                  className={`${perforatedSquare} relative group-hover:border-[3px] group-hover:border-solid group-hover:border-[#d4a24a]`}
                >
                <span
                  aria-hidden
                  className="absolute inset-0 bg-cover bg-center"
                  style={{
                    backgroundImage: img
                      ? `url(${img})`
                      : 'linear-gradient(140deg, rgba(28,30,38,0.92), rgba(15,17,22,0.92))',
                  }}
                />
                  <TabPerforations />
                </div>
                <span aria-hidden className={tileLabel}>
                  {LABELS[s.id] ?? s.label}
                </span>
              </div>
            )

            return isInternal ? (
              <Link
                key={s.id}
                to={s.href}
                title={s.label}
                aria-label={s.label}
                className={cellWrapper}
                style={{ animationDelay: `${delay}ms` }}
              >
                {inner}
              </Link>
            ) : (
              <a
                key={s.id}
                href={s.href}
                target="_blank"
                rel="noopener noreferrer"
                title={s.label}
                aria-label={s.label}
                className={cellWrapper}
                style={{ animationDelay: `${delay}ms` }}
              >
                {inner}
              </a>
            )
          })}
        </div>
      </main>
    </div>
  )
}
