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
        wholeText: true,
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
        wholeText: true,
      },
      {
        seq: 1,
        savedAt: '2026-10-11T08:00:00.000Z',
        text: 'An older synthetic wording.',
        hash: 'fedcba987654',
        source: 'imported',
        wholeText: true,
      },
    ],
  },
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
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
  const history = url.pathname.match(
    /^\/api\/v1\/members\/profiles\/open-example\/(bio|tabs\/t1)\/history$/,
  )
  if (history) {
    send(200, HISTORY[history[1]])
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
  if (url.pathname === '/api/v1/members/chats') {
    send(200, { voting: 'hidden' })
    return
  }
  send(404, { statusCode: 404, message: 'Not found' })
}).listen(3001, '127.0.0.1')
