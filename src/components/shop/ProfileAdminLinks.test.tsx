// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ProfileAdminLinks } from './ProfileAdminLinks'

vi.mock('@tanstack/react-router', () => ({
  Link: ({ to, children }: React.PropsWithChildren<{ to: string }>) => (
    <a href={to}>{children}</a>
  ),
}))

afterEach(cleanup)

describe('ProfileAdminLinks', () => {
  it('hides both admin entrances from a normal member', () => {
    render(
      <ProfileAdminLinks
        capabilities={{
          canEditWebsite: false,
          canPublishWebsite: false,
          canManageOrders: false,
        }}
      />,
    )

    expect(screen.queryByRole('link', { name: 'Edit Website' })).toBeNull()
    expect(screen.queryByRole('link', { name: 'Admin order queue' })).toBeNull()
    expect(screen.queryByRole('link', { name: 'Admin dashboard' })).toBeNull()
  })

  it('shows the exact website editor entrance only to website admins', () => {
    render(
      <ProfileAdminLinks
        capabilities={{
          canEditWebsite: true,
          canPublishWebsite: true,
          canManageOrders: false,
        }}
      />,
    )

    expect(
      screen.getByRole('link', { name: 'Edit Website' }).getAttribute('href'),
    ).toBe('/admin/website')
    expect(
      screen
        .getByRole('link', { name: 'Admin dashboard' })
        .getAttribute('href'),
    ).toBe('/admin')
    expect(screen.queryByRole('link', { name: 'Admin order queue' })).toBeNull()
  })

  it('keeps shop administration independent', () => {
    render(
      <ProfileAdminLinks
        capabilities={{
          canEditWebsite: false,
          canPublishWebsite: false,
          canManageOrders: true,
        }}
      />,
    )

    expect(
      screen
        .getByRole('link', { name: 'Admin order queue' })
        .getAttribute('href'),
    ).toBe('/admin/orders')
    expect(screen.queryByRole('link', { name: 'Edit Website' })).toBeNull()
  })
})
