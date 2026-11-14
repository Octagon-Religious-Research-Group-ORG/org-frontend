// A stand-in for the backend's member-page answers, so the browser tests can
// prove what the server render does with them. Synthetic data only. Anything
// else answers 404, and the site's content falls back to its bundled defaults.
import { createServer } from 'node:http'

const paragraph = (blockId, text) => ({
  blockId,
  kind: 'paragraph',
  label: '',
  text,
})

const PROFILES = {
  'open-example': {
    access: 'full',
    slug: 'open-example',
    displayName: 'Open Example',
    isOwner: false,
    hasPicture: true,
    picturePublic: true,
    contacts: [{ method: 'signal', value: '@open-example' }],
    bio: [paragraph('b1', 'A synthetic public biography.')],
    extras: [],
    tabs: [
      {
        tabId: 't1',
        title: 'First tab',
        group: 'Synthetic group',
        needsReview: true,
        paragraphs: [paragraph('b2', 'First synthetic belief.')],
        commentCount: 4,
        textSeq: 2,
        votes: {
          agree: 3,
          disagree: 1,
          earlierWording: 2,
          mayVote: false,
          viewerVoteBlock: 'sign-in',
        },
      },
      {
        tabId: 't2',
        title: 'Second tab',
        needsReview: false,
        paragraphs: [
          paragraph(
            'b3',
            `Second synthetic belief with a long unbroken string ${'x'.repeat(200)}`,
          ),
        ],
      },
    ],
  },
  'members-example': {
    access: 'name-only',
    slug: 'members-example',
    displayName: 'Members Example',
    isOwner: false,
    hasPicture: false,
    picturePublic: false,
  },
}

// Histories as the server sends them: newest first, short hash, no author.
const HISTORY = {
  bio: {
    page: 1,
    hasMore: false,
    entries: [
      {
        seq: 1,
        savedAt: '2026-10-11T08:00:00.000Z',
        text: 'A synthetic public biography.',
        hash: '0123456789ab',
        source: 'imported',
        beforeFirstEdit: false,
      },
    ],
  },
  'tabs/t1': {
    page: 1,
    hasMore: false,
    entries: [
      {
        seq: 2,
        savedAt: '2026-11-01T12:30:00.000Z',
        text: 'First synthetic belief.',
        hash: 'abcdef012345',
        source: 'member',
        beforeFirstEdit: false,
      },
      {
        seq: 1,
        savedAt: '2026-10-11T08:00:00.000Z',
        text: 'An older synthetic wording.',
        hash: 'fedcba987654',
        source: 'imported',
        beforeFirstEdit: false,
      },
    ],
  },
}

// Threads as the server sends them (Chunk 9): oldest first, replies nested.
const THREADS = {
  t1: {
    viewerMayComment: false,
    viewerMaySuggest: false,
    comments: [
      {
        commentId: 'cmt_imp1',
        kind: 'comment',
        source: 'imported',
        author: { kind: 'imported', name: 'Synthetic Pages Author' },
        postedAt: '2026-10-11T08:00:00.000Z',
        importedDate: '2020-05-06T00:00:00.000Z',
        removed: false,
        body: 'An imported synthetic comment.',
        anchorText: 'synthetic belief',
        edited: false,
        mine: false,
        replies: [
          {
            commentId: 'cmt_2',
            kind: 'comment',
            source: 'member',
            author: {
              kind: 'member',
              displayName: 'Open Example',
              slug: 'open-example',
            },
            postedAt: '2026-11-10T09:00:00.000Z',
            removed: false,
            body: 'A synthetic reply, edited once.',
            edited: true,
            editedAt: '2026-11-11T09:30:00.000Z',
            mine: false,
          },
          {
            commentId: 'cmt_3',
            kind: 'comment',
            source: 'member',
            author: { kind: 'member' },
            postedAt: '2026-11-10T10:00:00.000Z',
            removed: true,
            edited: false,
            mine: false,
          },
        ],
      },
      {
        commentId: 'cmt_4',
        kind: 'suggestion',
        source: 'member',
        author: { kind: 'admin' },
        postedAt: '2026-11-11T10:00:00.000Z',
        removed: false,
        body: '',
        edited: false,
        mine: false,
        suggestion: {
          proposedText: 'First synthetic belief.',
          baseSeq: 1,
          status: 'accepted',
          decidedAt: '2026-11-11T11:00:00.000Z',
        },
      },
    ],
  },
  page: { viewerMayComment: false, viewerMaySuggest: false, comments: [] },
}

const COMMENT_HISTORY = {
  page: 1,
  hasMore: false,
  entries: [
    {
      seq: 2,
      savedAt: '2026-11-11T09:30:00.000Z',
      text: 'A synthetic reply, edited once.',
      hash: '13579bdf0246',
    },
    {
      seq: 1,
      savedAt: '2026-11-10T09:00:00.000Z',
      text: 'A synthetic reply.',
      hash: '2468ace01357',
    },
  ],
}

