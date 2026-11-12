import { describe, expect, it } from 'vitest'
import type { CommentView, ThreadPage } from '#/lib/comments-api'
import {
  EMPTY_THREAD,
  shownComments,
  withComment,
  withMorePages,
  withPages,
} from './thread-state'

const c = (
  commentId: string,
  extra: Partial<CommentView> = {},
): CommentView => ({
  commentId,
  kind: 'comment',
  source: 'member',
  author: { kind: 'member' },
  postedAt: '2026-11-12T09:00:00.000Z',
  removed: false,
  body: commentId,
  edited: false,
  mine: false,
  ...extra,
})
const page = (
  comments: Array<CommentView>,
  nextAfter?: string,
): ThreadPage => ({
  comments,
  viewerMayComment: true,
  viewerMaySuggest: false,
  ...(nextAfter ? { nextAfter } : {}),
})

describe('thread state', () => {
  it('moves a posted comment into the pages once a page read holds it', () => {
    const start = withPages(EMPTY_THREAD, [page([c('a')], 'a')])
    const posted = withComment(start, c('new'))
    expect(posted.posted.map((x) => x.commentId)).toEqual(['new'])
    expect(shownComments(posted).map((x) => x.commentId)).toEqual(['a', 'new'])
    // A refresh from the start that holds it.
    const refreshed = withPages(posted, [page([c('a'), c('new')])])
    expect(refreshed.posted).toEqual([])
    // A refresh that does not hold it yet keeps it posted.
    const notYet = withPages(posted, [page([c('a')], 'a')])
    expect(notYet.posted.map((x) => x.commentId)).toEqual(['new'])
    const more = withMorePages(notYet, [page([c('b')])])
    expect(more.posted.map((x) => x.commentId)).toEqual(['new'])
  })

  it('replaces a reply deep in a thread and leaves the others as they are', () => {
    const state = withPages(EMPTY_THREAD, [
      page([
        c('a', { replies: [c('a1'), c('a2')] }),
        c('b'),
        c('d', { replies: [c('d1')] }),
      ]),
    ])
    const next = withComment(state, c('a2', { body: 'changed' }))
    const [a, b, d] = next.pages[0].comments
    expect(a.replies?.map((r) => r.body)).toEqual(['a1', 'changed'])
    expect(b).toBe(state.pages[0].comments[1])
    expect(d).toBe(state.pages[0].comments[2])
  })

  it('adds a reply to a comment with none yet, and to a posted one', () => {
    const state = withComment(
      withPages(EMPTY_THREAD, [page([c('a')], 'a')]),
      c('mine'),
    )
    const onPage = withComment(state, c('r1', { parentCommentId: 'a' }))
    expect(
      onPage.pages[0].comments[0].replies?.map((r) => r.commentId),
    ).toEqual(['r1'])
    const onPosted = withComment(onPage, c('r2', { parentCommentId: 'mine' }))
    expect(onPosted.posted[0].replies?.map((r) => r.commentId)).toEqual(['r2'])
  })

  it('posts after nothing when no page was read', () => {
    expect(withComment(EMPTY_THREAD, c('new')).posted).toHaveLength(1)
  })
})
