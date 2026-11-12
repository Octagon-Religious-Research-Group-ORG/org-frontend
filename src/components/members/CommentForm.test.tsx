// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CommentAuthorName } from './CommentAuthorName'
import { CommentForm } from './CommentForm'

vi.mock('@tanstack/react-router', async (original) => ({
  ...(await original<object>()),
  Link: ({
    children,
    params,
  }: {
    children: ReactNode
    params: { slug: string }
  }) => <a href={`/${params.slug}`}>{children}</a>,
}))

afterEach(cleanup)

describe('CommentForm', () => {
  it('sends the text cleaned as the server stores it, then empties the box', async () => {
    const onSubmit = vi.fn(() => Promise.resolve(true))
    render(
      <CommentForm
        label="Your comment"
        submitLabel="Post"
        busy={false}
        onSubmit={onSubmit}
      />,
    )
    const box = screen.getByLabelText('Your comment')
    fireEvent.change(box, { target: { value: '  Hello\u0007\n\n\n there ' } })
    expect(screen.getByText(/12 \/ 10,000 characters/)).toBeTruthy()
    fireEvent.click(
      screen.getByRole<HTMLButtonElement>('button', { name: 'Post' }),
    )
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith('Hello\n\nthere'))
    await waitFor(() => expect((box as HTMLTextAreaElement).value).toBe(''))
  })

  it('keeps the text when the save failed', async () => {
    render(
      <CommentForm
        label="Edit"
        submitLabel="Save"
        initial="Kept text"
        busy={false}
        onSubmit={() => Promise.resolve(false)}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() =>
      expect(screen.getByLabelText<HTMLTextAreaElement>('Edit').value).toBe(
        'Kept text',
      ),
    )
  })

  it('refuses empty and over-long text before sending, and can be cancelled', () => {
    const onSubmit = vi.fn(() => Promise.resolve(true))
    const onCancel = vi.fn()
    render(
      <CommentForm
        label="Reply"
        submitLabel="Send"
        max={5}
        busy={false}
        onSubmit={onSubmit}
        onCancel={onCancel}
      />,
    )
    fireEvent.change(screen.getByLabelText('Reply'), {
      target: { value: '​ ' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Send' }))
    expect(screen.getByRole('alert').textContent).toBe(
      'Please write something first.',
    )
    fireEvent.change(screen.getByLabelText('Reply'), {
      target: { value: 'Too long' },
    })
    expect(screen.getByText(/too long for one save/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Send' }))
    expect(screen.getByRole('alert').textContent).toMatch(/longer than 5/)
    expect(onSubmit).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onCancel).toHaveBeenCalled()
  })

  it('disables sending while busy', () => {
    render(
      <CommentForm
        label="x"
        submitLabel="Post"
        busy
        onSubmit={() => Promise.resolve(true)}
      />,
    )
    expect(
      screen.getByRole<HTMLButtonElement>('button', { name: 'Post' }).disabled,
    ).toBe(true)
  })
})

describe('CommentAuthorName', () => {
  it('links a member only when the server gave their page', () => {
    const { container } = render(
      <>
        <CommentAuthorName
          author={{ kind: 'member', displayName: 'Linked', slug: 'linked' }}
        />
        <CommentAuthorName
          author={{ kind: 'member', displayName: 'Unlinked' }}
        />
        <CommentAuthorName author={{ kind: 'imported', name: 'Pages Name' }} />
        <CommentAuthorName author={{ kind: 'admin' }} />
        <CommentAuthorName author={{ kind: 'former-member' }} />
      </>,
    )
    expect(screen.getByText('Linked').closest('a')?.getAttribute('href')).toBe(
      '/linked',
    )
    expect(screen.getByText('Unlinked').closest('a')).toBeNull()
    expect(screen.getByText('Pages Name').closest('a')).toBeNull()
    expect(container.textContent).toContain('ORG admin')
    expect(container.textContent).toContain('A former member')
    expect(container.querySelectorAll('a')).toHaveLength(1)
  })
})
