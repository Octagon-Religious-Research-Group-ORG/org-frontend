import { describe, expect, it } from 'vitest'
import { ANCHOR_LOG_KEYS, verifierKeyFor } from './anchor-log'

describe('verifierKeyFor', () => {
  it('gives the TEST backend its own pinned key', () => {
    expect(
      verifierKeyFor('https://org-backend-testing.onrender.com/api/v1'),
    ).toBe(ANCHOR_LOG_KEYS['org-backend-testing.onrender.com'])
    expect(
      verifierKeyFor('https://org-backend-testing.onrender.com/api/v1'),
    ).toMatch(/^orgspirituality\.org\/anchors\/v1\+[0-9a-f]{8}\+/)
  })

  it('gives no key for a backend with none pinned, a missing or a malformed address', () => {
    expect(verifierKeyFor('https://api.example.org/api/v1')).toBeNull()
    expect(verifierKeyFor('http://localhost:3001/api/v1')).toBeNull()
    expect(verifierKeyFor(undefined)).toBeNull()
    expect(verifierKeyFor('not a url')).toBeNull()
  })
})
