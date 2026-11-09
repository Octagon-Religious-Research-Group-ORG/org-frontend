// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CommunityPanels } from './CommunityPanels'
import { GetStartedChecklist } from './GetStartedChecklist'
import { ReferenceLinks } from './ReferenceLinks'

vi.mock('@tanstack/react-router', async (original) => ({
  ...(await original<object>()),
  Link: ({ to, children }: { to: string; children: ReactNode }) => (
    <a href={to}>{children}</a>
  ),
}))
vi.mock('./MembersDirectory', () => ({
  MembersDirectory: () => <div>directory</div>,
}))
vi.mock('./ChatsPanel', () => ({ ChatsPanel: () => <div>chats</div> }))

afterEach(cleanup)

describe('ReferenceLinks', () => {
  it.each([
    '/about',
    '/community',
    '/beliefs',
    '/infrastructure',
    '/research',
    '/legal',
    '/future-ideas',
    '/offerings',
    '/gifts-contributions',
    '/membership',
  ])('links to %s', (href) => {
    const { container } = render(<ReferenceLinks />)
    expect(container.querySelector(`a[href="${href}"]`)).not.toBeNull()
  })
})

describe('CommunityPanels', () => {
  it('holds the directory, the chats and the reference links', () => {
    render(<CommunityPanels />)
    expect(screen.getByText('directory')).toBeTruthy()
    expect(screen.getByText('chats')).toBeTruthy()
    expect(screen.getByRole('navigation')).toBeTruthy()
  })
})

describe('GetStartedChecklist', () => {
  beforeEach(() => localStorage.clear())

  it('lists the four first steps', () => {
    render(<GetStartedChecklist />)
    expect(screen.getAllByRole('listitem')).toHaveLength(4)
    expect(screen.getByText("Read other members' pages.")).toBeTruthy()
    expect(screen.getByText('Join the chats.')).toBeTruthy()
  })

  it('stays hidden once dismissed', () => {
    const first = render(<GetStartedChecklist />)
    fireEvent.click(screen.getByRole('button', { name: 'Hide this' }))
    expect(screen.queryByText('Join the chats.')).toBeNull()
    first.unmount()
    render(<GetStartedChecklist />)
    expect(screen.queryByText('Join the chats.')).toBeNull()
  })

  it('still works when storage is blocked', () => {
    const get = vi
      .spyOn(Storage.prototype, 'getItem')
      .mockImplementation(() => {
        throw new Error('blocked')
      })
    const set = vi
      .spyOn(Storage.prototype, 'setItem')
      .mockImplementation(() => {
        throw new Error('blocked')
      })
    render(<GetStartedChecklist />)
    fireEvent.click(screen.getByRole('button', { name: 'Hide this' }))
    expect(screen.queryByText('Join the chats.')).toBeNull()
    get.mockRestore()
    set.mockRestore()
  })
})
