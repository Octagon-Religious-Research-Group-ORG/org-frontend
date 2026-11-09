// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { MemberText } from './MemberText'

afterEach(cleanup)

function textOf(text: string) {
  const { container } = render(<MemberText text={text} />)
  return container
}

describe('MemberText', () => {
  it('shows HTML as the characters it is', () => {
    const container = textOf('<img src=x onerror=alert(1)><b>bold</b>')
    expect(container.querySelector('img')).toBeNull()
    expect(container.querySelector('b')).toBeNull()
    expect(container.textContent).toBe(
      '<img src=x onerror=alert(1)><b>bold</b>',
    )
  })

  it('makes a link of the importer’s form, keeping the text around it', () => {
    const container = textOf('before [a page](/quiet-fern) after')
    const link = screen.getByRole('link', { name: 'a page' })
    expect(link.getAttribute('href')).toBe('/quiet-fern')
    expect(link.getAttribute('rel')).toContain('noopener')
    expect(container.textContent).toBe('before a page after')
  })

  it('handles a link at the very start', () => {
    textOf('[x](https://example.test/a)')
    expect(screen.getByRole('link', { name: 'x' })).toBeTruthy()
  })

  it.each([
    'javascript:alert(1)',
    'data:text/html,x',
    '//evil.example',
    'vbscript:x',
  ])('never links to %s', (target) => {
    const container = textOf(`[click](${target})`)
    expect(container.querySelector('a')).toBeNull()
    expect(container.textContent).toBe(`[click](${target})`)
  })

  it('removes the importer’s escapes from text and labels', () => {
    const container = textOf('a \\[b\\] [c\\]d](/x) \\\\ e')
    expect(container.textContent).toBe('a [b] c]d \\ e')
  })
})
