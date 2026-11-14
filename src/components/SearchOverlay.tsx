import { useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { X } from 'lucide-react'
import { search as searchPages, withHighlight, PAGE_META } from '#/lib/search'
import { DEFAULT_WEBSITE_PAGES } from '#/lib/content-defaults'
import { loadPublishedPages } from '#/lib/content-api'
import type { WebsitePageContent } from '#/lib/content-types'
import { fetchFragments, MAX_QUERY_LENGTH, resultLink } from '#/lib/search-api'
import {
  resultBadge,
  resultContext,
  ResultSnippet,
} from '#/components/search/ResultSnippet'
import { useArchiveSearch } from '#/components/search/use-archive-search'

const NOISE_URL =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='1.6' numOctaves='2' seed='7'/></filter><rect width='100%' height='100%' filter='url(%23n)' opacity='0.65'/></svg>\")"

/**
 * Shown until enough people have searched for something public (plan D21):
 * the fragments then follow what is searched, through the server's
 * aggregate counts only.
 */
export const DEFAULT_SUGGESTIONS = [
  { label: 'DMT vapor meditation', term: 'DMT' },
  { label: 'Octagon temple', term: 'octagon' },
  { label: 'How to join', term: 'How To Join' },
  { label: 'Greg Lake', term: 'Greg Lake' },
  { label: 'Majority vote', term: 'vote' },
  { label: 'Entheo Community', term: 'Entheo Community' },
]

/** Search waits this long after the last keystroke. */
const TYPING_PAUSE_MS = 250

interface Item {
  key: string
  badge: string
  accent: string
  snippet: ReactNode
  context: string
  open: () => void
}

/** Perforation frame for the panel (6px, d=25px, g=20px, separate v/h). */
function PerforationFrame() {
  const perfColor = 'rgba(236,226,196,0.88)'
  const d = '25px'
  const g = '20px'
  const t = '6px'
  const gradient = (direction: string) =>
    `repeating-linear-gradient(${direction}, ${perfColor} 0, ${perfColor} ${d}, transparent ${d}, transparent calc(${d} + ${g}))`
  return (
    <>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-10"
        style={{
          backgroundImage: `${gradient('to bottom')},${gradient('to bottom')}`,
          backgroundSize: `${t} 100%,${t} 100%`,
          backgroundPosition: '0% 0%,100% 0%',
          backgroundRepeat: 'no-repeat,no-repeat',
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-20"
        style={{
          backgroundImage: `${gradient('to right')},${gradient('to right')}`,
          backgroundSize: `100% ${t},100% ${t}`,
          backgroundPosition: '0% 0%,0% 100%',
          backgroundRepeat: 'no-repeat,no-repeat',
        }}
      />
    </>
  )
}

/**
 * The Perforated Index (Chunk 15): the ⌘K search over member names,
 * beliefs and ORG pages, as the server lets this reader see them. If the
 * server cannot be reached it still searches the ORG pages it has here, and
 * says so.
 */
export function SearchOverlay() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(0)
  const [pages, setPages] = useState<Array<WebsitePageContent>>(
    Object.values(DEFAULT_WEBSITE_PAGES),
  )
  const [fragments, setFragments] = useState<Array<string>>([])
  const inputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()
  const { state } = useArchiveSearch(
    open ? query : '',
    'all',
    1,
    TYPING_PAUSE_MS,
  )
  const q = query.trim()

  function close() {
    setOpen(false)
    setQuery('')
  }

  function openWith() {
    setOpen(true)
    setQuery('')
    void loadPublishedPages()
      .then((published) => setPages(published.map((page) => page.content)))
      .catch(() => undefined)
    void fetchFragments()
      .then((result) => setFragments(result.fragments))
      .catch(() => setFragments([]))
    setTimeout(() => inputRef.current?.focus(), 60)
  }

  const items = useMemo((): Array<Item> => {
    const go = (to: Parameters<typeof navigate>[0]) => () => {
      close()
      void navigate(to)
    }
    if (state.status === 'error') {
      // Offline: the ORG pages bundled here, never member content.
      return searchPages(q, pages).map((result, index) => ({
        key: `local-${result.pageId}-${index}`,
        badge: PAGE_META[result.pageId].short,
        accent: PAGE_META[result.pageId].accent,
        snippet: withHighlight(result.snippet, q),
        context: result.title,
        open: go({ to: result.href, search: { q } } as never),
      }))
    }
    const data = state.status === 'idle' ? undefined : state.data
    if (!data) return []
    return data.results.map((result, index) => ({
      key: `${result.kind}-${index}`,
      badge: resultBadge(result),
      accent: '#5800FF',
      snippet: <ResultSnippet result={result} />,
      context: resultContext(result),
      open: go(resultLink(result, data.query) as never),
    }))
    // `navigate` is stable; `close` only sets state.
  }, [state, pages, q])

  const total =
    state.status === 'ready' || state.status === 'loading'
      ? (state.data?.total ?? 0)
      : items.length

  useEffect(() => setSelected(0), [query])

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        if (open) close()
        else openWith()
        return
      }
      if (!open) return
      if (event.key === 'Escape') {
        event.preventDefault()
        close()
      } else if (event.key === 'ArrowDown') {
        event.preventDefault()
        setSelected((s) => Math.min(s + 1, Math.max(0, items.length - 1)))
      } else if (event.key === 'ArrowUp') {
        event.preventDefault()
        setSelected((s) => Math.max(s - 1, 0))
      } else if (event.key === 'Enter' && items[selected]) {
        event.preventDefault()
        items[selected].open()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  })

  useEffect(() => {
    const handleOpen = () => openWith()
    const refresh = () =>
      void loadPublishedPages()
        .then((published) => setPages(published.map((page) => page.content)))
        .catch(() => undefined)
    window.addEventListener('org:open-search', handleOpen)
    window.addEventListener('org:content-published', refresh)
    return () => {
      window.removeEventListener('org:open-search', handleOpen)
      window.removeEventListener('org:content-published', refresh)
    }
  }, [])

  if (!open) return null

  const suggestions =
    fragments.length > 0
      ? fragments.map((term) => ({ label: term, term }))
      : DEFAULT_SUGGESTIONS
  const searching = q.length >= 2

  return (
    <div
      className="fixed inset-0 z-[75] flex items-start justify-center bg-[rgba(8,9,13,0.82)] px-4 pt-[9vh] pb-12 backdrop-blur-[2px]"
      onClick={close}
      aria-modal="true"
      role="dialog"
      aria-label="Search the ORG archive"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.06] mix-blend-overlay"
        style={{ backgroundImage: NOISE_URL }}
      />

      <div
        className="relative w-full max-w-[min(92vw,640px)] overflow-hidden rounded-sm bg-[#0b0d12] text-[#ece2c4] shadow-[0_0_0_1px_rgba(236,226,196,0.12),0_24px_80px_rgba(0,0,0,0.6)]"
        onClick={(event) => event.stopPropagation()}
      >
        <PerforationFrame />

        <div className="relative z-30 flex items-center justify-between border-b border-[rgba(236,226,196,0.12)] px-5 pb-3 pt-4">
          <div>
            <div className="text-[10px] uppercase tracking-[0.38em] text-[#b8ad8d]">
              THE ORG ARCHIVE
            </div>
            <div className="text-[clamp(15px,3.2vw,19px)] font-thin uppercase tracking-[0.14em] text-[#f3ead0]">
              The Perforated Index
            </div>
          </div>
          <button
            type="button"
            onClick={close}
            aria-label="Close search"
            className="grid h-8 w-8 place-items-center border border-[rgba(236,226,196,0.28)] text-[#b8ad8d] transition-colors hover:border-[#ece2c4] hover:text-[#ece2c4]"
          >
            <X size={16} />
          </button>
        </div>

        <div className="relative z-30 px-5 pb-2 pt-4">
          <label
            htmlFor="perforated-index-query"
            className="mb-1 block text-[10px] uppercase tracking-[0.34em] text-[#9f9676]"
          >
            What vision do you seek?
          </label>
          <input
            id="perforated-index-query"
            ref={inputRef}
            value={query}
            maxLength={MAX_QUERY_LENGTH}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Names, beliefs, ORG pages…"
            className="w-full border-0 border-b border-dashed border-[#d4a24a]/60 bg-transparent pb-2 text-[17px] font-light tracking-[0.01em] text-[#f3ead0] placeholder:text-[#9f9676] focus:border-[#d4a24a] focus:outline-none"
            spellCheck={false}
            aria-controls="perforated-index-results"
          />
        </div>

        <div
          id="perforated-index-results"
          aria-live="polite"
          className="relative z-30 max-h-[58vh] overflow-auto px-2 pb-3 pt-1 text-sm"
        >
          {!searching && (
            <div className="px-3 py-2">
              <div className="mb-2 text-[10px] uppercase tracking-[0.32em] text-[#9f9676]">
                SUGGESTED FRAGMENTS
              </div>
              <div className="flex flex-wrap gap-2">
                {suggestions.map((suggestion) => (
                  <button
                    key={suggestion.term}
                    type="button"
                    onClick={() => {
                      setQuery(suggestion.term)
                      setTimeout(() => inputRef.current?.focus(), 10)
                    }}
                    className="border border-dashed border-[rgba(236,226,196,0.3)] px-3 py-1 text-[12px] uppercase tracking-[0.2em] text-[#d8ceb0] transition-colors hover:border-solid hover:border-[#d4a24a] hover:text-[#f0e6d0]"
                  >
                    {suggestion.label}
                  </button>
                ))}
              </div>
              <div className="mt-4 text-[10px] text-[#9f9676]">
                Or type anything — names, beliefs, events, sacraments. Results
                are extracts from the living archive.
              </div>
            </div>
          )}

          {searching && state.status === 'loading' && items.length === 0 && (
            <p role="status" className="px-3 py-6 text-center text-[#b8ad8d]">
              Searching the records…
            </p>
          )}

          {searching && state.status === 'error' && (
            <p
              role="alert"
              className="px-3 pb-2 pt-1 text-[12px] text-[#f1a07a]"
            >
              Member pages could not be searched right now; showing ORG pages
              only.
            </p>
          )}

          {searching && items.length === 0 && state.status !== 'loading' && (
            <div className="px-3 py-6 text-center text-[#b8ad8d]">
              No matches in the records.
              <br />
              <span className="text-[12px] tracking-[0.1em]">
                The Universal Creator works in mysterious ways.
              </span>
            </div>
          )}

          {searching && items.length > 0 && (
            <>
              <div className="px-3 pb-1.5 text-[10px] uppercase tracking-[0.32em] text-[#9f9676]">
                {total} FRAGMENT{total === 1 ? '' : 'S'} —{' '}
                <span className="normal-case tracking-normal">
                  tap or ↵ to open
                </span>
              </div>
              <div
                role="listbox"
                aria-label="Results"
                aria-activedescendant={`result-${Math.min(selected, items.length - 1)}`}
              >
                {items.map((item, index) => {
                  const isActive = index === selected
                  return (
                    <button
                      key={item.key}
                      id={`result-${index}`}
                      type="button"
                      role="option"
                      aria-selected={isActive}
                      onClick={item.open}
                      onMouseEnter={() => setSelected(index)}
                      className={`group mb-1 flex w-full flex-col gap-1 border-l-2 px-3 py-2 text-left transition-all ${
                        isActive
                          ? 'border-[#d4a24a] bg-[rgba(212,162,74,0.06)]'
                          : 'border-[rgba(236,226,196,0.12)] hover:border-[#d4a24a] hover:bg-[rgba(236,226,196,0.025)]'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div
                          aria-hidden
                          className="h-3 w-[3px] flex-none opacity-70"
                          style={{
                            background: `repeating-linear-gradient(to bottom, ${item.accent} 0, ${item.accent} 3px, transparent 3px, transparent 7px)`,
                          }}
                        />
                        <span
                          className="inline-block text-[10px] font-bold uppercase tracking-[0.26em] text-[#f3ead0] group-hover:text-white"
                          style={{ color: isActive ? '#d4a24a' : undefined }}
                        >
                          {item.badge}
                        </span>
                      </div>
                      <div className="pl-5 text-[13.5px] leading-snug text-[#d8ceb0] [overflow-wrap:anywhere] group-hover:text-[#ece2c4]">
                        {item.snippet}
                      </div>
                      <div className="pl-5 text-[10px] uppercase tracking-[0.26em] text-[#9f9676] [overflow-wrap:anywhere]">
                        {item.context}
                      </div>
                    </button>
                  )
                })}
              </div>
              {state.status !== 'error' && total > items.length && (
                <button
                  type="button"
                  onClick={() => {
                    close()
                    void navigate({ to: '/search', search: { q } } as never)
                  }}
                  className="mx-3 mt-2 border border-[rgba(236,226,196,0.22)] px-3 py-1 text-[11px] uppercase tracking-[0.2em] text-[#d8ceb0] hover:border-[#d4a24a]"
                >
                  See all {total} results
                </button>
              )}
            </>
          )}
        </div>

        <div className="relative z-30 border-t border-[rgba(236,226,196,0.12)] px-5 py-2 text-[10px] uppercase tracking-[0.32em] text-[#9f9676]">
          ⌘K / CTRL+K &nbsp;·&nbsp; ↑↓ &nbsp;·&nbsp; ↵ OPEN &nbsp;·&nbsp; ESC
          CLOSE
        </div>
      </div>
    </div>
  )
}
