import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const FILES = [
  'MembersEntry.tsx',
  'MembershipJoinForm.tsx',
  'ContactRows.tsx',
  'BeliefTabs.tsx',
  'ChatsPanel.tsx',
  'GetStartedChecklist.tsx',
  'MemberPage.tsx',
  'MemberText.tsx',
  'MembersDirectory.tsx',
  'OwnerTools.tsx',
  'Paragraphs.tsx',
  'ProfileView.tsx',
  'ReferenceLinks.tsx',
]
/** The lighter of the two dark surfaces these components sit on. */
const SURFACE = '#0f1219'
/** Dark text on the filled light buttons, not on the dark surface. */
const ON_LIGHT_BUTTON = '#0b0d12'

function luminance(hex: string) {
  const [r, g, b] = [1, 3, 5]
    .map((start) => parseInt(hex.slice(start, start + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contrast(a: string, b: string) {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (light + 0.05) / (dark + 0.05)
}

describe('text colours in the members components', () => {
  it.each(FILES)('reach 4.5:1 on the dark surface in %s', (file) => {
    const source = readFileSync(join(__dirname, file), 'utf8')
    const colours = [...source.matchAll(/text-\[(#[0-9a-f]{6})\]/g)]
      .map((match) => match[1])
      .filter((colour) => colour !== ON_LIGHT_BUTTON)

    expect(colours.length).toBeGreaterThan(0)
    for (const colour of new Set(colours)) {
      expect([colour, contrast(colour, SURFACE) >= 4.5]).toEqual([colour, true])
    }
  })

  it('reach 4.5:1 for dark text on the filled teal buttons', () => {
    expect(contrast(ON_LIGHT_BUTTON, '#78aea2')).toBeGreaterThanOrEqual(4.5)
  })

  it('reach 4.5:1 for body text on the darkest panel and field colours', () => {
    expect(contrast('#ece2c4', '#0b0d12')).toBeGreaterThanOrEqual(4.5)
    expect(contrast('#d8ceb0', '#0b0d12')).toBeGreaterThanOrEqual(4.5)
  })
})
