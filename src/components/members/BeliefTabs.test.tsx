// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { BeliefTab } from '#/lib/members-api'
import { BeliefTabs } from './BeliefTabs'
import { Paragraphs } from './Paragraphs'

vi.mock('./HistoryPanel', () => ({
  HistoryPanel: (props: {
    tabId: string
    field: string
    label: string
    onClose: () => void
  }) => (
    <div data-testid="history">
      history {props.tabId} {props.field} {props.label}
      <button type="button" onClick={props.onClose}>
        close stub
      </button>
    </div>
  ),
}))
vi.mock('./BeliefOwnerTools', () => ({
  BeliefOwnerTools: (props: {
    tab: { tabId: string }
    revision: { text: number; title: number }
    isFirst: boolean
    isLast: boolean
    isOnly: boolean
  }) => (
    <div data-testid="owner-tools">
      {JSON.stringify({
        tabId: props.tab.tabId,
        revision: props.revision,
        isFirst: props.isFirst,
        isLast: props.isLast,
        isOnly: props.isOnly,
      })}
    </div>
  ),
}))

vi.mock('./CommentThread', () => ({
  CommentThread: (props: {
    tabId: string
    belief: { text: string; textSeq: number }
    onPageChanged: () => void
  }) => (
    <div data-testid="thread">
      {JSON.stringify({ tabId: props.tabId, belief: props.belief })}
      <button type="button" onClick={props.onPageChanged}>
        page changed stub
      </button>
    </div>
  ),
}))

afterEach(cleanup)

const noop = () => undefined

const paragraph = (blockId: string, text: string, label = '') => ({
  blockId,
  kind: 'paragraph' as const,
  label,
  text,
})

const tabs: Array<BeliefTab> = [
  {
    tabId: 't1',
    title: 'First',
    group: 'Theology',
    needsReview: false,
    paragraphs: [paragraph('b1', 'First text')],
  },
  {
    tabId: 't2',
    title: 'Second',
    group: 'Theology',
    needsReview: true,
    paragraphs: [paragraph('b2', 'Second text')],
  },
  {
    tabId: 't3',
    title: 'Third',
    needsReview: false,
    paragraphs: [paragraph('b3', 'Third text', 'I.')],
  },
]

describe('BeliefTabs', () => {
  it('renders nothing without tabs', () => {
    const { container } = render(
      <BeliefTabs onChanged={noop} slug="quiet-fern" tabs={[]} />,
    )
    expect(container.textContent).toBe('')
  })

  it('has one button per belief, with the label below the art', () => {
    render(<BeliefTabs onChanged={noop} slug="quiet-fern" tabs={tabs} />)
    const buttons = screen
      .getAllByRole('button')
      .filter((button) => button.hasAttribute('aria-controls'))
    expect(buttons).toHaveLength(3)
    const art = buttons[0].querySelector('.octagon') as Element
    const label = screen
      .getAllByText('First')
      .find((node) => buttons[0].contains(node)) as Element
    expect(
      art.compareDocumentPosition(label) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
  })

  it('puts every belief’s text in the page, showing only the open one', () => {
    const { container } = render(
      <BeliefTabs onChanged={noop} slug="quiet-fern" tabs={tabs} />,
    )
    expect(container.textContent).toContain('Second text')
    expect(container.querySelector<HTMLElement>('#panel-t1')?.hidden).toBe(
      false,
    )
    expect(container.querySelector<HTMLElement>('#panel-t2')?.hidden).toBe(true)
  })

  it('opens a tab when it is pressed', () => {
    const { container } = render(
      <BeliefTabs onChanged={noop} slug="quiet-fern" tabs={tabs} />,
    )
    const third = screen
      .getAllByRole('button')
      .find((button) => button.textContent.includes('Third')) as HTMLElement
    fireEvent.click(third)
    expect(third.getAttribute('aria-expanded')).toBe('true')
    expect(container.querySelector<HTMLElement>('#panel-t3')?.hidden).toBe(
      false,
    )
    expect(container.querySelector<HTMLElement>('#panel-t1')?.hidden).toBe(true)
  })

  it('groups tabs under their category', () => {
    render(<BeliefTabs onChanged={noop} slug="quiet-fern" tabs={tabs} />)
    expect(screen.getByRole('heading', { name: 'Theology' })).toBeTruthy()
  })

  it('marks imported tabs for review, in the tab and in the panel', () => {
    render(<BeliefTabs onChanged={noop} slug="quiet-fern" tabs={tabs} />)
    expect(screen.getAllByText('Imported, please review')).toHaveLength(2)
  })
})

describe('Paragraphs', () => {
  it('shows headings as headings and outline labels before the text', () => {
    render(
      <Paragraphs
        paragraphs={[
          { blockId: 'a', kind: 'heading', label: '', text: 'My heading' },
          paragraph('b', 'Body', 'II.'),
          paragraph('c', 'No label'),
        ]}
      />,
    )
    expect(screen.getByRole('heading', { name: 'My heading' })).toBeTruthy()
    expect(screen.getByText('II.')).toBeTruthy()
    expect(screen.getByText('Body')).toBeTruthy()
  })
})

describe('BeliefTabs history and owner tools', () => {
  it('offers the text and title history of a belief to any reader, and toggles it', () => {
    render(<BeliefTabs onChanged={noop} slug="quiet-fern" tabs={tabs} />)
    fireEvent.click(screen.getByRole('button', { name: 'History' }))
    expect(screen.getByTestId('history').textContent).toContain(
      'history t1 text “First”',
    )
    fireEvent.click(screen.getByRole('button', { name: 'Title history' }))
    expect(screen.getByTestId('history').textContent).toContain(
      'history t1 title the title of “First”',
    )
    fireEvent.click(screen.getByRole('button', { name: 'Title history' }))
    expect(screen.queryByTestId('history')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'History' }))
    fireEvent.click(screen.getByRole('button', { name: 'close stub' }))
    expect(screen.queryByTestId('history')).toBeNull()
  })

  it('shows no owner tools to a reader', () => {
    render(<BeliefTabs onChanged={noop} slug="quiet-fern" tabs={tabs} />)
    expect(screen.queryByTestId('owner-tools')).toBeNull()
  })

  it('gives the owner each belief’s versions and its place in the order', () => {
    render(
      <BeliefTabs
        onChanged={noop}
        slug="quiet-fern"
        tabs={tabs}
        owner={{
          revisions: { bio: 1, tabs: { t1: { text: 4, title: 2 } } },
          onChanged: vi.fn(),
        }}
      />,
    )
    const shown = screen
      .getAllByTestId('owner-tools', { hidden: true } as never)
      .map((node) => JSON.parse(node.textContent) as Record<string, unknown>)
    expect(shown).toEqual([
      {
        tabId: 't1',
        revision: { text: 4, title: 2 },
        isFirst: true,
        isLast: false,
        isOnly: false,
      },
      // Last of its category (Theology), though not last on the page.
      {
        tabId: 't2',
        revision: { text: 0, title: 0 },
        isFirst: false,
        isLast: true,
        isOnly: false,
      },
      // Alone without a category: nowhere to move.
      {
        tabId: 't3',
        revision: { text: 0, title: 0 },
        isFirst: true,
        isLast: true,
        isOnly: false,
      },
    ])
  })

  it('tells the owner when a belief is the only one', () => {
    render(
      <BeliefTabs
        onChanged={noop}
        slug="quiet-fern"
        tabs={[tabs[0]]}
        owner={{ revisions: { bio: 1, tabs: {} }, onChanged: vi.fn() }}
      />,
    )
    expect(screen.getByTestId('owner-tools').textContent).toContain(
      '"isOnly":true',
    )
  })
})

