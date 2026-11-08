import { Link, createFileRoute } from '@tanstack/react-router'
import type { SECTIONS } from '#/lib/sections'
import { GRID_ORDER } from '#/lib/sections'
import { svgCoord } from '#/lib/svg'
import type { JSX } from 'react'

export const Route = createFileRoute('/archive/4')({ component: TarotAtelier })

function Glyph({ id }: { id: string }) {
  const common = {
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  }
  const glyphs: Record<string, JSX.Element> = {
    about: (
      <g {...common}>
        <circle cx="32" cy="22" r="8" />
        <path d="M16 50 C16 38, 48 38, 48 50" />
        <path d="M32 14 V8 M32 36 V44" />
      </g>
    ),
    community: (
      <g {...common}>
        <circle cx="32" cy="32" r="20" />
        <circle cx="32" cy="14" r="3" />
        <circle cx="32" cy="50" r="3" />
        <circle cx="14" cy="32" r="3" />
        <circle cx="50" cy="32" r="3" />
        <circle cx="19" cy="19" r="3" />
        <circle cx="45" cy="45" r="3" />
        <circle cx="45" cy="19" r="3" />
        <circle cx="19" cy="45" r="3" />
      </g>
    ),
    beliefs: (
      <g {...common}>
        <path d="M22 46 C22 32, 22 26, 32 18 C42 26, 42 32, 42 46" />
        <path d="M32 18 C28 24, 28 30, 32 36 C36 30, 36 24, 32 18 Z" />
        <circle cx="32" cy="48" r="2" />
      </g>
    ),
    infrastructure: (
      <g {...common}>
        <polygon points="32,8 50,18 50,42 32,52 14,42 14,18" />
        <polygon points="32,16 44,22 44,38 32,44 20,38 20,22" />
        <line x1="32" y1="16" x2="32" y2="44" />
        <line x1="20" y1="22" x2="44" y2="38" />
        <line x1="44" y1="22" x2="20" y2="38" />
      </g>
    ),
    research: (
      <g {...common}>
        <circle cx="28" cy="28" r="14" />
        <line x1="38" y1="38" x2="50" y2="50" />
        <line x1="22" y1="28" x2="34" y2="28" />
        <line x1="28" y1="22" x2="28" y2="34" />
      </g>
    ),
    legal: (
      <g {...common}>
        <line x1="32" y1="10" x2="32" y2="52" />
        <line x1="16" y1="22" x2="48" y2="22" />
        <path d="M16 22 L10 36 C10 40, 22 40, 22 36 Z" />
        <path d="M48 22 L54 36 C54 40, 42 40, 42 36 Z" />
        <line x1="24" y1="52" x2="40" y2="52" />
      </g>
    ),
    future: (
      <g {...common}>
        <path d="M18 10 H46 L34 26 L46 42 H18 L30 26 Z" />
        <line x1="14" y1="10" x2="50" y2="10" />
        <line x1="14" y1="42" x2="50" y2="42" />
      </g>
    ),
    donations: (
      <g {...common}>
        <path d="M32 50 C18 40, 10 32, 10 22 C10 14, 18 10, 22 14 C26 18, 32 24, 32 24 C32 24, 38 18, 42 14 C46 10, 54 14, 54 22 C54 32, 46 40, 32 50 Z" />
      </g>
    ),
  }
  return (
    <svg viewBox="0 0 64 64" className="v4-glyph" aria-hidden>
      {glyphs[id]}
    </svg>
  )
}

function CenterGlyph() {
  return (
    <svg viewBox="-50 -50 100 100" className="v4-glyph v4-glyph-lg" aria-hidden>
      <g fill="none" stroke="currentColor" strokeWidth={1.1}>
        <polygon points="29.3,-40 -29.3,-40 -40,-29.3 -40,29.3 -29.3,40 29.3,40 40,29.3 40,-29.3" />
        <polygon points="23,-32 -23,-32 -32,-23 -32,23 -23,32 23,32 32,23 32,-23" />
        <circle cx="0" cy="0" r="10" />
        {Array.from({ length: 8 }).map((_, i) => {
          const a = (Math.PI / 4) * i - Math.PI / 8
          return (
            <line
              key={i}
              x1={svgCoord(Math.cos(a) * 10)}
              y1={svgCoord(Math.sin(a) * 10)}
              x2={svgCoord(Math.cos(a) * 36)}
              y2={svgCoord(Math.sin(a) * 36)}
            />
          )
        })}
      </g>
    </svg>
  )
}

