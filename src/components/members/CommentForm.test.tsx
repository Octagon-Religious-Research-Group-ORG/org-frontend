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
import { authorLabel, CommentAuthorName } from './CommentAuthorName'
import { CharacterCount } from './CharacterCount'
import { CommentForm } from './CommentForm'
import { SuggestForm } from './SuggestForm'

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
        <CommentAuthorName author={{ kind: 'member' }} />
        <CommentAuthorName author={{ kind: 'member', slug: 'no-name' }} />
      </>,
    )
    expect(screen.getByText('Linked').closest('a')?.getAttribute('href')).toBe(
      '/linked',
    )
    expect(screen.getByText('Unlinked').closest('a')).toBeNull()
    expect(screen.getByText('Pages Name').closest('a')).toBeNull()
    expect(container.textContent).toContain('ORG admin')
    // Not named by the server: not named here, and never linked.
    expect(screen.getAllByText('A member')).toHaveLength(2)
    expect(container.querySelectorAll('a')).toHaveLength(1)
  })

  it('keeps an imported name and adds the member an admin linked it to (Chunk 11)', () => {
    const { container } = render(
      <>
        <CommentAuthorName
          author={{
            kind: 'imported',
            name: 'Pages One',
            member: { displayName: 'Open Member', slug: 'open-member' },
          }}
        />
        <CommentAuthorName
          author={{
            kind: 'imported',
            name: 'Pages Two',
            member: { displayName: 'Members-only Member' },
          }}
        />
      </>,
    )
    expect(container.textContent).toContain('Pages One (now Open Member)')
    expect(
      screen.getByText('Open Member').closest('a')?.getAttribute('href'),
    ).toBe('/open-member')
    expect(container.textContent).toContain(
      'Pages Two (now Members-only Member)',
    )
    expect(container.querySelectorAll('a')).toHaveLength(1)
    expect(
      authorLabel({
        kind: 'imported',
        name: 'Pages One',
        member: { displayName: 'Open Member' },
      }),
    ).toBe('Pages One (now Open Member)')
  })
})

describe('SuggestForm', () => {
  const renderForm = (onSubmit = vi.fn(() => Promise.resolve(true))) => {
    const onCancel = vi.fn()
    render(
      <SuggestForm
        initial="The belief now."
        busy={false}
        onSubmit={onSubmit}
        onCancel={onCancel}
      />,
    )
    return { onSubmit, onCancel }
  }

  it('checks the belief and the note against their own limits before sending', () => {
    const { onSubmit, onCancel } = renderForm()
    const text = screen.getByLabelText('Your wording of the whole belief')
    const note = screen.getByLabelText('A note for the owner (optional)')
    fireEvent.change(text, { target: { value: '\u200b' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send suggestion' }))
    expect(screen.getByRole('alert').textContent).toMatch(/as you would word/)
    fireEvent.change(text, { target: { value: 'a'.repeat(20_001) } })
    fireEvent.click(screen.getByRole('button', { name: 'Send suggestion' }))
    expect(screen.getByRole('alert').textContent).toMatch(/belief is longer/)
    fireEvent.change(text, { target: { value: 'Fine.' } })
    fireEvent.change(note, { target: { value: 'b'.repeat(10_001) } })
    fireEvent.click(screen.getByRole('button', { name: 'Send suggestion' }))
    expect(screen.getByRole('alert').textContent).toMatch(/note is longer/)
    expect(onSubmit).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onCancel).toHaveBeenCalled()
  })

  it('sends both, cleaned', async () => {
    const { onSubmit } = renderForm()
    fireEvent.change(screen.getByLabelText('A note for the owner (optional)'), {
      target: { value: '  Clearer \u0007 ' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Send suggestion' }))
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith('The belief now.', 'Clearer'),
    )
  })
})

describe('CharacterCount', () => {
  it('announces the count only near the limit and over it', () => {
    const { container, rerender } = render(
      <CharacterCount id="c" value="abc" max={10} />,
    )
    const live = () => container.querySelector('[aria-live="polite"]')
    expect(live()?.textContent).toBe('')
    expect(container.querySelector('#c')?.getAttribute('aria-live')).toBeNull()
    rerender(<CharacterCount id="c" value="abcdefghi" max={10} />)
    expect(live()?.textContent).toBe('Close to the limit: 9 / 10 characters.')
    rerender(<CharacterCount id="c" value="abcdefghijk" max={10} />)
    expect(live()?.textContent).toBe('Too long: 11 / 10 characters.')
  })
})
