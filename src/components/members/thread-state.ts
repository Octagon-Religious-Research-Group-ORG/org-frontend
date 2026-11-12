import type { CommentView, ThreadPage } from '#/lib/comments-api'

/**
 * What a thread shows: the pages read from the server, and the comments
 * this reader posted that sit beyond the last page read (review round 2,
 * item 3). A write answers with its comment, which is put in place here:
 * the thread is never read again to show it.
 */
export interface ThreadState {
  pages: Array<ThreadPage>
  /** Top-level comments posted here that no loaded page holds yet. */
  posted: Array<CommentView>
}

export const EMPTY_THREAD: ThreadState = { pages: [], posted: [] }

const ids = (pages: Array<ThreadPage>) =>
  new Set(pages.flatMap((page) => page.comments.map((c) => c.commentId)))

/** Pages read after the first ones; posted comments they hold move there. */
export function withMorePages(
  state: ThreadState,
  more: Array<ThreadPage>,
): ThreadState {
  const pages = [...state.pages, ...more]
  const loaded = ids(pages)
  return {
    pages,
    posted: state.posted.filter((c) => !loaded.has(c.commentId)),
  }
}

/** The pages read again from the start; posted ones they hold move there. */
export function withPages(
  state: ThreadState,
  pages: Array<ThreadPage>,
): ThreadState {
  const loaded = ids(pages)
  return {
    pages,
    posted: state.posted.filter((c) => !loaded.has(c.commentId)),
  }
}

/** Replaces one comment wherever it is shown, keeping its replies. */
function replaceIn(
  list: Array<CommentView>,
  view: CommentView,
): { list: Array<CommentView>; found: boolean } {
  let found = false
  const next = list.map((comment): CommentView => {
    if (comment.commentId === view.commentId) {
      found = true
      return {
        ...view,
        ...(comment.replies ? { replies: comment.replies } : {}),
      }
    }
    if (!comment.replies) return comment
    const replies = replaceIn(comment.replies, view)
    if (replies.found) found = true
    return replies.found ? { ...comment, replies: replies.list } : comment
  })
  return { list: next, found }
}

/** Adds a new reply under its top-level comment, wherever that is shown. */
function addReply(list: Array<CommentView>, reply: CommentView) {
  let found = false
  const next = list.map((comment) => {
    if (comment.commentId !== reply.parentCommentId) return comment
    found = true
    return { ...comment, replies: [...(comment.replies ?? []), reply] }
  })
  return { list: next, found }
}

/**
 * Puts a comment the server just answered with into the thread:
 * - one already shown (an edit, a removal, a decision) is replaced in place;
 * - a new reply goes under its top-level comment;
 * - a new top-level comment goes at the end: on the last page when every
 *   page is read, otherwise after the loaded pages until a page holds it.
 */
export function withComment(
  state: ThreadState,
  view: CommentView,
): ThreadState {
  const inPages = state.pages.map((page) => replaceIn(page.comments, view))
  const inPosted = replaceIn(state.posted, view)
  if (inPages.some((r) => r.found) || inPosted.found) {
    return {
      pages: state.pages.map((page, i) => ({
        ...page,
        comments: inPages[i].list,
      })),
      posted: inPosted.list,
    }
  }
  if (view.parentCommentId !== undefined) {
    const pages = state.pages.map((page) => addReply(page.comments, view))
    const posted = addReply(state.posted, view)
    return {
      pages: state.pages.map((page, i) => ({
        ...page,
        comments: pages[i].list,
      })),
      posted: posted.list,
    }
  }
  const last = state.pages.at(-1)
  const top = { ...view, replies: view.replies ?? [] }
  if (last && !last.nextAfter) {
    return {
      ...state,
      pages: [
        ...state.pages.slice(0, -1),
        { ...last, comments: [...last.comments, top] },
      ],
    }
  }
  return { ...state, posted: [...state.posted, top] }
}

/** Everything shown, in order: the loaded pages, then the posted ones. */
export function shownComments(state: ThreadState): Array<CommentView> {
  return [...state.pages.flatMap((page) => page.comments), ...state.posted]
}
