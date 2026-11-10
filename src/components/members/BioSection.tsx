import { useState } from 'react'
import type { ParagraphView } from '#/lib/members-api'
import { BioEditor } from './BioEditor'
import { buttonStyle } from './editor-styles'
import { HistoryPanel } from './HistoryPanel'
import { Paragraphs } from './Paragraphs'

/**
 * The bio, its history for anyone who can read it, and the owner's editor.
 * A page with no bio shows nothing to a reader; its owner can still write one.
 */
export function BioSection({
  slug,
  bio,
  owner,
}: {
  slug: string
  bio: Array<ParagraphView>
  owner?: { baseSeq: number; onChanged: () => void }
}) {
  const [editing, setEditing] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [notice, setNotice] = useState<string>()

  if (bio.length === 0 && !owner) return null

  return (
    <section aria-label="About" className="mt-10 max-w-3xl">
      {editing && owner ? (
        <BioEditor
          bio={bio}
          baseSeq={owner.baseSeq}
          onDone={(changed) => {
            setEditing(false)
            if (changed) {
              setNotice('Saved. The earlier version is in the history.')
              owner.onChanged()
            }
          }}
        />
      ) : (
        <Paragraphs paragraphs={bio} />
      )}
      <div className="flex flex-wrap gap-3">
        {bio.length > 0 && (
          <button
            type="button"
            aria-expanded={showHistory}
            onClick={() => setShowHistory((shown) => !shown)}
            className={buttonStyle}
          >
            Bio history
          </button>
        )}
        {owner && !editing && (
          <button
            type="button"
            onClick={() => {
              setNotice(undefined)
              setEditing(true)
            }}
            className={buttonStyle}
          >
            Edit bio
          </button>
        )}
      </div>
      {notice && (
        <p role="status" className="mt-3 text-sm text-[#78aea2]">
          {notice}
        </p>
      )}
      {showHistory && (
        <HistoryPanel
          slug={slug}
          label="the bio"
          onClose={() => setShowHistory(false)}
        />
      )}
    </section>
  )
}
