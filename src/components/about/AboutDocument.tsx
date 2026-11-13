import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { useLocation, useNavigate } from '@tanstack/react-router'
import type { AboutPageContent } from '#/lib/content-types'
import { SiteNav } from '#/components/SiteNav'
import { AboutArticleBlock, AboutContactBlock } from './AboutArticleBlocks'
import {
  ABOUT_DOCUMENT_STYLES,
  ABOUT_NOISE_URL,
  ABOUT_VIGNETTE_BACKGROUND,
  octagonPoints,
} from './about-document-theme'

/** @param after - shown after the document, e.g. the reactions to it */
export function AboutDocument({
  content,
  after,
}: {
  content: AboutPageContent
  after?: ReactNode
}) {
  const location = useLocation()
  const navigate = useNavigate()

  const searchParams = new URLSearchParams(location.searchStr || '')
  const searchTerm = searchParams.get('q') || undefined
  const tableOfContents = [
    ...content.articles.map((article) => ({
      id: article.id,
      roman: article.roman,
      label: article.eyebrow,
    })),
    {
      id: 'contact',
      roman: content.contact.roman,
      label: content.contact.eyebrow,
    },
  ]

  const [active, setActive] = useState(tableOfContents[0].id)
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    const documentElement = document.documentElement
    const updateProgress = () => {
      const max = documentElement.scrollHeight - documentElement.clientHeight
      setProgress(
        max > 0 ? Math.min(1, Math.max(0, documentElement.scrollTop / max)) : 0,
      )
    }
    updateProgress()
    window.addEventListener('scroll', updateProgress, { passive: true })

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActive(entry.target.id)
        }
      },
      { rootMargin: '-28% 0px -64% 0px', threshold: 0 },
    )
    document
      .querySelectorAll('[data-article]')
      .forEach((element) => observer.observe(element))

    return () => {
      window.removeEventListener('scroll', updateProgress)
      observer.disconnect()
    }
  }, [])

  return (
    <div className="relative min-h-screen w-full overflow-x-hidden bg-[#0b0d12] text-[#ece2c4]">
      <style>{ABOUT_DOCUMENT_STYLES}</style>

      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-0"
        style={{ background: ABOUT_VIGNETTE_BACKGROUND }}
      />
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-0 opacity-[0.07] mix-blend-overlay"
        style={{ backgroundImage: ABOUT_NOISE_URL }}
      />
      <svg
        aria-hidden
        viewBox="0 0 1000 1000"
        className="pointer-events-none fixed left-1/2 top-[-14%] z-0 h-[min(120vmin,1200px)] w-[min(120vmin,1200px)] -translate-x-1/2 opacity-[0.5] animate-[v2-rotate_120s_linear_infinite]"
      >
        {[470, 380, 290, 200].map((radius, index) => (
          <polygon
            key={radius}
            points={octagonPoints(500, 500, radius)}
            fill="none"
            stroke="rgba(212,162,74,0.10)"
            strokeWidth={index === 0 ? 1 : 0.5}
          />
        ))}
      </svg>

      <div className="fixed inset-x-0 top-0 z-50 h-[2px] bg-transparent">
        <div
          className="h-full origin-left bg-[#d4a24a]"
          style={{
            transform: `scaleX(${progress})`,
            transition: 'transform 90ms linear',
          }}
        />
      </div>

      <SiteNav />

      <section className="relative z-[3] mx-auto max-w-[1180px] px-[clamp(16px,4vw,40px)] pb-[clamp(36px,6vh,64px)] pt-[clamp(180px,21vh,235px)] text-center">
        <h1
          className="ab-rise m-0 font-thin uppercase leading-[0.95] tracking-[0.12em] text-[#f6efd9]"
          style={{ fontSize: 'clamp(44px,9vw,120px)', animationDelay: '200ms' }}
        >
          {content.title}
        </h1>

        <div
          className="ab-rise mx-auto mt-8 inline-flex items-center gap-2.5 border border-[rgba(212,162,74,0.22)] bg-[rgba(212,162,74,0.04)] px-4 py-2 text-[10px] uppercase tracking-[0.22em] text-[#b8ad8d]"
          style={{ animationDelay: '440ms' }}
        >
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#d4a24a] opacity-60" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#d4a24a]" />
          </span>
          {content.statusNote}
        </div>

        {searchTerm ? (
          <div className="ab-rise mt-4 text-[10px] uppercase tracking-[0.34em] text-[#d4a24a]">
            SEARCHING “{searchTerm}” —{' '}
            <button
              onClick={() => navigate({ to: location.pathname, search: {} })}
              className="underline decoration-dotted hover:text-[#f0e6d0]"
            >
              CLEAR
            </button>
          </div>
        ) : null}
      </section>

      <div className="relative z-[3] mx-auto grid max-w-[1180px] grid-cols-1 gap-x-12 px-[clamp(16px,4vw,40px)] pb-24 lg:grid-cols-[210px_minmax(0,780px)] lg:justify-center">
        <aside className="mb-10 lg:mb-0">
          <nav className="sticky top-[160px]">
            <div className="mb-4 text-[10px] uppercase tracking-[0.34em] text-[#9f9676]">
              Contents
            </div>
            <ol className="m-0 flex list-none flex-col gap-0.5 p-0">
              {tableOfContents.map((item) => {
                const isActive = active === item.id
                return (
                  <li key={item.id}>
                    <a
                      href={`#${item.id}`}
                      onClick={() => setActive(item.id)}
                      className={`group flex items-center gap-3 border-l-2 py-1.5 pl-3 text-[12px] no-underline transition-colors ${
                        isActive
                          ? 'border-[#d4a24a] text-[#f3ead0]'
                          : 'border-transparent text-[#9f9676] hover:border-[rgba(212,162,74,0.4)] hover:text-[#cdc2a4]'
                      }`}
                    >
                      <span className="truncate font-light tracking-wide">
                        {item.label}
                      </span>
                    </a>
                  </li>
                )
              })}
            </ol>
          </nav>
        </aside>

        <main className="flex min-w-0 flex-col gap-[clamp(52px,8vh,88px)]">
          {content.articles.map((article, index) => (
            <AboutArticleBlock
              key={article.id}
              article={article}
              index={index}
            />
          ))}
          <AboutContactBlock contact={content.contact} />
          {after}
        </main>
      </div>
    </div>
  )
}
