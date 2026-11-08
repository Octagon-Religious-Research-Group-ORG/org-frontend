import { Link, createFileRoute } from '@tanstack/react-router'
import type { SECTIONS } from '#/lib/sections'
import { GRID_ORDER } from '#/lib/sections'

export const Route = createFileRoute('/archive/1')({
  component: EditorialBureau,
})

const ISSUE_DATE = '07 NOVEMBER 2025'

function EditorialBureau() {
  return (
    <div className="variant-1">
      <style>{styles}</style>
      <div className="v1-paper">
        <header className="v1-masthead">
          <span className="v1-mast-rule" />
          <div className="v1-mast-row">
            <span className="v1-mast-meta">
              VOL. I &nbsp;&middot;&nbsp; ISSUE I
            </span>
            <span className="v1-mast-title">
              The Octagon Religious Research Group
            </span>
            <span className="v1-mast-meta">
              EST. MMXXV &nbsp;&middot;&nbsp; {ISSUE_DATE}
            </span>
          </div>
          <span className="v1-mast-rule" />
          <div className="v1-mast-sub">
            <span>
              A bibliographic index of inquiry, communion, and consequence.
            </span>
            <span className="v1-mast-folio">FOLIO &nbsp;ORG/IX</span>
          </div>
        </header>

        <main className="v1-grid">
          {GRID_ORDER.map((entry, i) => {
            const row = Math.floor(i / 3)
            const col = i % 3
            const isCenter = entry.id === 'home'
            const delay = (row + col) * 60 + 200

            if (isCenter) {
              return (
                <Link
                  key={entry.id}
                  to="/"
                  className="v1-cell v1-center"
                  style={{ animationDelay: `${delay}ms` }}
                >
                  <div className="v1-center-mark">
                    <svg
                      viewBox="0 0 100 100"
                      className="v1-octagon"
                      aria-hidden
                    >
                      <polygon
                        points="29.3,2 70.7,2 98,29.3 98,70.7 70.7,98 29.3,98 2,70.7 2,29.3"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.2"
                      />
                      <polygon
                        points="35,10 65,10 90,35 90,65 65,90 35,90 10,65 10,35"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="0.6"
                      />
                    </svg>
                    <div className="v1-center-mono">ORG</div>
                  </div>
                  <div className="v1-center-meta">
                    <span>IX</span>
                    <span>PRINCIPAL INDEX</span>
                    <span>ORG-000.OC</span>
                  </div>
                </Link>
              )
            }

            const s = entry as (typeof SECTIONS)[number]
            return (
              <Link
                key={s.id}
                to={s.href}
                className="v1-cell"
                style={{ animationDelay: `${delay}ms` }}
              >
                <div className="v1-cell-top">
                  <span className="v1-roman">{s.roman}</span>
                  <span className="v1-accession">{s.accession}</span>
                </div>
                <h2 className="v1-title">{s.label}</h2>
                <div className="v1-cell-bottom">
                  <span className="v1-tagline">{s.tagline}</span>
                  <span className="v1-filed">
                    FILED &nbsp;UNDER &nbsp;&mdash;&nbsp;{' '}
                    {s.filed.toUpperCase()}
                  </span>
                </div>
                <span className="v1-arrow">&rarr;</span>
              </Link>
            )
          })}
        </main>

        <footer className="v1-foot">
          <span>&copy; MMXXV ORG &middot; All inquiries archived.</span>
          <span className="v1-foot-mid">
            <span className="v1-dot" /> THE GRID &middot; NINE PANELS &middot;
            ONE INSTITUTION
          </span>
          <span>SET IN HELVETICA</span>
        </footer>
      </div>
    </div>
  )
}

