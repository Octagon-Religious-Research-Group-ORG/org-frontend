import { Link, createFileRoute } from '@tanstack/react-router'
import type { SECTIONS } from '#/lib/sections'
import { GRID_ORDER } from '#/lib/sections'

export const Route = createFileRoute('/archive/5')({
  component: BureauTerminal,
})

const STATUS: Record<string, string> = {
  about: 'OPEN',
  community: 'OPEN',
  beliefs: 'RESTRICTED',
  infrastructure: 'OPEN',
  research: 'CONFIDENTIAL',
  legal: 'RESTRICTED',
  future: 'CLASSIFIED',
  donations: 'OPEN',
}

function BureauTerminal() {
  const ts = '2025.11.07 // 03:14:17'

  return (
    <div className="variant-5">
      <style>{styles}</style>
      <div className="v5-crt">
        <div className="v5-scan" aria-hidden />
        <div className="v5-flicker" aria-hidden />
        <div className="v5-shell">
          <header className="v5-prompt">
            <div className="v5-prompt-line">
              <span className="v5-user">root@orgnet</span>
              <span className="v5-sep">:</span>
              <span className="v5-path">~/octagon</span>
              <span className="v5-sep">$</span>
              <span className="v5-cmd">
                <span className="v5-typed">
                  orgnet --boot --node=octagon --grid=3x3
                </span>
                <span className="v5-caret">█</span>
              </span>
            </div>
            <div className="v5-boot">
              <div>[ OK ] mounting /dev/octagon ……………………………… ready</div>
              <div>[ OK ] verifying nine panels …………………………… verified</div>
              <div>[ OK ] aligning bearings to true north ………………… 0.000°</div>
              <div>[ OK ] phosphor warm: 64°C — flicker nominal</div>
              <div>[ OK ] timestamp synced &nbsp;{ts}</div>
              <div className="v5-boot-final">
                [ READY ] Octagon Religious Research Group · NODE 0001
              </div>
            </div>
          </header>

          <main className="v5-grid">
            {GRID_ORDER.map((entry, i) => {
              const isCenter = entry.id === 'home'
              const delay = 1400 + i * 80

              if (isCenter) {
                return (
                  <Link
                    key={entry.id}
                    to="/"
                    className="v5-cell v5-cell-center"
                    style={{ animationDelay: `${delay}ms` }}
                  >
                    <div className="v5-cell-frame">
                      <div className="v5-cell-head">
                        <span>┌─[ NODE.IX ]</span>
                        <span>[ ROOT ]─┐</span>
                      </div>
                      <div className="v5-center-art" aria-hidden>
                        {`     █████   ██████   █████
    ██   ██  ██   ██  ██
    ██   ██  ██████   ██  ██
    ██   ██  ██   ██  ██   ██
     █████   ██   ██   █████ `}
                      </div>
                      <div className="v5-center-cap">
                        RETURN TO PRINCIPAL // /
                      </div>
                      <div className="v5-cell-foot">
                        <span>└─</span>
                        <span>─┘</span>
                      </div>
                    </div>
                  </Link>
                )
              }

              const s = entry as (typeof SECTIONS)[number]
              const status = STATUS[s.id] || 'OPEN'
              return (
                <Link
                  key={s.id}
                  to={s.href}
                  className="v5-cell"
                  style={{ animationDelay: `${delay}ms` }}
                  data-status={status.toLowerCase()}
                >
                  <div className="v5-cell-frame">
                    <div className="v5-cell-head">
                      <span>┌─[ {s.roman} ]</span>
                      <span>[ {status} ]─┐</span>
                    </div>
                    <div className="v5-cell-body">
                      <div className="v5-file">
                        FILE://ORG/{s.id.toUpperCase()}.dat
                      </div>
                      <h2 className="v5-title">
                        {s.label}
                        <span className="v5-caret v5-caret-inline">_</span>
                      </h2>
                      <div className="v5-tagline">&gt; {s.tagline}</div>
                      <div className="v5-meta">
                        <span>BYTES &nbsp;0x{s.numeral}A4F</span>
                        <span>{s.accession}</span>
                      </div>
                    </div>
                    <div className="v5-access">
                      [ access requires authorization ]
                    </div>
                    <div className="v5-cell-foot">
                      <span>└─</span>
                      <span>─┘</span>
                    </div>
                  </div>
                </Link>
              )
            })}
          </main>

          <footer className="v5-foot">
            <span>$ uptime: 008d 14h 22m</span>
            <span className="v5-foot-c">
              <span className="v5-blink">▓</span> connection: secure / phosphor
              channel
            </span>
            <span>set -- helvetica · neue · 12pt</span>
          </footer>
        </div>
      </div>
    </div>
  )
}