// The Beliefs page section (Chunk 10), as a guest sees it.
const AGREED = {
  beliefs: [
    {
      slug: 'open-example',
      tabId: 't1',
      title: 'First tab',
      paragraphs: [paragraph('b2', 'First synthetic belief.')],
      textSeq: 2,
      author: { displayName: 'Open Example', slug: 'open-example' },
      votes: {
        agree: 3,
        disagree: 1,
        earlierWording: 2,
        mayVote: false,
        viewerVoteBlock: 'sign-in',
      },
    },
  ],
  viewerMayComment: false,
  viewerWriteBlock: 'sign-in',
}

/** The one unsubscribe token this fake accepts (Chunk 14). Synthetic. */
const GOOD_UNSUBSCRIBE_TOKEN = 'v1.dXNlcl9ndWVzdA.digest.c3ludGhldGlj'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Expose-Headers': 'Content-Disposition',
}

// A receipt (Chunk 16) as the server sends it for a version not yet anchored.
const PENDING_RECEIPT = {
  format: 'org-receipt-v1',
  generatedAt: '2026-11-14T08:00:00.000Z',
  notice: [],
  versions: [
    {
      kind: 'block',
      seq: 2,
      text: 'First synthetic belief.',
      serverTime: '2026-11-01T12:30:00.000Z',
      versionHash: 'a'.repeat(64),
      prevHash: 'b'.repeat(64),
      hashInput: { included: false, withheld: ['authorUserId'], reason: 'x' },
      anchor: { state: 'pending', message: 'Not anchored yet.' },
    },
  ],
  howToVerify: [],
}

