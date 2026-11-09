import { useEffect, useState } from 'react'
import { Link } from '@tanstack/react-router'

const HIDDEN_KEY = 'org-get-started-hidden'

function isHidden() {
  try {
    return localStorage.getItem(HIDDEN_KEY) === '1'
  } catch {
    return false
  }
}

function hide() {
  try {
    localStorage.setItem(HIDDEN_KEY, '1')
  } catch {
    // Private windows may block storage; it stays hidden for this visit.
  }
}

const STEPS = [
  "Read other members' pages.",
  'Leave a few respectful comments.',
  'Suggest clearer wording where it could help.',
  'Join the chats.',
]

/** The four things a new member can do first, on their own page (plan §2d). */
export function GetStartedChecklist() {
  const [hidden, setHidden] = useState(true)

  useEffect(() => setHidden(isHidden()), [])

  if (hidden) return null

  return (
    <section
      aria-label="Get started"
      className="mt-10 border border-dashed border-[rgba(120,174,162,0.4)] p-5"
    >
      <div className="flex items-start justify-between gap-4">
        <h2 className="text-lg font-light uppercase tracking-[0.06em] text-[#f6efd9]">
          Get started
        </h2>
        <button
          type="button"
          onClick={() => {
            hide()
            setHidden(true)
          }}
          className="text-xs text-[#b8ad8d] underline underline-offset-4"
        >
          Hide this
        </button>
      </div>
      <ol className="mt-3 list-decimal pl-5 text-sm leading-7 text-[#b8ad8d]">
        {STEPS.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
      <Link
        to="/community"
        className="mt-3 inline-block text-sm text-[#f1d78a] underline underline-offset-4"
      >
        Open the Members Community
      </Link>
    </section>
  )
}
