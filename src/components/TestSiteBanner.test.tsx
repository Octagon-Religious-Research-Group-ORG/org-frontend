// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { TestSiteBanner } from './TestSiteBanner'

describe('TestSiteBanner', () => {
  afterEach(cleanup)

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
