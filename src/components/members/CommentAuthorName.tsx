import { Link } from '@tanstack/react-router'
import type { CommentAuthor } from '#/lib/comments-api'

/**
 * Who wrote a comment: a member by their page's display name, linked only
 * when the server says this reader may open that page, and "A member" when
 * the server names no one; an Apple Pages name as plain text, since it
 * proves no identity. An imported comment an admin linked to its author's
 * claimed page (Chunk 11) keeps its Pages name and adds that member.
 */
/** The author as words, for labels: never more than the server said. */
export function authorLabel(author: CommentAuthor) {
  if (author.kind === 'imported') {
    return author.member
      ? `${author.name} (now ${author.member.displayName})`
      : author.name
  }
  if (author.kind === 'admin') return 'ORG admin'
  return author.displayName ?? 'A member'
}

const style = 'text-sm text-[#f6efd9] [overflow-wrap:anywhere]'

function MemberName({
  displayName,
  slug,
}: {
  displayName: string
  slug?: string
}) {
  return slug ? (
    <Link
      to="/$slug"
      params={{ slug }}
      className={`${style} underline underline-offset-4`}
    >
      {displayName}
    </Link>
  ) : (
    <span className={style}>{displayName}</span>
  )
}

export function CommentAuthorName({ author }: { author: CommentAuthor }) {
  switch (author.kind) {
    case 'member':
      return author.displayName ? (
        <MemberName displayName={author.displayName} slug={author.slug} />
      ) : (
        <span className={style}>{authorLabel(author)}</span>
      )
    case 'imported':
      return author.member ? (
        <span className={style}>
          {author.name} (now <MemberName {...author.member} />)
        </span>
      ) : (
        <span className={style}>{author.name}</span>
      )
    default:
      return <span className={style}>{authorLabel(author)}</span>
  }
}
