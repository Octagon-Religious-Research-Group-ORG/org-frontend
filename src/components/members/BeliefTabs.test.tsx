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

afterEach(cleanup)

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
    const { container } = render(<BeliefTabs slug="quiet-fern" tabs={[]} />)
    expect(container.textContent).toBe('')
  })

  it('has one button per belief, with the label below the art', () => {
    render(<BeliefTabs slug="quiet-fern" tabs={tabs} />)
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
    const { container } = render(<BeliefTabs slug="quiet-fern" tabs={tabs} />)
    expect(container.textContent).toContain('Second text')
    expect(container.querySelector<HTMLElement>('#panel-t1')?.hidden).toBe(
      false,
    )
    expect(container.querySelector<HTMLElement>('#panel-t2')?.hidden).toBe(true)
  })

  it('opens a tab when it is pressed', () => {
    const { container } = render(<BeliefTabs slug="quiet-fern" tabs={tabs} />)
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
    render(<BeliefTabs slug="quiet-fern" tabs={tabs} />)
    expect(screen.getByRole('heading', { name: 'Theology' })).toBeTruthy()
  })

  it('marks imported tabs for review, in the tab and in the panel', () => {
    render(<BeliefTabs slug="quiet-fern" tabs={tabs} />)
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
    render(<BeliefTabs slug="quiet-fern" tabs={tabs} />)
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
    render(<BeliefTabs slug="quiet-fern" tabs={tabs} />)
    expect(screen.queryByTestId('owner-tools')).toBeNull()
  })

  it('gives the owner each belief’s versions and its place in the order', () => {
    render(
      <BeliefTabs
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
      {
        tabId: 't2',
        revision: { text: 0, title: 0 },
        isFirst: false,
        isLast: false,
        isOnly: false,
      },
      {
        tabId: 't3',
        revision: { text: 0, title: 0 },
        isFirst: false,
        isLast: true,
        isOnly: false,
      },
    ])
  })

  it('tells the owner when a belief is the only one', () => {
    render(
      <BeliefTabs
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
