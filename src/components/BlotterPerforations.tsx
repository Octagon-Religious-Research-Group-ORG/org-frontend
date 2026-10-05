import type { CSSProperties } from 'react'

type BlotterPerforationsProps = {
  /** Number of art tiles across. */
  cols: number
  /** Number of art tiles down. */
  rows: number
  /** Small blotter "tabs" printed across each art tile, in each direction. */
  tabsPerCell?: number
  /** Colour of the fine perforations between the small tabs. */
  perfColor?: string
  /** Colour of the stronger tear lines between art tiles and around the sheet. */
  seamColor?: string
  /** Thickness of the tear lines, in px. */
  seamWidth?: number
  /**
   * Draw the fine tab grid across the whole sheet. Turn it off when tiles carry a caption below
   * their art (the fine lines would cross the text) and put a TabPerforations inside each image instead.
   */
  fine?: boolean
}

const layer: CSSProperties = {
  position: 'absolute',
  inset: 0,
  pointerEvents: 'none',
}

function dashMask(direction: 'to bottom' | 'to right', on: number, off: number): CSSProperties {
  const mask = `repeating-linear-gradient(${direction}, #000 0 ${on}px, transparent ${on}px ${on + off}px)`
  return { maskImage: mask, WebkitMaskImage: mask }
}

/**
 * Decorative overlay that makes a grid of art tiles read as one perforated blotter sheet:
 * a fine perforation grid of small tabs across every tile, plus stronger tear lines on every
 * tile boundary and around the outer edge. Place it as the first child of a `relative` grid;
 * it sits above the tiles and never receives pointer events.
 *
 * Why masks: each layer draws solid lines with background gradients, and a repeating gradient
 * mask cuts them into dashes. That keeps the dash rhythm in screen pixels at any tile size,
 * which a dashed SVG pattern scaled by percentage cannot do.
 */
export function BlotterPerforations({
  cols,
  rows,
  tabsPerCell = 4,
  perfColor = 'rgba(255, 250, 235, 0.5)',
  seamColor = 'rgba(236, 226, 196, 0.9)',
  seamWidth = 3,
  fine = true,
}: BlotterPerforationsProps) {
  const fineV = `linear-gradient(to right, ${perfColor} 0 1px, transparent 1px)`
  const fineH = `linear-gradient(to bottom, ${perfColor} 0 1px, transparent 1px)`
  const seam = `linear-gradient(${seamColor}, ${seamColor})`
  const xs = Array.from({ length: cols + 1 }, (_, k) => `${((k / cols) * 100).toFixed(3)}%`)
  const ys = Array.from({ length: rows + 1 }, (_, k) => `${((k / rows) * 100).toFixed(3)}%`)

  return (
    <>
      {fine ? (
        <>
          <div
            aria-hidden
            className="z-[5]"
            style={{
              ...layer,
              backgroundImage: fineV,
              backgroundSize: `calc(100% / ${cols * tabsPerCell}) 100%`,
              ...dashMask('to bottom', 3, 3),
            }}
          />
          <div
            aria-hidden
            className="z-[5]"
            style={{
              ...layer,
              backgroundImage: fineH,
              backgroundSize: `100% calc(100% / ${rows * tabsPerCell})`,
              ...dashMask('to right', 3, 3),
            }}
          />
        </>
      ) : null}
      <div
        aria-hidden
        className="z-[6]"
        style={{
          ...layer,
          backgroundImage: xs.map(() => seam).join(','),
          backgroundSize: xs.map(() => `${seamWidth}px 100%`).join(','),
          backgroundPosition: xs.map((x) => `${x} 0`).join(','),
          backgroundRepeat: 'no-repeat',
          ...dashMask('to bottom', 7, 4),
        }}
      />
      <div
        aria-hidden
        className="z-[6]"
        style={{
          ...layer,
          backgroundImage: ys.map(() => seam).join(','),
          backgroundSize: ys.map(() => `100% ${seamWidth}px`).join(','),
          backgroundPosition: ys.map((y) => `0 ${y}`).join(','),
          backgroundRepeat: 'no-repeat',
          ...dashMask('to right', 7, 4),
        }}
      />
    </>
  )
}

/**
 * The fine perforation grid of small tabs for ONE tile's art. Place it inside the image box
 * (a `relative` element) when the tile's caption sits outside the art.
 */
export function TabPerforations({
  tabs = 5,
  perfColor = 'rgba(255, 250, 235, 0.5)',
}: {
  tabs?: number
  perfColor?: string
}) {
  return (
    <>
      <div
        aria-hidden
        className="z-[5]"
        style={{
          ...layer,
          backgroundImage: `linear-gradient(to right, ${perfColor} 0 1px, transparent 1px)`,
          backgroundSize: `calc(100% / ${tabs}) 100%`,
          ...dashMask('to bottom', 3, 3),
        }}
      />
      <div
        aria-hidden
        className="z-[5]"
        style={{
          ...layer,
          backgroundImage: `linear-gradient(to bottom, ${perfColor} 0 1px, transparent 1px)`,
          backgroundSize: `100% calc(100% / ${tabs})`,
          ...dashMask('to right', 3, 3),
        }}
      />
    </>
  )
}