const styles = `
.variant-1 {
  --paper: #f4f1ea;
  --ink: #141414;
  --ink-soft: #6a6760;
  --rule: #1a1a1a;
  --accent: #c8341c;
  font-family: var(--font-helvetica);
  color: var(--ink);
  background: var(--paper);
  min-height: 100vh;
  width: 100%;
  position: relative;
}
.variant-1 .v1-paper {
  min-height: 100vh;
  padding: 24px clamp(20px, 4vw, 56px) 28px;
  display: flex;
  flex-direction: column;
  gap: 22px;
}
.variant-1 .v1-paper::before {
  content: "";
  position: fixed;
  inset: 0;
  pointer-events: none;
  background-image: radial-gradient(rgba(20,20,20,0.05) 1px, transparent 1px);
  background-size: 3px 3px;
  mix-blend-mode: multiply;
  opacity: 0.5;
  z-index: 1;
}
.variant-1 .v1-masthead {
  position: relative;
  z-index: 2;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.variant-1 .v1-mast-rule {
  display: block;
  height: 2px;
  background: var(--rule);
}
.variant-1 .v1-mast-row {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: baseline;
  gap: 24px;
  padding: 6px 0 4px;
}
.variant-1 .v1-mast-meta {
  font-weight: 300;
  font-size: 10px;
  letter-spacing: 0.32em;
  text-transform: uppercase;
}
.variant-1 .v1-mast-row > .v1-mast-meta:first-child { text-align: left; }
.variant-1 .v1-mast-row > .v1-mast-meta:last-child { text-align: right; }
.variant-1 .v1-mast-title {
  font-family: var(--font-helvetica);
  font-weight: 700;
  font-style: italic;
  font-size: clamp(28px, 4.4vw, 56px);
  letter-spacing: -0.02em;
  line-height: 1;
  text-align: center;
  white-space: nowrap;
}
.variant-1 .v1-mast-sub {
  display: flex;
  justify-content: space-between;
  font-size: 10px;
  letter-spacing: 0.28em;
  text-transform: uppercase;
  font-weight: 400;
  color: var(--ink-soft);
}
.variant-1 .v1-mast-folio { color: var(--accent); font-weight: 700; }
.variant-1 .v1-grid {
  position: relative;
  z-index: 2;
  flex: 1;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  grid-template-rows: repeat(3, 1fr);
  gap: 0;
  border-top: 2px solid var(--rule);
  border-left: 2px solid var(--rule);
  min-height: clamp(560px, 64vh, 760px);
}
.variant-1 .v1-cell {
  position: relative;
  padding: 22px 22px 18px;
  border-right: 2px solid var(--rule);
  border-bottom: 2px solid var(--rule);
  text-decoration: none;
  color: var(--ink);
  background: var(--paper);
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  transition: background 220ms ease, color 220ms ease;
  overflow: hidden;
  opacity: 0;
  transform: translateY(8px);
  animation: v1-fade 600ms cubic-bezier(0.2, 0.7, 0.2, 1) forwards;
}
.variant-1 .v1-cell:hover {
  background: var(--ink);
  color: var(--paper);
}
.variant-1 .v1-cell:hover .v1-roman,
.variant-1 .v1-cell:hover .v1-accession,
.variant-1 .v1-cell:hover .v1-tagline,
.variant-1 .v1-cell:hover .v1-filed {
  color: var(--paper);
}
.variant-1 .v1-cell:hover .v1-arrow {
  transform: translate(0, 0);
  opacity: 1;
}
.variant-1 .v1-cell-top {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  font-size: 11px;
  letter-spacing: 0.18em;
}
.variant-1 .v1-roman {
  font-weight: 700;
  font-style: italic;
  letter-spacing: 0.04em;
  font-size: 14px;
}
.variant-1 .v1-accession {
  font-weight: 300;
  font-size: 9px;
  letter-spacing: 0.34em;
  color: var(--ink-soft);
  text-transform: uppercase;
}
.variant-1 .v1-title {
  font-weight: 700;
  font-size: clamp(36px, 4.6vw, 68px);
  line-height: 0.95;
  letter-spacing: -0.035em;
  margin: 22px 0 8px;
  text-wrap: balance;
}
.variant-1 .v1-cell-bottom {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.variant-1 .v1-tagline {
  font-weight: 400;
  font-style: italic;
  font-size: 13px;
  letter-spacing: 0.01em;
  color: var(--ink-soft);
}
.variant-1 .v1-filed {
  font-weight: 300;
  font-size: 9px;
  letter-spacing: 0.32em;
  color: var(--ink-soft);
}
.variant-1 .v1-arrow {
  position: absolute;
  right: 18px;
  bottom: 14px;
  font-size: 14px;
  opacity: 0;
  transform: translateX(-6px);
  transition: transform 240ms ease, opacity 240ms ease;
}
.variant-1 .v1-center {
  background: var(--ink);
  color: var(--paper);
  padding: 22px;
  justify-content: space-between;
  align-items: stretch;
}
.variant-1 .v1-center:hover {
  background: var(--accent);
  color: var(--paper);
}
.variant-1 .v1-center-mark {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
}
.variant-1 .v1-octagon {
  width: clamp(140px, 16vw, 220px);
  height: clamp(140px, 16vw, 220px);
  color: var(--paper);
  position: absolute;
  inset: 0;
  margin: auto;
  transition: transform 1.2s cubic-bezier(0.2, 0.7, 0.2, 1);
}
.variant-1 .v1-center:hover .v1-octagon {
  transform: rotate(22.5deg);
}
.variant-1 .v1-center-mono {
  font-weight: 700;
  font-size: clamp(44px, 5.6vw, 84px);
  letter-spacing: -0.03em;
  position: relative;
  z-index: 2;
  font-style: italic;
}
.variant-1 .v1-center-meta {
  display: flex;
  justify-content: space-between;
  font-size: 9px;
  letter-spacing: 0.32em;
  color: var(--paper);
  opacity: 0.7;
}
.variant-1 .v1-foot {
  position: relative;
  z-index: 2;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 10px;
  letter-spacing: 0.28em;
  text-transform: uppercase;
  color: var(--ink-soft);
  border-top: 1px solid var(--rule);
  padding-top: 12px;
}
.variant-1 .v1-foot-mid {
  display: inline-flex;
  align-items: center;
  gap: 10px;
}
.variant-1 .v1-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  background: var(--accent);
  border-radius: 50%;
}
@keyframes v1-fade {
  to { opacity: 1; transform: translateY(0); }
}
@media (max-width: 820px) {
  .variant-1 .v1-grid { min-height: auto; }
  .variant-1 .v1-mast-row { grid-template-columns: 1fr; text-align: center; }
  .variant-1 .v1-mast-row > .v1-mast-meta:first-child,
  .variant-1 .v1-mast-row > .v1-mast-meta:last-child { text-align: center; }
  .variant-1 .v1-title { font-size: 32px; }
  .variant-1 .v1-foot { flex-direction: column; gap: 6px; text-align: center; }
}
`
