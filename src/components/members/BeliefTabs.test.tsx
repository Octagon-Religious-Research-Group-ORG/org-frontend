// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import type { BeliefTab } from '#/lib/members-api'
import { BeliefTabs } from './BeliefTabs'
import { Paragraphs } from './Paragraphs'

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
    const { container } = render(<BeliefTabs tabs={[]} />)
    expect(container.textContent).toBe('')
  })

  it('has one button per belief, with the label below the art', () => {
    render(<BeliefTabs tabs={tabs} />)
    const buttons = screen.getAllByRole('button')
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
    const { container } = render(<BeliefTabs tabs={tabs} />)
    expect(container.textContent).toContain('Second text')
    expect(container.querySelector<HTMLElement>('#panel-t1')?.hidden).toBe(
      false,
    )
    expect(container.querySelector<HTMLElement>('#panel-t2')?.hidden).toBe(true)
  })

  it('opens a tab when it is pressed', () => {
    const { container } = render(<BeliefTabs tabs={tabs} />)
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
    render(<BeliefTabs tabs={tabs} />)
    expect(screen.getByRole('heading', { name: 'Theology' })).toBeTruthy()
  })

  it('marks imported tabs for review, in the tab and in the panel', () => {
    render(<BeliefTabs tabs={tabs} />)
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
