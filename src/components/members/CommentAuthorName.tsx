import { Link } from '@tanstack/react-router'
import type { CommentAuthor } from '#/lib/comments-api'

/**
 * Who wrote a comment: a member by their page's display name, linked only
 * when the server says this reader may open that page, and "A member" when
 * the server names no one; an Apple Pages name as plain text, since it
 * proves no identity.
 */
/** The author as words, for labels: never more than the server said. */
export function authorLabel(author: CommentAuthor) {
  if (author.kind === 'imported') return author.name
  if (author.kind === 'admin') return 'ORG admin'
  return author.displayName ?? 'A member'
}

export function CommentAuthorName({ author }: { author: CommentAuthor }) {
  const style = 'text-sm text-[#f6efd9] [overflow-wrap:anywhere]'
  switch (author.kind) {
    case 'member':
      return author.slug && author.displayName ? (
        <Link
          to="/$slug"
          params={{ slug: author.slug }}
          className={`${style} underline underline-offset-4`}
        >
          {author.displayName}
        </Link>
      ) : (
        <span className={style}>{authorLabel(author)}</span>
      )
    default:
      return <span className={style}>{authorLabel(author)}</span>
  }
}