describe('BeliefTabs after a change', () => {
  it('opens the first belief when the open one has gone', () => {
    const { container, rerender } = render(
      <BeliefTabs onChanged={noop} slug="quiet-fern" tabs={tabs} />,
    )
    fireEvent.click(
      screen
        .getAllByRole('button')
        .find((button) => button.textContent.includes('Third')) as HTMLElement,
    )
    rerender(
      <BeliefTabs onChanged={noop} slug="quiet-fern" tabs={tabs.slice(0, 2)} />,
    )
    expect(container.querySelector<HTMLElement>('#panel-t1')?.hidden).toBe(
      false,
    )
  })

  it('shows a title and text with HTML in them as plain characters', () => {
    const hostile =
      '<script>window.hacked = 1</script><img src=x onerror="window.hacked = 2"><b>bold</b>'
    const { container } = render(
      <BeliefTabs
        onChanged={noop}
        slug="quiet-fern"
        tabs={[
          {
            tabId: 'h',
            title: hostile,
            needsReview: false,
            paragraphs: [paragraph('hb', hostile)],
          },
        ]}
      />,
    )
    expect(screen.getAllByText(hostile).length).toBeGreaterThanOrEqual(3)
    expect(container.querySelector('script, img, b')).toBeNull()
  })
  it('can move a belief in the middle of its category both ways', () => {
    const three = [
      { ...tabs[0], group: undefined },
      { ...tabs[1], group: undefined },
      { ...tabs[2], group: undefined },
    ]
    render(
      <BeliefTabs
        onChanged={noop}
        slug="quiet-fern"
        tabs={three}
        owner={{ revisions: { bio: 1, tabs: {} }, onChanged: vi.fn() }}
      />,
    )
    const middle = JSON.parse(
      screen.getAllByTestId('owner-tools')[1].textContent,
    ) as Record<string, unknown>
    expect(middle).toMatchObject({ isFirst: false, isLast: false })
  })
})

describe('BeliefTabs comments (Chunk 9)', () => {
  it('shows each belief’s comment count and loads only the open belief’s thread', () => {
    const onChanged = vi.fn()
    render(
      <BeliefTabs
        onChanged={onChanged}
        slug="quiet-fern"
        tabs={[
          { ...tabs[0], commentCount: 1, textSeq: 4 },
          { ...tabs[1], commentCount: 2_500 },
          { ...tabs[2], commentCount: 0 },
        ]}
      />,
    )
    expect(screen.getByText('1 comment')).toBeTruthy()
    expect(screen.getByText('2,500 comments')).toBeTruthy()
    expect(screen.queryByText('0 comments')).toBeNull()
    const threads = screen.getAllByTestId('thread')
    expect(threads).toHaveLength(1)
    expect(
      JSON.parse(threads[0].textContent.replace('page changed stub', '')),
    ).toEqual({
      tabId: 't1',
      belief: { text: 'First text', textSeq: 4 },
    })
    fireEvent.click(screen.getByRole('button', { name: 'page changed stub' }))
    expect(onChanged).toHaveBeenCalled()
    fireEvent.click(screen.getByText('Third', { selector: 'div' }))
    expect(screen.getByTestId('thread').textContent).toMatch(
      /"text":"I\. Third text","textSeq":0/,
    )
  })
})
