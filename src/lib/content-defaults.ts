import { ARTICLES, CONTACT } from './about-content'
import type { OutlineNode } from './about-content'
import { REFERENCE_PAGES } from './reference-pages'
import type {
  AboutOutlineNode,
  ReferenceBlock,
  ReferencePageId,
  WebsitePageContent,
  WebsitePageId,
} from './content-types'

function markerDepth(marker: string) {
  if (/^[IVXLCDM]+\.$/.test(marker)) return 0
  if (/^[A-Z]\.$/.test(marker)) return 1
  if (/^\d+\.$/.test(marker)) return 2
  if (/^[a-z]\)$/.test(marker)) return 3
  return 4
}

function splitMarker(line: string) {
  const match = line.match(
    /^((?:[IVXLCDM]+\.|[A-Z]\.|\d+\.|[a-z]\)|\(\d+\)|\([a-z]\)))\s+(.*)$/,
  )
  return match ? { marker: match[1], text: match[2] } : null
}

function isLegacyHeading(line: string) {
  return (
    line.endsWith(':') ||
    /^(Members|How To Join|Member-only|Churches\/|Other Resources|Anonymous Beliefs|Southwest Virginia|Colorado|Austin Texas|Miami Florida|Asia|Los Angeles|San Francisco|New York|Miscellaneous|Sketches)/.test(
      line,
    )
  )
}

function referenceBlocks(
  pageId: ReferencePageId,
  lines: ReadonlyArray<string>,
): ReferenceBlock[] {
  return lines.map((line, index) => {
    const id = `${pageId}-block-${String(index + 1).padStart(4, '0')}`
    if (index === 0) return { id, kind: 'lead', text: line }
    const parsed = splitMarker(line)
    if (parsed) {
      return {
        id,
        kind: 'outline',
        marker: parsed.marker,
        depth: markerDepth(parsed.marker),
        text: parsed.text,
      }
    }
    return {
      id,
      kind: isLegacyHeading(line) ? 'heading' : 'paragraph',
      text: line,
    }
  })
}

function outlineNodes(
  articleId: string,
  nodes: ReadonlyArray<OutlineNode>,
  path: number[] = [],
): AboutOutlineNode[] {
  return nodes.map((node, index) => {
    const nodePath = [...path, index + 1]
    return {
      id: `${articleId}-node-${nodePath.join('-')}`,
      marker: node.m,
      text: node.t,
      children: outlineNodes(articleId, node.c ?? [], nodePath),
    }
  })
}

const about: WebsitePageContent = {
  kind: 'about',
  id: 'about',
  title: 'About Us',
  statusNote:
    'A living document — revised as our knowledge and beliefs evolve.',
  articles: ARTICLES.map((article) => ({
    id: article.id,
    roman: article.roman,
    eyebrow: article.eyebrow,
    lead: article.lead,
    body: outlineNodes(article.id, article.body),
  })),
  contact: {
    roman: CONTACT.roman,
    eyebrow: CONTACT.eyebrow,
    intro: 'Reach a member directly through either channel below.',
    channels: CONTACT.channels.map((channel, index) => ({
      id: `contact-channel-${index + 1}`,
      label: channel.label,
      handle: channel.handle,
      href: channel.href,
    })),
  },
}

const TEST_SITE_PAYMENT_PLACEHOLDER = '(test site: no real payment)'

// Same rules as org-backend src/content/test-site-content.ts
const PAYMENT_LINK =
  /(?<![\p{L}\p{N}.@-])(?:https?:\/\/)?(?:[a-z0-9-]+\.)*(?:paypal\.(?:me|com(?:\.[a-z]{2})?)|venmo\.(?:com|me)|cash\.(?:app|me))(?![\p{L}\p{N}-])(?:\/\S*)?/giu
const KNOWN_HANDLES = /[$@＠](?:trippaardema|the_org)(?![\p{L}\p{N}_])/giu
const PAYMENT_HANDLE =
  /(?<![\p{L}\p{N}_.])(?:\$[\p{L}_]|[@＠][\p{L}\p{N}_])[\p{L}\p{N}_]*(?:[.-][\p{L}\p{N}_]+)*/gu

/**
 * The bundled copy is what visitors see when the API does not answer, so on
 * the test site it must not carry ORG's real payment accounts either.
 */
export function blocksForThisSite(
  pageId: string,
  blocks: ReferenceBlock[],
  siteEnv: string | undefined = import.meta.env.VITE_SITE_ENV,
): ReferenceBlock[] {
  if (siteEnv !== 'test') return blocks
  return blocks.map((block) => {
    const safe = block.text
      .replace(PAYMENT_LINK, TEST_SITE_PAYMENT_PLACEHOLDER)
      .replace(KNOWN_HANDLES, TEST_SITE_PAYMENT_PLACEHOLDER)
    return {
      ...block,
      text:
        pageId === 'donations'
          ? safe.replace(PAYMENT_HANDLE, TEST_SITE_PAYMENT_PLACEHOLDER)
          : safe,
    }
  })
}

export const DEFAULT_WEBSITE_PAGES: Record<WebsitePageId, WebsitePageContent> =
  Object.fromEntries([
    ['about', about],
    ...REFERENCE_PAGES.map((page) => [
      page.id,
      {
        kind: 'reference' as const,
        id: page.id,
        title: page.title,
        subtitle: page.subtitle,
        blocks: blocksForThisSite(
          page.id,
          referenceBlocks(page.id, page.lines),
        ),
      },
    ]),
  ]) as Record<WebsitePageId, WebsitePageContent>

export function cloneWebsiteContent<T extends WebsitePageContent>(
  content: T,
): T {
  return JSON.parse(JSON.stringify(content)) as T
}

export function getDefaultWebsiteContent(pageId: WebsitePageId) {
  return cloneWebsiteContent(DEFAULT_WEBSITE_PAGES[pageId])
}
