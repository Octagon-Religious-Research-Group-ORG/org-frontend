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

  it.each([
    ['a backslash after the slash', '/\\evil.test/b'],
    ['a backslash later in the path', '/a\\b'],
    ['a backslash in a full address', 'https:\\\\evil.test'],
    ['a double slash after a tab', '/\t/evil.test'],
    ['a double slash after a control character', '/\u0001/evil.test'],
    ['a double slash after a format character', '/\u200B/evil.test'],
    ['a no-break space', '/a\u00A0b'],
  ])('never links an address with %s', (_name, target) => {
    const container = textOf(`[click](${target})`)
    expect(container.querySelector('a')).toBeNull()
  })

  it('every path it links stays on the site', () => {
    for (const target of ['/', '/a', '/a/b?x=1#y', '/%5Cevil.test', '/.//x']) {
      const container = textOf(`[x](${target})`)
      const href = container.querySelector('a')?.getAttribute('href')
      expect(href).toBe(target)
      expect(new URL(target, 'https://site.test/p').host).toBe('site.test')
      cleanup()
    }
  })

  it('keeps text around a refused link and still finds the next one', () => {
    const container = textOf('[a](javascript:x) then [b](/y) end')
    expect(screen.getByRole('link', { name: 'b' })).toBeTruthy()
    expect(container.textContent).toBe('[a](javascript:x) then b end')
  })

  it.each([
    ['an unclosed bracket', '[a'],
    ['an empty address', '[a]()'],
    ['an address with a space', '[a](b c)'],
    ['no address', '[a] b'],
    ['an unclosed address', '[a](/b'],
    ['an escaped opening bracket', '\\[a](/b)'],
  ])('leaves %s as text', (_name, text) => {
    const container = textOf(text)
    expect(container.querySelector('a')).toBeNull()
  })

  it('reads an escaped closing bracket as part of the label', () => {
    textOf('[a\\]b](/c)')
    expect(screen.getByRole('link', { name: 'a]b' })).toBeTruthy()
  })

  it('takes the first link after failed brackets, sharing a closing one', () => {
    textOf('[a[b](/c)')
    expect(screen.getByRole('link', { name: 'a[b' })).toBeTruthy()
  })

  it('finds links in brackets separated by others', () => {
    textOf('[a][b](/c)')
    expect(screen.getByRole('link', { name: 'b' })).toBeTruthy()
  })

  it.each([
    ['open brackets', '['.repeat(20_000)],
    ['open brackets before one closing', '['.repeat(20_000) + ']'],
    ['bracket pairs', 'a['.repeat(10_000)],
    ['unterminated addresses', '[](a'.repeat(5_000)],
    ['backslash runs', ('\\'.repeat(50) + '[').repeat(392)],
  ])('stays fast on 20,000 characters of %s', (_name, text) => {
    const started = performance.now()
    textOf(text)
    expect(performance.now() - started).toBeLessThan(200)
  })

  it('removes the importer’s escapes from text and labels', () => {
    const container = textOf('a \\[b\\] [c\\]d](/x) \\\\ e')
    expect(container.textContent).toBe('a [b] c]d \\ e')
  })
})
