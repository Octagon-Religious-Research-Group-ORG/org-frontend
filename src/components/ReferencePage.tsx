import { useEffect } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { useLocation, useNavigate } from '@tanstack/react-router'
import { SiteNav } from '#/components/SiteNav'
import type { ReferenceBlock, ReferencePageContent } from '#/lib/content-types'
import { withHighlight } from '#/lib/search'

const ACCENTS: Record<string, string> = {
  community: '#78aea2',
  beliefs: '#e2bd65',
  infrastructure: '#c98b63',
  research: '#8da8dc',
  legal: '#d6d0c2',
  future: '#c99bdd',
  donations: '#9dcf83',
}

function renderLinkedText(text: string, highlightTerm?: string): ReactNode {
  // Support markdown-style links [display text](https://url) for bold/underlined phrases from source docs
  const mdLinkRegex = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g
  const nodes: ReactNode[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = mdLinkRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(
        ...splitBareUrls(text.slice(lastIndex, match.index), highlightTerm),
      )
    }
    const display = match[1]
    const href = match[2]
    nodes.push(
      <a
        key={`md-${match.index}`}
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-[#f1d78a] underline decoration-[rgba(241,215,138,0.35)] underline-offset-4 transition-colors hover:text-white"
      >
        {withHighlight(display, highlightTerm)}
      </a>,
    )
    lastIndex = mdLinkRegex.lastIndex
  }
  if (lastIndex < text.length) {
    nodes.push(...splitBareUrls(text.slice(lastIndex), highlightTerm))
  }
  return nodes.length > 0 ? nodes : withHighlight(text, highlightTerm)
}

function splitBareUrls(text: string, highlightTerm?: string): ReactNode[] {
  const urlRegex = /((?:https?:\/\/|www\.)[^\s)]+)/g
  const parts = text.split(urlRegex)
  return parts
    .map((part, index) => {
      if (!part) return null
      if (/^(?:https?:\/\/|www\.)/.test(part)) {
        const href = part.startsWith('www.') ? `https://${part}` : part
        return (
          <a
            key={`url-${index}`}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#f1d78a] underline decoration-[rgba(241,215,138,0.35)] underline-offset-4 transition-colors hover:text-white"
          >
            {part}
          </a>
        )
      }
      return withHighlight(part, highlightTerm)
    })
    .filter(Boolean) as ReactNode[]
}

function ReferenceLine({
  block,
  searchTerm,
}: {
  block: ReferenceBlock
  searchTerm?: string
}) {
  const lowerLine = block.text.toLowerCase()
  const hasMatch = !!searchTerm && lowerLine.includes(searchTerm.toLowerCase())
  const matchClass = hasMatch ? 'search-match' : ''
  const matchData = hasMatch ? { 'data-search-match': 'true' } : {}

  if (block.kind === 'lead') {
    return (
      <p
        className={`m-0 border-l-2 border-[var(--accent)] bg-[rgba(236,226,196,0.05)] px-5 py-4 text-[18px] font-light leading-8 text-[#f3ead0] ${matchClass}`}
        {...matchData}
      >
        {renderLinkedText(block.text, searchTerm)}
      </p>
    )
  }

  if (block.kind === 'outline') {
    const depth = block.depth ?? 0
    const major = depth === 0
    const isCMarker = block.marker === 'C.'
    return (
      <div
        className={`grid items-baseline gap-3 border-l py-3 pr-3 ${
          major
            ? 'mt-4 border-[var(--accent)] bg-[rgba(236,226,196,0.045)]'
            : 'border-[rgba(236,226,196,0.09)]'
        } ${matchClass}`}
        style={{
          gridTemplateColumns: '3.1rem minmax(0,1fr)',
          paddingLeft: `${depth * 14 + 14 + (isCMarker ? 12 : 0)}px`,
        }}
        {...matchData}
      >
        <span
          className={`text-right font-light tabular-nums ${
            major
              ? 'text-[16px] text-[var(--accent)]'
              : 'text-[12px] text-[#a99f7c]'
          }`}
        >
          {block.marker}
        </span>
        <p
          className={`m-0 min-w-0 break-words ${
            major
              ? 'text-[18px] leading-8 text-[#f3ead0]'
              : 'text-[15px] leading-7 text-[#d8ceb0]'
          }`}
        >
          {renderLinkedText(block.text, searchTerm)}
        </p>
      </div>
    )
  }

  return (
    <p
      className={`m-0 break-words ${
        block.kind === 'heading'
          ? 'mt-8 border-t border-[rgba(236,226,196,0.12)] pt-6 text-[15px] uppercase tracking-[0.22em] text-[var(--accent)]'
          : 'text-[15px] leading-7 text-[#cfc4a5]'
      } ${matchClass}`}
      {...matchData}
    >
      {renderLinkedText(block.text, searchTerm)}
    </p>
  )
}

