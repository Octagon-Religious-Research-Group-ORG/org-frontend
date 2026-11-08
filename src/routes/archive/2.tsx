import { Link, createFileRoute } from '@tanstack/react-router'
import type { SECTIONS } from '#/lib/sections'
import { GRID_ORDER } from '#/lib/sections'
import { svgCoord } from '#/lib/svg'

export const Route = createFileRoute('/archive/2')({
  component: SacredGeometry,
})

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

function SacredGeometry() {
  const cx = 500
  const cy = 500

  return (
    <div className="variant-2">
      <style>{styles}</style>
      <div className="v2-shell">
        <div className="v2-vignette" aria-hidden />
        <div className="v2-grain" aria-hidden />

        <svg className="v2-mandala" viewBox="0 0 1000 1000" aria-hidden>
          <g className="v2-rings">
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
          <g className="v2-rays">
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

        <header className="v2-header">
          <div className="v2-tag v2-tag-l">
            <span>NODE&nbsp;·&nbsp;0001</span>
            <span>OCTAGON</span>
          </div>
          <div className="v2-tag v2-tag-c">
            <span className="v2-hair" />
            <span>RELIGIOUS RESEARCH GROUP</span>
            <span className="v2-hair" />
          </div>
          <div className="v2-tag v2-tag-r">
            <span>LAT. 41°N</span>
            <span>LON. 74°W</span>
          </div>
        </header>

        <main className="v2-grid">
          {GRID_ORDER.map((entry, i) => {
            const isCenter = entry.id === 'home'
            const row = Math.floor(i / 3)
            const col = i % 3
            const order = [0, 1, 2, 5, 8, 7, 6, 3].indexOf(i)
            const delay = isCenter
              ? 2200
              : 1600 + (order >= 0 ? order : 0) * 110

            if (isCenter) {
              return (
                <Link
                  key={entry.id}
                  to="/"
                  className="v2-cell v2-cell-center"
                  style={{ animationDelay: `${delay}ms` }}
                >
                  <div className="v2-center-inner">
                    <svg
                      viewBox="-50 -50 100 100"
                      className="v2-wheel"
                      aria-hidden
                    >
                      <defs>
                        <linearGradient id="v2grad" x1="0" y1="0" x2="1" y2="1">
                          <stop offset="0" stopColor="#f6efd9" />
                          <stop offset="1" stopColor="#9e8e6c" />
                        </linearGradient>
                      </defs>
                      {Array.from({ length: 8 }).map((_, k) => {
                        const a1 = (Math.PI / 4) * k - Math.PI / 8
                        const a2 = (Math.PI / 4) * (k + 1) - Math.PI / 8
                        const x1 = svgCoord(Math.cos(a1) * 44)
                        const y1 = svgCoord(Math.sin(a1) * 44)
                        const x2 = svgCoord(Math.cos(a2) * 44)
                        const y2 = svgCoord(Math.sin(a2) * 44)
                        const shade = 0.18 + (k / 8) * 0.7
                        return (
                          <polygon
                            key={k}
                            points={`0,0 ${x1},${y1} ${x2},${y2}`}
                            fill={`rgba(232,224,206,${shade})`}
                            stroke="rgba(11,13,18,0.6)"
                            strokeWidth="0.6"
                          />
                        )
                      })}
                      <polygon
                        points={octagonPoints(0, 0, 44)}
                        fill="none"
                        stroke="rgba(232,224,206,0.9)"
                        strokeWidth="0.8"
                      />
                    </svg>
                    <div className="v2-center-mark">ORG</div>
                  </div>
                  <span className="v2-center-cap">RETURN TO THE PRINCIPAL</span>
                </Link>
              )
            }

            const s = entry as (typeof SECTIONS)[number]
            return (
              <Link
                key={s.id}
                to={s.href}
                className="v2-cell"
                style={{ animationDelay: `${delay}ms` }}
                data-row={row}
                data-col={col}
              >
                <div className="v2-cell-inner">
                  <span className="v2-roman">{s.roman}</span>
                  <h2 className="v2-title">{s.label}</h2>
                  <span className="v2-line" />
                  <span className="v2-tagline">{s.tagline}</span>
                </div>
              </Link>
            )
          })}
        </main>

        <footer className="v2-foot">
          <span>BEARING&nbsp;·&nbsp;NNE</span>
          <span className="v2-foot-c">
            EIGHT POINTS &middot; ONE CENTER &middot; INFINITE INQUIRY
          </span>
          <span>LUMEN&nbsp;·&nbsp;0.34</span>
        </footer>
      </div>
    </div>
  )
}

