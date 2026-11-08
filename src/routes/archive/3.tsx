import { Link, createFileRoute } from '@tanstack/react-router'
import type { SECTIONS } from '#/lib/sections'
import { GRID_ORDER } from '#/lib/sections'

export const Route = createFileRoute('/archive/3')({
  component: ChromaticMaximalist,
})

const PALETTES: Record<string, [string, string, string, string]> = {
  about: ['#ff3a8c', '#ff7a18', '#ffdd00', '#7af6ff'],
  community: ['#7af6ff', '#3a7dff', '#b07aff', '#ff3aef'],
  beliefs: ['#ffdd00', '#ff7a18', '#ff3a8c', '#b07aff'],
  infrastructure: ['#1affd0', '#3a7dff', '#7af6ff', '#cfffd0'],
  research: ['#ff7a18', '#ffdd00', '#1affd0', '#7af6ff'],
  legal: ['#b07aff', '#ff3aef', '#ff3a8c', '#ffdd00'],
  future: ['#3a7dff', '#7af6ff', '#1affd0', '#b07aff'],
  donations: ['#ff3aef', '#ff3a8c', '#ff7a18', '#ffdd00'],
}

function ChromaticMaximalist() {
  return (
    <div className="variant-3">
      <style>{styles}</style>
      <div className="v3-shell">
        <div className="v3-noise" aria-hidden />

        <header className="v3-marquee">
          <div className="v3-marquee-track">
            {Array.from({ length: 4 }).map((_, k) => (
              <span key={k} className="v3-marquee-group">
                <span className="v3-mq-pulse" /> OCTAGON RELIGIOUS RESEARCH
                GROUP &nbsp;//&nbsp; EIGHT FACES OF INQUIRY &nbsp;//&nbsp; ONE
                LIGHT REFRACTED NINE WAYS &nbsp;//&nbsp; TRANSMITTING ON ALL
                FREQUENCIES &nbsp;//&nbsp;
              </span>
            ))}
          </div>
        </header>

        <div className="v3-corner v3-corner-tl">
          <div className="v3-corner-lg">EST.</div>
          <div className="v3-corner-sm">MMXXV</div>
        </div>
        <div className="v3-corner v3-corner-tr">
          <div className="v3-corner-lg">IX</div>
          <div className="v3-corner-sm">PANELS</div>
        </div>
        <div className="v3-corner v3-corner-bl">
          <div className="v3-corner-sm">ALL FREQUENCIES</div>
          <div className="v3-corner-lg">∞</div>
        </div>
        <div className="v3-corner v3-corner-br">
          <div className="v3-corner-sm">NODE</div>
          <div className="v3-corner-lg">0Ω1</div>
        </div>

        <main className="v3-grid">
          {GRID_ORDER.map((entry, i) => {
            const isCenter = entry.id === 'home'
            const delay = i * 70 + 200

            if (isCenter) {
              return (
                <Link
                  key={entry.id}
                  to="/"
                  className="v3-cell v3-cell-center"
                  style={{ animationDelay: `${delay}ms` }}
                >
                  <div className="v3-center-octagon" aria-hidden />
                  <div className="v3-center-text">
                    <span className="v3-tiny">RETURN</span>
                    <span className="v3-mark v3-mark-rgb">
                      <span data-l="ORG">ORG</span>
                      <span data-l="ORG">ORG</span>
                      <span data-l="ORG">ORG</span>
                    </span>
                    <span className="v3-tiny">PRINCIPAL</span>
                  </div>
                </Link>
              )
            }

            const s = entry as (typeof SECTIONS)[number]
            const p = PALETTES[s.id]
            const styleVars = {
              '--p0': p[0],
              '--p1': p[1],
              '--p2': p[2],
              '--p3': p[3],
              animationDelay: `${delay}ms`,
            } as React.CSSProperties
            return (
              <Link
                key={s.id}
                to={s.href}
                className="v3-cell"
                style={styleVars}
                data-id={s.id}
              >
                <div className="v3-cell-bg" aria-hidden />
                <div className="v3-cell-top">
                  <span className="v3-roman">{s.roman}</span>
                  <span className="v3-spark">◆</span>
                </div>
                <h2 className="v3-title">
                  <span className="v3-glitch" data-text={s.label.toUpperCase()}>
                    {s.label.toUpperCase()}
                  </span>
                </h2>
                <div className="v3-cell-bot">
                  <span className="v3-tagline">{s.tagline}</span>
                  <span className="v3-go">ENTER&nbsp;→</span>
                </div>
              </Link>
            )
          })}
        </main>

        <footer className="v3-foot">
          <span className="v3-foot-l">SIGNAL // OPEN</span>
          <span className="v3-foot-c">
            <span className="v3-pulse" /> BROADCAST ACTIVE
          </span>
          <span className="v3-foot-r">SET IN HELVETICA</span>
        </footer>
      </div>
    </div>
  )
}