const styles = `
.variant-5 {
  --bg: #06120a;
  --bg-deep: #030806;
  --p: #9aff9b;
  --p-soft: #5fb262;
  --p-dim: #2c5a2e;
  --warn: #ffd76b;
  --hot: #ff8e6b;
  font-family: var(--font-helvetica);
  color: var(--p);
  background: var(--bg-deep);
  min-height: 100vh;
  width: 100%;
  position: relative;
  overflow: hidden;
}
.variant-5 .v5-crt {
  min-height: 100vh;
  position: relative;
  background:
    radial-gradient(120% 90% at 50% 50%, rgba(154,255,155,0.05), transparent 60%),
    radial-gradient(80% 60% at 50% 50%, var(--bg) 0%, var(--bg-deep) 80%);
  overflow: hidden;
}
.variant-5 .v5-scan {
  position: absolute; inset: 0;
  pointer-events: none;
  background: repeating-linear-gradient(
    to bottom,
    rgba(154,255,155,0.04) 0px,
    rgba(154,255,155,0.04) 1px,
    transparent 1px,
    transparent 3px
  );
  z-index: 5;
}
.variant-5 .v5-flicker {
  position: absolute; inset: 0;
  pointer-events: none;
  background: rgba(154,255,155,0.02);
  animation: v5-flicker 3.6s steps(8) infinite;
  z-index: 4;
}
.variant-5 .v5-shell {
  position: relative; z-index: 1;
  min-height: 100vh;
  padding: 22px clamp(18px, 3vw, 40px) 20px;
  display: grid;
  grid-template-rows: auto 1fr auto;
  gap: 18px;
}
.variant-5 .v5-prompt {
  font-weight: 400;
  font-size: 12px;
  letter-spacing: 0.04em;
  color: var(--p);
  text-shadow: 0 0 6px rgba(154,255,155,0.45);
  line-height: 1.5;
}
.variant-5 .v5-prompt-line { display: flex; gap: 6px; align-items: baseline; flex-wrap: wrap; }
.variant-5 .v5-user { color: var(--warn); font-weight: 700; }
.variant-5 .v5-path { color: var(--p-soft); }
.variant-5 .v5-sep { color: var(--p-dim); }
.variant-5 .v5-cmd { color: var(--p); display: inline-flex; align-items: baseline; gap: 4px; font-weight: 700; }
.variant-5 .v5-typed {
  display: inline-block;
  overflow: hidden;
  white-space: nowrap;
  animation: v5-type 1100ms steps(40, end) forwards;
  width: 0ch;
}
.variant-5 .v5-caret {
  display: inline-block;
  animation: v5-blink 1s steps(2) infinite;
  color: var(--p);
}
.variant-5 .v5-boot {
  margin-top: 6px;
  color: var(--p-soft);
  font-size: 11px;
  letter-spacing: 0.02em;
  display: flex; flex-direction: column; gap: 1px;
}
.variant-5 .v5-boot > div {
  opacity: 0;
  animation: v5-line 200ms ease-out forwards;
}
.variant-5 .v5-boot > div:nth-child(1) { animation-delay: 1100ms; }
.variant-5 .v5-boot > div:nth-child(2) { animation-delay: 1200ms; }
.variant-5 .v5-boot > div:nth-child(3) { animation-delay: 1300ms; }
.variant-5 .v5-boot > div:nth-child(4) { animation-delay: 1400ms; }
.variant-5 .v5-boot > div:nth-child(5) { animation-delay: 1500ms; }
.variant-5 .v5-boot > div:nth-child(6) { animation-delay: 1600ms; }
.variant-5 .v5-boot-final { color: var(--p) !important; font-weight: 700; }
.variant-5 .v5-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  grid-template-rows: repeat(3, 1fr);
  gap: 8px;
  min-height: clamp(540px, 64vh, 760px);
}
.variant-5 .v5-cell {
  text-decoration: none;
  color: var(--p);
  position: relative;
  background: rgba(0,12,4,0.6);
  padding: 0;
  display: block;
  opacity: 0;
  transform: translateY(8px);
  animation: v5-line 400ms ease-out forwards;
  transition: background 200ms ease, color 200ms ease;
}
.variant-5 .v5-cell:hover {
  background: var(--p);
  color: var(--bg);
}
.variant-5 .v5-cell:hover .v5-tagline,
.variant-5 .v5-cell:hover .v5-file,
.variant-5 .v5-cell:hover .v5-meta,
.variant-5 .v5-cell:hover .v5-access,
.variant-5 .v5-cell:hover .v5-cell-head,
.variant-5 .v5-cell:hover .v5-cell-foot {
  color: var(--bg);
}
.variant-5 .v5-cell:hover .v5-access::after {
  content: " // ACCESS GRANTED";
  color: var(--bg);
  font-weight: 700;
}
.variant-5 .v5-cell-frame {
  height: 100%;
  display: flex; flex-direction: column;
  padding: 10px 14px;
  font-size: 11px;
  line-height: 1.5;
  text-shadow: 0 0 5px rgba(154,255,155,0.35);
}
.variant-5 .v5-cell:hover .v5-cell-frame { text-shadow: none; }
.variant-5 .v5-cell-head, .variant-5 .v5-cell-foot {
  display: flex; justify-content: space-between;
  font-size: 10px; letter-spacing: 0.06em;
  color: var(--p-soft);
}
.variant-5 .v5-cell[data-status="restricted"] .v5-cell-head > :last-child { color: var(--warn); }
.variant-5 .v5-cell[data-status="confidential"] .v5-cell-head > :last-child { color: var(--hot); }
.variant-5 .v5-cell[data-status="classified"] .v5-cell-head > :last-child { color: var(--hot); font-weight: 700; }
.variant-5 .v5-cell-body {
  flex: 1;
  display: flex; flex-direction: column;
  justify-content: center;
  padding: 10px 4px;
  gap: 6px;
}
.variant-5 .v5-file {
  font-size: 9px; letter-spacing: 0.18em;
  color: var(--p-soft);
  text-transform: uppercase;
}
.variant-5 .v5-title {
  margin: 0;
  font-weight: 700;
  font-size: clamp(22px, 2.6vw, 36px);
  letter-spacing: -0.005em;
  line-height: 1;
  display: inline-flex;
  align-items: baseline;
  gap: 4px;
}
.variant-5 .v5-caret-inline {
  font-weight: 400; font-size: 0.6em; color: var(--warn);
  text-shadow: 0 0 8px rgba(255,215,107,0.7);
}
.variant-5 .v5-tagline {
  font-size: 11px;
  color: var(--p-soft);
  font-style: italic;
}
.variant-5 .v5-meta {
  display: flex; justify-content: space-between;
  font-size: 9px; letter-spacing: 0.18em;
  color: var(--p-dim);
  text-transform: uppercase;
  margin-top: 4px;
}
.variant-5 .v5-access {
  font-size: 9px; letter-spacing: 0.16em;
  color: var(--p-dim);
  text-align: center;
  padding: 4px 0;
  text-transform: uppercase;
}
.variant-5 .v5-cell-center {
  background: rgba(0,16,6,0.85);
  outline: 1px dashed var(--p-soft);
  outline-offset: -3px;
}
.variant-5 .v5-cell-center:hover { background: var(--p); color: var(--bg); }
.variant-5 .v5-center-art {
  font-family: 'Consolas', 'Menlo', monospace;
  white-space: pre;
  font-size: clamp(8px, 0.9vw, 11px);
  line-height: 1.05;
  color: var(--p);
  text-shadow: 0 0 8px rgba(154,255,155,0.7);
  text-align: center;
  padding: 12px 0;
  margin: auto 0;
}
.variant-5 .v5-cell-center:hover .v5-center-art { color: var(--bg); text-shadow: none; }
.variant-5 .v5-center-cap {
  text-align: center;
  font-size: 10px; letter-spacing: 0.32em;
  color: var(--p-soft);
}
.variant-5 .v5-foot {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  font-size: 10px;
  letter-spacing: 0.12em;
  color: var(--p-soft);
  text-shadow: 0 0 4px rgba(154,255,155,0.3);
}
.variant-5 .v5-foot > :first-child { text-align: left; }
.variant-5 .v5-foot > :last-child { text-align: right; }
.variant-5 .v5-foot-c { color: var(--p); display: inline-flex; align-items: center; gap: 6px; }
.variant-5 .v5-blink { color: var(--p); animation: v5-blink 1s steps(2) infinite; }
@keyframes v5-flicker {
  0%, 100% { opacity: 0.4; }
  50% { opacity: 0.7; }
}
@keyframes v5-blink {
  50% { opacity: 0; }
}
@keyframes v5-type {
  to { width: 38ch; }
}
@keyframes v5-line {
  to { opacity: 1; transform: translateY(0); }
}
@media (max-width: 820px) {
  .variant-5 .v5-grid { gap: 4px; }
  .variant-5 .v5-title { font-size: 20px; }
  .variant-5 .v5-cell-frame { padding: 8px 10px; font-size: 10px; }
  .variant-5 .v5-foot { grid-template-columns: 1fr; gap: 4px; text-align: center; }
  .variant-5 .v5-foot > :first-child, .variant-5 .v5-foot > :last-child { text-align: center; }
}
`