createServer((request, response) => {
  const send = (status, body) => {
    response.writeHead(status, {
      ...CORS,
      'Content-Type': 'application/json',
    })
    response.end(JSON.stringify(body))
  }
  if (request.method === 'OPTIONS') {
    response.writeHead(204, CORS)
    response.end()
    return
  }
  const url = new URL(request.url, 'http://localhost')
  // Receipts follow the page's access, as the server's do: a guest gets the
  // public page's, and the same 404 as reading for a members-only page.
  const receipt = url.pathname.match(
    /^\/api\/v1\/members\/profiles\/([^/]+)\/tabs\/([^/]+)\/receipt(\/download)?$/,
  )
  if (receipt) {
    const [, slug, tabId, download] = receipt
    const page = PROFILES[slug]
    const readable =
      page &&
      (page.access === 'full' || Boolean(request.headers.authorization)) &&
      (page.tabs ?? [{ tabId: 'm1' }]).some((tab) => tab.tabId === tabId)
    if (!readable) {
      send(404, { statusCode: 404, message: 'That page does not exist.' })
    } else if (download) {
      response.writeHead(200, {
        ...CORS,
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="receipt-${slug}-${tabId}-text-2.zip"`,
      })
      // An empty zip (end-of-central-directory record only).
      response.end(Buffer.from('504b0506' + '00'.repeat(18), 'hex'))
    } else {
      send(200, PENDING_RECEIPT)
    }
    return
  }
  const history = url.pathname.match(
    /^\/api\/v1\/members\/profiles\/open-example\/(bio|tabs\/t1)\/history$/,
  )
  if (history) {
    send(200, HISTORY[history[1]])
    return
  }
  if (
    url.pathname ===
    '/api/v1/members/profiles/open-example/comments/cmt_2/history'
  ) {
    send(200, COMMENT_HISTORY)
    return
  }
  if (url.pathname === '/api/v1/members/profiles/open-example/comments') {
    send(200, THREADS[url.searchParams.get('tab') ?? 'page'] ?? THREADS.page)
    return
  }
  const profile = url.pathname.match(/^\/api\/v1\/members\/profiles\/([^/]+)$/)
  if (profile) {
    const found = PROFILES[profile[1]]
    if (found) send(200, found)
    else send(404, { statusCode: 404, message: 'That page does not exist.' })
    return
  }
  if (url.pathname === '/api/v1/membership/guest-entry') {
    response.writeHead(204, CORS)
    response.end()
    return
  }
  if (url.pathname === '/api/v1/members/directory') {
    send(200, {
      hasMore: false,
      members: Object.values(PROFILES).map((entry) => ({
        slug: entry.slug,
        displayName: entry.displayName,
        access: entry.access,
        hasPicture: false,
        picturePublic: false,
      })),
    })
    return
  }
  if (url.pathname === '/api/v1/members/agreed-beliefs') {
    send(200, AGREED)
    return
  }
  // ORG's own pages (Chunk 10b): only Research answers; every other page is
  // unknown here, so its reactions stay hidden.
  if (url.pathname === '/api/v1/members/org-pages/research/votes') {
    send(200, {
      pageId: 'research',
      revision: 1,
      votes: {
        agree: 2,
        disagree: 1,
        earlierWording: 1,
        mayVote: false,
        viewerVoteBlock: 'sign-in',
      },
    })
    return
  }
  if (url.pathname === '/api/v1/members/org-pages/research/comments') {
    send(200, {
      viewerMayComment: false,
      viewerWriteBlock: 'sign-in',
      viewerMaySuggest: false,
      comments: [
        {
          commentId: 'cmt_org1',
          kind: 'comment',
          source: 'member',
          author: { kind: 'member', displayName: 'Open Example' },
          postedAt: '2026-11-12T09:00:00.000Z',
          removed: false,
          body: 'A synthetic comment on an ORG page.',
          edited: false,
          mine: false,
          stance: 'agree',
          replies: [],
        },
        // Chunk 13: hidden by a moderator, as a guest receives it: no text,
        // no badge, only its place.
        {
          commentId: 'cmt_org2',
          kind: 'comment',
          source: 'member',
          author: { kind: 'member', displayName: 'Open Example' },
          postedAt: '2026-11-12T10:00:00.000Z',
          removed: false,
          moderated: 'hidden',
          edited: false,
          mine: false,
          replies: [],
        },
      ],
    })
    return
  }
  // Chunk 14: the one-click unsubscribe. Only this synthetic token is good;
  // the real server checks an HMAC signature.
  if (
    url.pathname === '/api/v1/notifications/unsubscribe' &&
    request.method === 'POST'
  ) {
    let raw = ''
    request.on('data', (chunk) => (raw += chunk))
    request.on('end', () => {
      let token
      try {
        token = JSON.parse(raw).token
      } catch {
        token = undefined
      }
      if (token === GOOD_UNSUBSCRIBE_TOKEN) {
        send(200, { unsubscribed: true, scope: 'digest' })
      } else {
        send(400, {
          statusCode: 400,
          message:
            'This link is not valid. You can change your email settings after signing in.',
        })
      }
    })
    return
  }
  // Chunk 15: search as the server answers a GUEST. A request carrying a
  // token gets a members-only result, so a guest page that ever sent one
  // would show it, and the browser test would fail.
  if (url.pathname === '/api/v1/search/fragments') {
    send(200, { fragments: ['first tab'] })
    return
  }
  if (url.pathname === '/api/v1/search') {
    send(200, fakeSearch(url, Boolean(request.headers.authorization)))
    return
  }
  if (url.pathname === '/api/v1/members/chats') {
    send(200, { voting: 'hidden' })
    return
  }
  send(404, { statusCode: 404, message: 'Not found' })
}).listen(3001, '127.0.0.1')

/** Synthetic search answers (Chunk 15), shaped like the real server's. */
function fakeSearch(url, signedIn) {
  const q = (url.searchParams.get('q') ?? '').trim().toLowerCase()
  const type = url.searchParams.get('type') ?? 'all'
  const page = Number(url.searchParams.get('page') ?? '1')
  const mark = (snippet) => {
    const at = snippet.toLowerCase().indexOf(q.split(' ')[0])
    return at < 0 ? [] : [{ start: at, end: at + q.split(' ')[0].length }]
  }
  const all = []
  if ('community'.includes(q) || q.includes('community')) {
    all.push({
      kind: 'page',
      pageId: 'community',
      title: 'Members Community',
      part: 'title',
      snippet: 'Members Community',
      highlights: mark('Members Community'),
    })
  }
  if (q.includes('example')) {
    all.push(
      {
        kind: 'member',
        slug: 'open-example',
        displayName: 'Open Example',
        membersOnly: false,
        snippet: 'Open Example',
        highlights: mark('Open Example'),
      },
      {
        kind: 'member',
        slug: 'members-example',
        displayName: 'Members Example',
        membersOnly: !signedIn,
        snippet: 'Members Example',
        highlights: mark('Members Example'),
      },
    )
    for (let n = 1; n <= 10; n += 1) {
      all.push({
        kind: 'belief',
        slug: 'open-example',
        displayName: 'Open Example',
        tabId: `t${n}`,
        title: `Example tab ${n}`,
        matched: 'title',
        snippet: `Example tab ${n}`,
        highlights: mark(`Example tab ${n}`),
      })
    }
    if (signedIn) {
      all.push({
        kind: 'belief',
        slug: 'members-example',
        displayName: 'Members Example',
        tabId: 'tm',
        title: 'MEMBERS-ONLY SECRET',
        matched: 'title',
        snippet: 'MEMBERS-ONLY SECRET example',
        highlights: [],
      })
    }
  }
  const kinds =
    {
      all: ['member', 'belief', 'page'],
      members: ['member'],
      beliefs: ['belief'],
      pages: ['page'],
    }[type] ?? []
  const shown = all.filter((result) => kinds.includes(result.kind))
  return {
    query: q,
    type,
    page,
    pageSize: 10,
    total: shown.length,
    results: shown.slice((page - 1) * 10, page * 10),
  }
}
