// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type * as ConnectionsApi from '#/lib/connections-api'
import { unsubscribeScopeWords } from '#/lib/notifications-api'
import { UnsubscribePanel } from './UnsubscribePanel'
import { forgetConnectionTerms } from './use-connection-terms'

// Review round 1, #6: the unsubscribe page names connection requests as the
// admins chose.
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to }: { children: ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}))
vi.mock('#/lib/connections-api', async (original) => ({
  ...(await original<typeof ConnectionsApi>()),
  fetchConnectionTerms: () =>
    Promise.resolve({ singular: 'introduction', plural: 'introductions' }),
}))

afterEach(() => {
  cleanup()
  forgetConnectionTerms()
})

describe('unsubscribing from connection request emails', () => {
  it('uses the admins’ name for them', async () => {
    render(<UnsubscribePanel token="v1.dXNlcl9h.connectionRequests.c2ln" />)
    expect(
      await screen.findByText('Turn off emails about new introductions?'),
    ).toBeTruthy()
  })

  it('keeps the default words without a name', () => {
    expect(unsubscribeScopeWords('v1.dXNlcl9h.connectionAccepts.c2ln')).toBe(
      'emails about accepted connection requests',
    )
    expect(
      unsubscribeScopeWords('v1.x.replies.y', {
        singular: 'introduction',
        plural: 'introductions',
      }),
    ).toBe('emails about replies to your comments')
  })
})