export function ReferencePage({ page }: { page: ReferencePageContent }) {
  const location = useLocation()
  const navigate = useNavigate()
  const accent = ACCENTS[page.id] ?? '#d4a24a'
  const style = { '--accent': accent } as CSSProperties

  const searchParams = new URLSearchParams(location.searchStr || '')
  const searchTerm = searchParams.get('q') || undefined

  // Auto-scroll + highlight the first matching line when arriving from search
  useEffect(() => {
    if (!searchTerm) return
    const timer = setTimeout(() => {
      const first = document.querySelector('[data-search-match]')
      if (first) {
        first.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    }, 110)
    return () => clearTimeout(timer)
  }, [searchTerm, page.id])

  const clearSearch = () => {
    navigate({ to: location.pathname, search: {} })
  }

  return (
    <div
      className="min-h-screen overflow-x-hidden bg-[#0b0d12] text-[#ece2c4]"
      style={style}
    >
      <SiteNav />
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0"
        style={{
          background:
            'radial-gradient(70% 55% at 50% 0%, color-mix(in srgb, var(--accent) 14%, transparent), transparent 62%), radial-gradient(60% 80% at 100% 30%, rgba(120,174,162,0.08), transparent 60%)',
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 opacity-[0.05] mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='1.2' numOctaves='2' seed='8'/></filter><rect width='100%' height='100%' filter='url(%23n)' opacity='0.8'/></svg>\")",
        }}
      />

      <main className="relative z-[1] mx-auto max-w-[1120px] px-[clamp(16px,4vw,40px)] pb-24 pt-[clamp(160px,18vh,210px)]">
        <section className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_260px] lg:items-end">
          <div>
            <h1 className="mt-5 max-w-[820px] break-words font-thin uppercase leading-[0.98] tracking-[0.04em] text-[#f6efd9] text-[clamp(28px,7vw,96px)] sm:tracking-[0.08em]">
              {page.title}
            </h1>
            <p className="mt-6 max-w-[680px] text-[clamp(16px,2vw,20px)] font-light leading-8 text-[#d8ceb0]">
              {page.subtitle}
            </p>

            {/* Search context pill (when arrived via the Perforated Index) */}
            {searchTerm && (
              <div className="mt-3 flex items-center gap-3 text-[10px] uppercase tracking-[0.34em] text-[#d4a24a]">
                SEARCHING “{searchTerm}”
                <button
                  type="button"
                  onClick={clearSearch}
                  className="border border-[rgba(212,162,74,0.4)] px-2 py-px text-[#b8ad8d] transition hover:border-[#d4a24a] hover:text-[#ece2c4]"
                >
                  CLEAR
                </button>
              </div>
            )}
          </div>
        </section>

        <article className="mt-12 border-y border-[rgba(236,226,196,0.12)] py-8">
          <div className="mx-auto flex max-w-[860px] flex-col gap-1">
            {page.blocks.map((block) => (
              <ReferenceLine
                key={block.id}
                block={block}
                searchTerm={searchTerm}
              />
            ))}
          </div>
        </article>
      </main>
    </div>
  )
}