const styles = `
.variant-2 {
  --ink: #0b0d12;
  --bone: #ece2c4;
  --bone-soft: #b8ad8d;
  --bone-dim: #5e573f;
  --amber: #d4a24a;
  font-family: var(--font-helvetica);
  color: var(--bone);
  background: var(--ink);
  min-height: 100vh;
  width: 100%;
  position: relative;
  overflow-x: hidden;
}
.variant-2 .v2-shell {
  position: relative;
  min-height: 100vh;
  padding: 28px clamp(20px, 4vw, 56px) 24px;
  display: grid;
  grid-template-rows: auto 1fr auto;
  gap: 22px;
}
.variant-2 .v2-vignette {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background:
    radial-gradient(60% 50% at 50% 52%, rgba(212,162,74,0.07), transparent 60%),
    radial-gradient(80% 70% at 50% 50%, rgba(236,226,196,0.04), transparent 65%);
}
.variant-2 .v2-grain {
  position: absolute;
  inset: 0;
  pointer-events: none;
  opacity: 0.08;
  mix-blend-mode: overlay;
  background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='240' height='240'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='1.8' numOctaves='2' seed='3'/></filter><rect width='100%' height='100%' filter='url(%23n)' opacity='0.7'/></svg>");
}
.variant-2 .v2-mandala {
  position: absolute;
  width: min(95vmin, 1100px);
  height: min(95vmin, 1100px);
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  pointer-events: none;
}
.variant-2 .v2-header {
  position: relative;
  z-index: 3;
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: 24px;
  font-size: 10px;
  letter-spacing: 0.36em;
}
.variant-2 .v2-tag {
  display: flex;
  gap: 18px;
  color: var(--bone-soft);
}
.variant-2 .v2-tag-l { justify-content: flex-start; }
.variant-2 .v2-tag-r { justify-content: flex-end; }
.variant-2 .v2-tag-c {
  align-items: center;
  font-weight: 400;
  color: var(--bone);
  font-style: italic;
  letter-spacing: 0.42em;
  font-size: 11px;
}
.variant-2 .v2-hair {
  display: inline-block;
  width: 56px;
  height: 1px;
  background: linear-gradient(90deg, transparent, var(--bone-soft), transparent);
}
.variant-2 .v2-grid {
  position: relative;
  z-index: 3;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  grid-template-rows: repeat(3, 1fr);
  gap: clamp(16px, 2vw, 30px);
  align-items: center;
  justify-items: center;
  min-height: clamp(540px, 70vh, 820px);
}
.variant-2 .v2-cell {
  width: 100%;
  height: 100%;
  aspect-ratio: 1 / 1;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  text-decoration: none;
  color: var(--bone);
  clip-path: polygon(29.3% 0, 70.7% 0, 100% 29.3%, 100% 70.7%, 70.7% 100%, 29.3% 100%, 0 70.7%, 0 29.3%);
  background: linear-gradient(140deg, rgba(28,30,38,0.92), rgba(15,17,22,0.92));
  border: 0;
  outline: 1px solid rgba(232,226,196,0.16);
  outline-offset: -1px;
  opacity: 0;
  transform: scale(0.92);
  animation: v2-pop 900ms cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
  transition: background 320ms ease, color 320ms ease, transform 320ms ease;
}
.variant-2 .v2-cell:hover {
  background: linear-gradient(140deg, rgba(236,226,196,0.96), rgba(212,162,74,0.88));
  color: var(--ink);
  transform: scale(1.02);
}
.variant-2 .v2-cell-inner {
  width: 78%;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}
.variant-2 .v2-roman {
  font-weight: 200;
  font-size: 11px;
  letter-spacing: 0.6em;
  color: var(--bone-soft);
  transition: color 320ms ease;
}
.variant-2 .v2-cell:hover .v2-roman { color: var(--ink); opacity: 0.7; }
.variant-2 .v2-title {
  font-weight: 200;
  font-size: clamp(20px, 2.2vw, 32px);
  letter-spacing: 0.32em;
  text-transform: uppercase;
  margin: 0;
  line-height: 1.05;
}
.variant-2 .v2-line {
  display: block;
  width: 28px;
  height: 1px;
  background: var(--bone-soft);
  margin: 4px 0;
  transition: background 320ms ease;
}
.variant-2 .v2-cell:hover .v2-line { background: var(--ink); }
.variant-2 .v2-tagline {
  font-style: italic;
  font-weight: 300;
  font-size: 11px;
  letter-spacing: 0.06em;
  color: var(--bone-soft);
  text-transform: none;
  max-width: 22ch;
  line-height: 1.4;
  transition: color 320ms ease;
}
.variant-2 .v2-cell:hover .v2-tagline { color: rgba(11,13,18,0.78); }
.variant-2 .v2-cell-center {
  background: radial-gradient(circle at 50% 50%, rgba(232,226,196,0.18), rgba(11,13,18,0.95));
  outline-color: rgba(236,226,196,0.4);
}
.variant-2 .v2-cell-center:hover {
  background: radial-gradient(circle at 50% 50%, rgba(232,226,196,0.4), rgba(11,13,18,0.9));
  color: var(--bone);
  transform: scale(1.02);
}
.variant-2 .v2-center-inner {
  position: relative;
  width: 78%;
  display: flex;
  align-items: center;
  justify-content: center;
}
.variant-2 .v2-wheel {
  width: clamp(140px, 14vw, 220px);
  height: clamp(140px, 14vw, 220px);
  animation: v2-rotate 28s linear infinite;
}
.variant-2 .v2-center-mark {
  position: absolute;
  font-weight: 100;
  font-size: clamp(22px, 2vw, 30px);
  letter-spacing: 0.42em;
  color: var(--bone);
  background: var(--ink);
  padding: 6px 14px;
  border: 1px solid var(--bone-soft);
}
.variant-2 .v2-center-cap {
  position: absolute;
  bottom: 14%;
  font-size: 9px;
  letter-spacing: 0.5em;
  color: var(--bone-soft);
  text-transform: uppercase;
}
.variant-2 .v2-foot {
  position: relative;
  z-index: 3;
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  font-size: 9px;
  letter-spacing: 0.4em;
  color: var(--bone-dim);
  text-transform: uppercase;
}
.variant-2 .v2-foot > :first-child { text-align: left; }
.variant-2 .v2-foot > :last-child { text-align: right; }
.variant-2 .v2-foot-c { color: var(--bone-soft); font-style: italic; letter-spacing: 0.46em; }
@keyframes v2-draw {
  to { stroke-dashoffset: 0; }
}
@keyframes v2-pop {
  to { opacity: 1; transform: scale(1); }
}
@keyframes v2-rotate {
  to { transform: rotate(360deg); }
}
@media (max-width: 820px) {
  .variant-2 .v2-header { grid-template-columns: 1fr; text-align: center; gap: 8px; }
  .variant-2 .v2-tag-l, .variant-2 .v2-tag-r { justify-content: center; }
  .variant-2 .v2-title { font-size: 16px; letter-spacing: 0.22em; }
  .variant-2 .v2-grid { gap: 12px; }
  .variant-2 .v2-foot { grid-template-columns: 1fr; text-align: center; gap: 6px; }
  .variant-2 .v2-foot > :first-child, .variant-2 .v2-foot > :last-child { text-align: center; }
}
`
