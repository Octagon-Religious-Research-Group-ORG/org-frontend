// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { authorLabel, CommentAuthorName } from './CommentAuthorName'

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children }: { children: unknown }) => <a>{children as string}</a>,
}))

afterEach(cleanup)

// Chunk 17: a comment whose author deleted their page keeps its place in
// someone else's thread and names no one.
describe('a former member', () => {
  it('reads "A former member", with no name and no link', () => {
    expect(authorLabel({ kind: 'member', former: true })).toBe(
      'A former member',
    )
    render(<CommentAuthorName author={{ kind: 'member', former: true }} />)
    expect(screen.getByText('A former member')).toBeTruthy()
    expect(screen.queryByRole('link')).toBeNull()
  })
})
