import { Link } from '@tanstack/react-router'
import type { CommentAuthor } from '#/lib/comments-api'

/**
 * Who wrote a comment: a member by their page's display name, linked only
 * when the server says this reader may open that page; an Apple Pages name
 * as plain text, since it proves no identity.
 */
export function CommentAuthorName({ author }: { author: CommentAuthor }) {
  const style = 'text-sm text-[#f6efd9] [overflow-wrap:anywhere]'
  switch (author.kind) {
    case 'member':
      return author.slug ? (
        <Link
          to="/$slug"
          params={{ slug: author.slug }}
          className={`${style} underline underline-offset-4`}
        >
          {author.displayName}
        </Link>
      ) : (
        <span className={style}>{author.displayName}</span>
      )
    case 'imported':
      return <span className={style}>{author.name}</span>
    case 'admin':
      return <span className={style}>ORG admin</span>
    default:
      return <span className={style}>A former member</span>
  }
}