function TarotAtelier() {
  return (
    <div className="variant-4">
      <style>{styles}</style>
      <div className="v4-paper">
        <div className="v4-grain" aria-hidden />
        <div className="v4-sigil" aria-hidden>
          <svg viewBox="-100 -100 200 200">
            <g
              fill="none"
              stroke="currentColor"
              strokeWidth={0.4}
              opacity={0.6}
            >
              <polygon points="29.3,-80 -29.3,-80 -80,-29.3 -80,29.3 -29.3,80 29.3,80 80,29.3 80,-29.3" />
              <polygon points="29.3,-60 -29.3,-60 -60,-29.3 -60,29.3 -29.3,60 29.3,60 60,29.3 60,-29.3" />
              <polygon points="29.3,-40 -29.3,-40 -40,-29.3 -40,29.3 -29.3,40 29.3,40 40,29.3 40,-29.3" />
              {Array.from({ length: 16 }).map((_, i) => {
                const a = (Math.PI / 8) * i - Math.PI / 16
                return (
                  <line
                    key={i}
                    x1={0}
                    y1={0}
                    x2={svgCoord(Math.cos(a) * 80)}
                    y2={svgCoord(Math.sin(a) * 80)}
                  />
                )
              })}
            </g>
          </svg>
        </div>

        <header className="v4-mast">
          <div className="v4-mast-side v4-mast-l">
            <span>✦</span>
            <span>ANNO MMXXV</span>
          </div>
          <div className="v4-mast-c">
            <div className="v4-mast-tiny">
              A NINEFOLD DECK FOR THE STUDENT OF
            </div>
            <div className="v4-mast-name">The Octagon</div>
            <div className="v4-mast-tiny">
              RELIGIOUS&nbsp;·&nbsp;RESEARCH&nbsp;·&nbsp;GROUP
            </div>
          </div>
          <div className="v4-mast-side v4-mast-r">
            <span>NINE ARCANA</span>
            <span>✦</span>
          </div>
        </header>

        <main className="v4-grid">
          {GRID_ORDER.map((entry, i) => {
            const row = Math.floor(i / 3)
            const col = i % 3
            const tilt =
              ((row + col) % 2 === 0 ? -1 : 1) * (0.6 + (i % 3) * 0.25)
            const delay = i * 90 + 200
            const isCenter = entry.id === 'home'

            if (isCenter) {
              return (
                <Link
                  key={entry.id}
                  to="/"
                  className="v4-card v4-card-center"
                  style={
                    {
                      animationDelay: `${delay}ms`,
                      '--tilt': `${tilt}deg`,
                    } as React.CSSProperties
                  }
                >
                  <div className="v4-card-inner">
                    <div className="v4-corners">
                      <span>✦</span>
                      <span>✦</span>
                      <span>✦</span>
                      <span>✦</span>
                    </div>
                    <span className="v4-roman">IX</span>
                    <div className="v4-glyph-frame v4-glyph-frame-lg">
                      <CenterGlyph />
                    </div>
                    <h2 className="v4-title v4-title-c">THE OCTAGON</h2>
                    <span className="v4-caption">— principium et finis —</span>
                  </div>
                </Link>
              )
            }
            const s = entry as (typeof SECTIONS)[number]
            return (
              <Link
                key={s.id}
                to={s.href}
                className="v4-card"
                style={
                  {
                    animationDelay: `${delay}ms`,
                    '--tilt': `${tilt}deg`,
                  } as React.CSSProperties
                }
              >
                <div className="v4-card-inner">
                  <div className="v4-corners">
                    <span>✦</span>
                    <span>✦</span>
                    <span>✦</span>
                    <span>✦</span>
                  </div>
                  <span className="v4-roman">{s.roman}</span>
                  <div className="v4-glyph-frame">
                    <Glyph id={s.id} />
                  </div>
                  <h2 className="v4-title">{s.label.toUpperCase()}</h2>
                  <span className="v4-caption">
                    — {s.tagline.toLowerCase()} —
                  </span>
                </div>
              </Link>
            )
          })}
        </main>

        <footer className="v4-foot">
          <span>✦</span>
          <span className="v4-foot-c">
            <em>Draw thy panel. The reading is the room.</em>
          </span>
          <span>✦</span>
        </footer>
      </div>
    </div>
  )
}

