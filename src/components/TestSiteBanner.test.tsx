// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { BANNER_HEIGHT_VAR, TestSiteBanner } from './TestSiteBanner'

const height = () =>
  document.documentElement.style.getPropertyValue(BANNER_HEIGHT_VAR)

describe('TestSiteBanner', () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('tells the fixed header how tall it is, and again on resize', () => {
    const measured = vi
      .spyOn(HTMLElement.prototype, 'offsetHeight', 'get')
      .mockReturnValue(33)
    render(<TestSiteBanner siteEnv="test" />)
    expect(height()).toBe('33px')

    measured.mockReturnValue(50)
    fireEvent(window, new Event('resize'))
    expect(height()).toBe('50px')
  })

  it('stays above the header and clears its height when gone', () => {
    const { unmount } = render(<TestSiteBanner siteEnv="test" />)
    expect(screen.getByRole('note').className).toContain('sticky')
    expect(screen.getByRole('note').className).toContain('z-[60]')
    unmount()
    expect(height()).toBe('')
  })

  it('leaves the header at the top of the window on the live site', () => {
    render(<TestSiteBanner siteEnv="production" />)
    expect(height()).toBe('')
    const nav = readFileSync(join(__dirname, 'SiteNav.tsx'), 'utf8')
    expect(nav).toContain('top-[var(--test-banner-height,0px)]')
  })

  it('marks the test site', () => {
    render(<TestSiteBanner siteEnv="test" />)

    expect(
      screen.getByRole('note', { name: 'Test site notice' }).textContent,
    ).toMatch(/no real payments/i)
  })

  it.each([undefined, '', 'production', 'TEST'])(
    'renders nothing for %p',
    (siteEnv) => {
      const { container } = render(<TestSiteBanner siteEnv={siteEnv} />)

      expect(container.innerHTML).toBe('')
    },
  )
})
