import { isValidElement } from 'react'
import { describe, expect, it } from 'vitest'
import { getDefaultWebsiteContent } from './content-defaults'
import type {
  AboutPageContent,
  ReferencePageContent,
  WebsitePageContent,
} from './content-types'
import { search, withHighlight } from './search'

function reference(
  id: ReferencePageContent['id'],
  overrides: Partial<ReferencePageContent> = {},
): ReferencePageContent {
  return {
    kind: 'reference',
    id,
    title: `${id} title`,
    subtitle: `${id} subtitle`,
    blocks: [],
    ...overrides,
  }
}

function about(overrides: Partial<AboutPageContent> = {}): AboutPageContent {
  return {
    kind: 'about',
    id: 'about',
    title: 'About Us',
    statusNote: 'Living document',
    articles: [],
    contact: {
      roman: 'IX',
      eyebrow: 'Contact',
      intro: 'Reach us',
      channels: [],
    },
    ...overrides,
  }
}

describe('published content search', () => {
  it('indexes content supplied by the publishing API', () => {
    const community = getDefaultWebsiteContent('community')
    if (community.kind !== 'reference') throw new Error('Expected reference')
    community.blocks.push({
      id: 'community-block-published',
      kind: 'paragraph',
      text: 'A newly published heliotrope gathering.',
    })

    const results = search('heliotrope', [community])

    expect(results[0]).toMatchObject({
      pageId: 'community',
      href: '/community',
    })
    expect(results[0].snippet).toContain('heliotrope')
  })

  it('does not find text that is absent from the supplied live pages', () => {
    const community = getDefaultWebsiteContent('community')

    expect(search('unpublished-only-phrase', [community])).toEqual([])
  })

  it('returns no results for missing or whitespace-only queries', () => {
    expect(search('', [])).toEqual([])
    expect(search('   ', [])).toEqual([])
    expect(search(null as never, [])).toEqual([])
  })

  it('scores title, subtitle, and multiple block matches while keeping the first block', () => {
    const page = reference('beliefs', {
      title: 'Signal doctrine',
      subtitle: 'Signal studies',
      blocks: [
        {
          id: 'first',
          kind: 'paragraph',
          text: `${'x'.repeat(50)} signal ${'y'.repeat(80)}`,
        },
        {
          id: 'second',
          kind: 'paragraph',
          text: 'signal appears again',
        },
      ],
    })

    const [result] = search('SIGNAL', [page])

    expect(result).toMatchObject({
      pageId: 'beliefs',
      title: 'Beliefs',
      href: '/beliefs',
      lineIndex: 0,
    })
    expect(result.snippet.startsWith('…')).toBe(true)
    expect(result.snippet.endsWith('…')).toBe(true)
    expect(result.snippet.length).toBeLessThanOrEqual(118)
  })

  it('uses a matching subtitle when no title or block matches', () => {
    const [result] = search('needle', [
      reference('legal', { subtitle: 'Needle in subtitle' }),
    ])

    expect(result).toMatchObject({
      pageId: 'legal',
      snippet: 'Needle in subtitle',
      lineIndex: undefined,
    })
  })

  it('scores substring matches without requiring a whole word', () => {
    const [result] = search('needle', [
      reference('research', { subtitle: 'Needlework methods' }),
    ])

    expect(result.pageId).toBe('research')
  })

  it('creates a short unprefixed snippet for a block match near the start', () => {
    const [result] = search('needle', [
      reference('future', {
        blocks: [
          {
            id: 'line',
            kind: 'paragraph',
            text: `A needle appears here ${'tail '.repeat(20)}`,
          },
        ],
      }),
    ])

    expect(result.snippet.startsWith('…')).toBe(false)
    expect(result.snippet.endsWith('…')).toBe(true)
  })

  it('caps snippets for unusually long search terms', () => {
    const term = 'n'.repeat(60)
    const [result] = search(term, [
      reference('infrastructure', {
        blocks: [
          {
            id: 'long-term',
            kind: 'paragraph',
            text: `${'x'.repeat(50)} ${term} ${'y'.repeat(80)}`,
          },
        ],
      }),
    ])

    expect(result.snippet).toHaveLength(118)
    expect(result.snippet.endsWith('…')).toBe(true)
  })

  it('indexes nested about text and uses title matches as the primary snippet', () => {
    const page = about({
      title: 'About signal',
      articles: [
        {
          id: 'article',
          roman: 'I',
          eyebrow: 'Origin',
          lead: 'A quiet lead',
          body: [
            {
              id: 'parent',
              marker: '1.',
              text: 'Parent text',
              children: [
                {
                  id: 'child',
                  marker: 'a.',
                  text: 'Nested signal',
                  children: [],
                },
              ],
            },
          ],
        },
        {
          id: 'empty',
          roman: 'II',
          eyebrow: 'Empty',
          lead: 'Signal in another lead',
          body: [],
        },
      ],
    })

    const [result] = search('signal', [page])

    expect(result).toMatchObject({
      pageId: 'about',
      href: '/about',
      snippet: 'About signal — founding document',
    })
  })

  it('uses an about body match when its title does not match', () => {
    const [result] = search('needle', [
      about({
        articles: [
          {
            id: 'article',
            roman: 'I',
            eyebrow: 'Origin',
            lead: 'A needle in the founding record',
            body: [],
          },
        ],
      }),
    ])

    expect(result.snippet).toBe('A needle in the founding record')
  })

  it('omits an about page when none of its text matches', () => {
    expect(search('needle', [about()])).toEqual([])
  })

  it('sorts strongest results first and caps the result list', () => {
    const pages = Array.from({ length: 16 }, (_, index) =>
      reference('community', {
        title: index === 15 ? 'Needle' : `Page ${index}`,
        subtitle: `needle ${index}`,
      }),
    ) as WebsitePageContent[]

    const results = search('needle', pages)

    expect(results).toHaveLength(14)
    expect(results[0].snippet).toBe('Needle')
  })
})

describe('withHighlight', () => {
  it('leaves text untouched when the term is absent or blank', () => {
    expect(withHighlight('Plain text')).toEqual(['Plain text'])
    expect(withHighlight('Plain text', '   ')).toEqual(['Plain text'])
  })

  it('highlights case-insensitive literal matches', () => {
    const parts = withHighlight('Use a.b then A.B', 'a.b')
    const marks = parts.filter(isValidElement<{ children: string }>)

    expect(marks).toHaveLength(2)
    expect(marks.map((mark) => mark.props.children)).toEqual(['a.b', 'A.B'])
    expect(parts.filter((part) => typeof part === 'string')).toContain('Use ')
  })
})