const styles = `
.variant-3 {
  --bg: #050307;
  --fg: #f6f4ff;
  --dim: #6a637a;
  font-family: var(--font-helvetica);
  color: var(--fg);
  background: radial-gradient(120% 100% at 50% 0%, #0c0717 0%, #050307 60%);
  min-height: 100vh;
  width: 100%;
  position: relative;
  overflow: hidden;
  cursor: crosshair;
}
.variant-3 .v3-shell {
  position: relative;
  min-height: 100vh;
  padding: 14px clamp(16px, 3vw, 36px) 22px;
  display: grid;
  grid-template-rows: auto 1fr auto;
  gap: 14px;
  z-index: 1;
}
.variant-3 .v3-noise {
  position: absolute; inset: 0;
  pointer-events: none;
  opacity: 0.08;
  mix-blend-mode: screen;
  background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='2.6' numOctaves='2' seed='5'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>");
}
.variant-3 .v3-marquee {
  position: relative;
  z-index: 4;
  overflow: hidden;
  padding: 10px 0;
  border-top: 1px solid rgba(246,244,255,0.12);
  border-bottom: 1px solid rgba(246,244,255,0.12);
  background: linear-gradient(90deg, rgba(255,58,140,0.04), rgba(58,125,255,0.04), rgba(26,255,208,0.04));
  white-space: nowrap;
}
.variant-3 .v3-marquee-track {
  display: inline-flex;
  gap: 32px;
  animation: v3-mq 38s linear infinite;
  will-change: transform;
}
.variant-3 .v3-marquee-group {
  font-weight: 300;
  font-size: 12px;
  letter-spacing: 0.42em;
  color: var(--fg);
  display: inline-flex;
  align-items: center;
  gap: 14px;
}
.variant-3 .v3-mq-pulse {
  display: inline-block;
  width: 8px; height: 8px; border-radius: 50%;
  background: conic-gradient(from 0deg, #ff3a8c, #ffdd00, #1affd0, #3a7dff, #b07aff, #ff3aef, #ff3a8c);
  animation: v3-spin 5s linear infinite;
}
.variant-3 .v3-corner {
  position: absolute;
  z-index: 3;
  pointer-events: none;
  display: flex;
  flex-direction: column;
  font-weight: 300;
  letter-spacing: 0.36em;
}
.variant-3 .v3-corner-tl { left: clamp(16px,3vw,36px); top: 70px; }
.variant-3 .v3-corner-tr { right: clamp(16px,3vw,36px); top: 70px; align-items: flex-end; }
.variant-3 .v3-corner-bl { left: clamp(16px,3vw,36px); bottom: 56px; }
.variant-3 .v3-corner-br { right: clamp(16px,3vw,36px); bottom: 56px; align-items: flex-end; }
.variant-3 .v3-corner-lg {
  font-family: var(--font-helvetica);
  font-weight: 900;
  font-style: italic;
  font-size: clamp(28px, 4vw, 56px);
  letter-spacing: -0.02em;
  background: linear-gradient(90deg, #ff3a8c, #ffdd00, #1affd0, #3a7dff, #b07aff);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  line-height: 1;
}
.variant-3 .v3-corner-sm {
  font-size: 9px;
  letter-spacing: 0.6em;
  color: var(--dim);
  text-transform: uppercase;
}
.variant-3 .v3-grid {
  position: relative;
  z-index: 2;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  grid-template-rows: repeat(3, 1fr);
  gap: 10px;
  min-height: clamp(560px, 70vh, 820px);
  margin: 0 auto;
  width: min(100%, 1280px);
}
.variant-3 .v3-cell {
  position: relative;
  overflow: hidden;
  text-decoration: none;
  color: var(--fg);
  background: #0a0612;
  border: 1px solid rgba(246,244,255,0.08);
  padding: 16px 18px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  opacity: 0;
  transform: translateY(14px) scale(0.985);
  animation: v3-in 700ms cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
  isolation: isolate;
}
.variant-3 .v3-cell-bg {
  position: absolute;
  inset: -20%;
  background:
    conic-gradient(from 90deg at 50% 50%, var(--p0), var(--p1), var(--p2), var(--p3), var(--p0));
  filter: blur(28px) saturate(140%);
  opacity: 0.55;
  animation: v3-rot 18s linear infinite;
  z-index: -1;
  transition: opacity 320ms ease, filter 320ms ease, transform 420ms ease;
}
.variant-3 .v3-cell::after {
  content: "";
  position: absolute;
  inset: 0;
  background:
    radial-gradient(120% 80% at 20% 20%, rgba(255,255,255,0.08), transparent 60%),
    linear-gradient(180deg, rgba(5,3,7,0.55), rgba(5,3,7,0.78));
  z-index: -1;
  pointer-events: none;
}
.variant-3 .v3-cell:hover .v3-cell-bg { opacity: 0.95; filter: blur(14px) saturate(180%); transform: scale(1.06); }
.variant-3 .v3-cell:hover { border-color: rgba(246,244,255,0.4); }
.variant-3 .v3-cell-top {
  display: flex; justify-content: space-between; align-items: center;
  font-size: 10px; letter-spacing: 0.36em; color: rgba(246,244,255,0.7);
}
.variant-3 .v3-roman { font-weight: 700; font-style: italic; letter-spacing: 0.08em; font-size: 13px; }
.variant-3 .v3-spark { color: var(--p0); font-size: 12px; }
.variant-3 .v3-title {
  margin: 8px 0;
  line-height: 0.9;
  font-weight: 900;
  font-size: clamp(28px, 3.6vw, 56px);
  letter-spacing: -0.02em;
}
.variant-3 .v3-glitch {
  position: relative;
  display: inline-block;
  color: var(--fg);
}
.variant-3 .v3-glitch::before,
.variant-3 .v3-glitch::after {
  content: attr(data-text);
  position: absolute;
  inset: 0;
  pointer-events: none;
  mix-blend-mode: screen;
}
.variant-3 .v3-glitch::before {
  color: #ff3aef;
  transform: translate(-1.5px, 0);
  opacity: 0.85;
}
.variant-3 .v3-glitch::after {
  color: #1affd0;
  transform: translate(1.5px, 0);
  opacity: 0.85;
}
.variant-3 .v3-cell:hover .v3-glitch::before { animation: v3-jit-a 600ms steps(6) infinite; }
.variant-3 .v3-cell:hover .v3-glitch::after  { animation: v3-jit-b 600ms steps(6) infinite; }
.variant-3 .v3-cell-bot {
  display: flex; justify-content: space-between; align-items: flex-end;
  font-size: 11px; gap: 12px;
}
.variant-3 .v3-tagline {
  font-style: italic; font-weight: 300;
  letter-spacing: 0.04em; max-width: 22ch;
  color: rgba(246,244,255,0.78);
  line-height: 1.3;
}
.variant-3 .v3-go {
  font-weight: 700; letter-spacing: 0.36em; font-size: 10px;
  white-space: nowrap;
}
.variant-3 .v3-cell-center {
  background: #050307;
  border-color: rgba(246,244,255,0.4);
  display: flex; align-items: center; justify-content: center;
  overflow: hidden;
}
.variant-3 .v3-cell-center::after { content: none; }
.variant-3 .v3-center-octagon {
  position: absolute;
  inset: 6%;
  background:
    conic-gradient(from 0deg,
      #ff3a8c 0%, #ff7a18 12%, #ffdd00 25%, #1affd0 38%,
      #3a7dff 50%, #b07aff 62%, #ff3aef 75%, #ff3a8c 100%);
  clip-path: polygon(29.3% 0, 70.7% 0, 100% 29.3%, 100% 70.7%, 70.7% 100%, 29.3% 100%, 0 70.7%, 0 29.3%);
  filter: saturate(160%) blur(0.4px);
  animation: v3-spin 14s linear infinite;
}
.variant-3 .v3-center-octagon::after {
  content: "";
  position: absolute;
  inset: 6%;
  background: #050307;
  clip-path: polygon(29.3% 0, 70.7% 0, 100% 29.3%, 100% 70.7%, 70.7% 100%, 29.3% 100%, 0 70.7%, 0 29.3%);
}
.variant-3 .v3-center-text {
  position: relative;
  z-index: 2;
  display: flex; flex-direction: column; align-items: center; gap: 8px;
  text-align: center;
}
.variant-3 .v3-tiny {
  font-size: 9px; letter-spacing: 0.6em; color: rgba(246,244,255,0.7);
}
.variant-3 .v3-mark {
  position: relative;
  font-weight: 900;
  font-style: italic;
  font-size: clamp(46px, 5.6vw, 86px);
  letter-spacing: -0.04em;
  line-height: 1;
  height: 1em;
}
.variant-3 .v3-mark-rgb span {
  position: absolute;
  inset: 0;
  display: inline-block;
  mix-blend-mode: screen;
}
.variant-3 .v3-mark-rgb span:nth-child(1) { color: #ff3a8c; transform: translate(-2.5px, 0); }
.variant-3 .v3-mark-rgb span:nth-child(2) { color: #ffdd00; transform: translate(0, 0); }
.variant-3 .v3-mark-rgb span:nth-child(3) { color: #1affd0; transform: translate(2.5px, 0); }
.variant-3 .v3-cell-center:hover .v3-mark-rgb span:nth-child(1) { animation: v3-jit-a 400ms steps(4) infinite; }
.variant-3 .v3-cell-center:hover .v3-mark-rgb span:nth-child(3) { animation: v3-jit-b 400ms steps(4) infinite; }
.variant-3 .v3-foot {
  position: relative;
  z-index: 3;
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  font-size: 10px;
  letter-spacing: 0.4em;
  color: var(--dim);
  text-transform: uppercase;
}
.variant-3 .v3-foot-l { text-align: left; }
.variant-3 .v3-foot-r { text-align: right; color: var(--fg); }
.variant-3 .v3-foot-c { color: var(--fg); display: inline-flex; align-items: center; gap: 8px; }
.variant-3 .v3-pulse {
  width: 8px; height: 8px; border-radius: 50%;
  background: #1affd0;
  box-shadow: 0 0 12px #1affd0;
  animation: v3-blink 1.2s ease-in-out infinite;
}
@keyframes v3-mq { from { transform: translateX(0); } to { transform: translateX(-50%); } }
@keyframes v3-rot { to { transform: rotate(360deg); } }
@keyframes v3-spin { to { transform: rotate(360deg); } }
@keyframes v3-in { to { opacity: 1; transform: translateY(0) scale(1); } }
@keyframes v3-blink { 50% { opacity: 0.35; } }
@keyframes v3-jit-a { 0%,100% { transform: translate(-1.5px,0);} 20%{transform:translate(-3px,1px);} 40%{transform:translate(-1px,-1px);} 60%{transform:translate(-2px,0);} 80%{transform:translate(-3px,0.5px);} }
@keyframes v3-jit-b { 0%,100% { transform: translate(1.5px,0);} 20%{transform:translate(3px,-1px);} 40%{transform:translate(1px,1px);} 60%{transform:translate(2px,0);} 80%{transform:translate(3px,-0.5px);} }
@media (max-width: 820px) {
  .variant-3 .v3-corner { display: none; }
  .variant-3 .v3-title { font-size: 26px; }
  .variant-3 .v3-grid { gap: 6px; }
  .variant-3 .v3-foot { grid-template-columns: 1fr; gap: 6px; text-align: center; }
  .variant-3 .v3-foot-l, .variant-3 .v3-foot-r { text-align: center; }
}
`
