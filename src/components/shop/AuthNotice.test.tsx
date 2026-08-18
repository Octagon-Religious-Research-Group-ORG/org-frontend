// @vitest-environment jsdom

import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { AuthNotice } from './AuthNotice'

vi.mock('#/lib/auth', () => ({
  useOrgAuth: () => ({ configured: false }),
}))

describe('AuthNotice', () => {
  it('explains the required environment configuration', () => {
    render(<AuthNotice />)
    expect(screen.getByText(/Sign-in is not configured yet/i)).toBeTruthy()
  })
})
