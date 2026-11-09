import type { ParagraphView } from '#/lib/members-api'
import { MemberText } from './MemberText'

/** A member's paragraphs, headings and outline items, as plain text. */
export function Paragraphs({
  paragraphs,
}: {
  paragraphs: Array<ParagraphView>
}) {
  return (
    <>
      {paragraphs.map((paragraph) =>
        paragraph.kind === 'heading' ? (
          <h3
            key={paragraph.blockId}
            className="mt-5 text-lg font-light text-[#f6efd9] [overflow-wrap:anywhere]"
          >
            <MemberText text={paragraph.text} />
          </h3>
        ) : (
          <p
            key={paragraph.blockId}
            className="mt-3 whitespace-pre-wrap text-[15px] leading-7 text-[#d8ceb0] [overflow-wrap:anywhere]"
          >
            {paragraph.label && (
              <span className="mr-2 text-[#78aea2]">{paragraph.label}</span>
            )}
            <MemberText text={paragraph.text} />
          </p>
        ),
      )}
    </>
  )
}
