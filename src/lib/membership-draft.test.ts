// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  DRAFT_MAX_AGE_MS,
  clearJoinDraft,
  loadJoinDraft,
  saveJoinDraft,
} from './membership-draft'
import type { JoinDraft } from './membership-draft'

const draft: JoinDraft = {
  displayName: 'Quiet Fern',
  slug: 'quiet-fern',
  slugEdited: false,
  anonymous: true,
  visibility: 'members',
  bio: 'Text.',
  beliefs: [{ title: 'God', text: 'One.' }],
  contacts: [],
}

beforeEach(() => sessionStorage.clear())
afterEach(() => vi.restoreAllMocks())

describe('join draft', () => {
  it('round-trips within the same account', () => {
    saveJoinDraft('user_a', draft)
    expect(loadJoinDraft('user_a')).toEqual(draft)
  })

  it('is kept per tab, not in storage that outlives the browser', () => {
    saveJoinDraft('user_a', draft)
    expect(localStorage.length).toBe(0)
  })

  it('is not given to another account, and is dropped', () => {
    saveJoinDraft('user_a', draft)
    expect(loadJoinDraft('user_b')).toBeUndefined()
    expect(sessionStorage.length).toBe(0)
  })

  it('expires', () => {
    saveJoinDraft('user_a', draft)
    const later = Date.now() + DRAFT_MAX_AGE_MS + 1
    vi.spyOn(Date, 'now').mockReturnValue(later)
    expect(loadJoinDraft('user_a')).toBeUndefined()
    expect(sessionStorage.length).toBe(0)
  })

  it('is cleared on request', () => {
    saveJoinDraft('user_a', draft)
    clearJoinDraft()
    expect(loadJoinDraft('user_a')).toBeUndefined()
  })

  it('reads nothing when empty or corrupted', () => {
    expect(loadJoinDraft('user_a')).toBeUndefined()
    sessionStorage.setItem('org-members-join-draft', '{not json')
    expect(loadJoinDraft('user_a')).toBeUndefined()
  })

  it('survives storage being blocked', () => {
    const blocked = () => {
      throw new Error('blocked')
    }
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(blocked)
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(blocked)
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(blocked)
    expect(() => saveJoinDraft('user_a', draft)).not.toThrow()
    expect(loadJoinDraft('user_a')).toBeUndefined()
    expect(() => clearJoinDraft()).not.toThrow()
  })
})