const styles = `
.variant-4 {
  --paper: #efe6cf;
  --paper-deep: #e3d6b0;
  --ink: #3a0e0e;
  --ink-soft: #6a3a31;
  --gold: #8a6a2a;
  font-family: var(--font-helvetica);
  color: var(--ink);
  background: var(--paper);
  min-height: 100vh;
  width: 100%;
  position: relative;
  overflow: hidden;
}
.variant-4 .v4-paper {
  position: relative;
  min-height: 100vh;
  padding: 28px clamp(20px, 4vw, 56px) 26px;
  display: grid;
  grid-template-rows: auto 1fr auto;
  gap: 22px;
  background:
    radial-gradient(80% 70% at 50% 40%, rgba(232,210,170,0.5), transparent 75%),
    var(--paper);
}
.variant-4 .v4-grain {
  position: absolute; inset: 0;
  pointer-events: none;
  opacity: 0.22;
  mix-blend-mode: multiply;
  background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='240' height='240'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='1.4' numOctaves='2' seed='9'/></filter><rect width='100%' height='100%' filter='url(%23n)' opacity='0.7'/></svg>");
}
.variant-4 .v4-sigil {
  position: absolute;
  width: min(95vmin, 1100px);
  height: min(95vmin, 1100px);
  left: 50%; top: 56%;
  transform: translate(-50%, -50%);
  color: var(--ink);
  opacity: 0.05;
  pointer-events: none;
}
.variant-4 .v4-sigil svg { width: 100%; height: 100%; }
.variant-4 .v4-mast {
  position: relative;
  z-index: 3;
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: 22px;
}
.variant-4 .v4-mast-side {
  display: flex; gap: 18px;
  font-size: 10px; letter-spacing: 0.42em;
  color: var(--ink-soft);
}
.variant-4 .v4-mast-l { justify-content: flex-start; }
.variant-4 .v4-mast-r { justify-content: flex-end; }
.variant-4 .v4-mast-c { text-align: center; }
.variant-4 .v4-mast-tiny {
  font-size: 9px; letter-spacing: 0.46em;
  text-transform: uppercase;
  color: var(--ink-soft);
  font-weight: 400;
}
.variant-4 .v4-mast-name {
  font-style: italic;
  font-weight: 700;
  font-size: clamp(28px, 4vw, 50px);
  letter-spacing: -0.01em;
  line-height: 1.05;
  color: var(--ink);
  margin: 2px 0 4px;
}
.variant-4 .v4-grid {
  position: relative;
  z-index: 2;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  grid-template-rows: repeat(3, 1fr);
  gap: clamp(12px, 1.8vw, 28px);
  min-height: clamp(540px, 70vh, 820px);
}
.variant-4 .v4-card {
  position: relative;
  text-decoration: none;
  color: var(--ink);
  background:
    radial-gradient(120% 80% at 50% 0%, rgba(255,255,255,0.4), transparent 60%),
    var(--paper-deep);
  border: 1px solid var(--ink);
  outline: 6px double transparent;
  outline-offset: -10px;
  padding: 12px;
  display: flex;
  align-items: stretch;
  opacity: 0;
  transform: translateY(28px) rotate(calc(var(--tilt) * -1.4));
  animation: v4-deal 900ms cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
  transform-origin: center bottom;
  transition: transform 360ms cubic-bezier(0.2, 0.8, 0.2, 1),
              box-shadow 360ms ease,
              background 360ms ease;
  will-change: transform;
  box-shadow:
    0 1px 0 rgba(58,14,14,0.18),
    inset 0 0 0 0 rgba(58,14,14,0);
}
.variant-4 .v4-card:hover {
  transform: translateY(-8px) rotate(calc(var(--tilt) * 0.3)) scale(1.025);
  box-shadow:
    0 24px 50px -20px rgba(58,14,14,0.45),
    0 0 0 1px rgba(138,106,42,0.4),
    inset 0 0 60px rgba(138,106,42,0.12);
}
.variant-4 .v4-card-inner {
  position: relative;
  width: 100%;
  border: 1px solid var(--ink);
  padding: 22px 16px 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  text-align: center;
  background:
    radial-gradient(120% 100% at 50% 0%, rgba(255,250,228,0.4), transparent 70%),
    transparent;
}
.variant-4 .v4-corners {
  position: absolute; inset: 6px; pointer-events: none;
  display: grid;
  grid-template-columns: 1fr 1fr;
  grid-template-rows: 1fr 1fr;
}
.variant-4 .v4-corners > span {
  font-size: 11px; color: var(--gold);
  align-self: start; justify-self: start;
}
.variant-4 .v4-corners > span:nth-child(2) { justify-self: end; }
.variant-4 .v4-corners > span:nth-child(3) { align-self: end; }
.variant-4 .v4-corners > span:nth-child(4) { align-self: end; justify-self: end; }
.variant-4 .v4-roman {
  font-weight: 700; font-style: italic;
  font-size: 13px; letter-spacing: 0.06em;
  color: var(--ink-soft);
}
.variant-4 .v4-glyph-frame {
  width: clamp(80px, 9vw, 130px);
  height: clamp(80px, 9vw, 130px);
  border: 1px solid var(--ink);
  border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  color: var(--ink);
  background:
    radial-gradient(circle, rgba(255,250,228,0.7), transparent 70%);
  margin-top: 4px;
}
.variant-4 .v4-glyph-frame-lg {
  width: clamp(120px, 13vw, 180px);
  height: clamp(120px, 13vw, 180px);
  border: 1px solid var(--ink-soft);
}
.variant-4 .v4-glyph { width: 70%; height: 70%; }
.variant-4 .v4-glyph-lg { width: 76%; height: 76%; }
.variant-4 .v4-title {
  margin: 4px 0 0;
  font-weight: 700;
  font-size: clamp(18px, 2vw, 26px);
  letter-spacing: 0.16em;
  line-height: 1.05;
  text-wrap: balance;
}
.variant-4 .v4-title-c {
  font-style: italic;
  letter-spacing: 0.04em;
}
.variant-4 .v4-caption {
  font-style: italic;
  font-weight: 300;
  font-size: 11px;
  letter-spacing: 0.04em;
  color: var(--ink-soft);
  margin-top: auto;
  padding-top: 6px;
  max-width: 22ch;
  line-height: 1.4;
}
.variant-4 .v4-card-center {
  background:
    radial-gradient(120% 80% at 50% 50%, rgba(255,243,200,0.7), rgba(227,214,176,1));
  outline-color: var(--gold);
}
.variant-4 .v4-card-center .v4-card-inner {
  border-color: var(--gold);
}
.variant-4 .v4-foot {
  position: relative;
  z-index: 3;
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 18px;
  color: var(--ink-soft);
  font-size: 11px;
  letter-spacing: 0.06em;
  font-style: italic;
}
.variant-4 .v4-foot-c { text-align: center; }
@keyframes v4-deal {
  to { opacity: 1; transform: translateY(0) rotate(var(--tilt)); }
}
@media (max-width: 820px) {
  .variant-4 .v4-mast { grid-template-columns: 1fr; text-align: center; }
  .variant-4 .v4-mast-side { justify-content: center; }
  .variant-4 .v4-grid { gap: 8px; }
  .variant-4 .v4-card-inner { padding: 16px 8px 10px; }
  .variant-4 .v4-title { font-size: 14px; letter-spacing: 0.1em; }
  .variant-4 .v4-caption { font-size: 9px; }
}
`
