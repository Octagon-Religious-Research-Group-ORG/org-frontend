import { useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { useOrgAuth } from '#/lib/auth'
import {
  MAX_PICTURE_BYTES,
  addBeliefTab,
  changeVisibility,
  uploadProfilePicture,
} from '#/lib/members-api'
import { VISIBILITY_OPTIONS } from '#/lib/membership-api'
import type { ProfileVisibility } from '#/lib/membership-api'

const SESSION_UNCONFIRMED =
  "We couldn't confirm that you're signed in. Please try again."

const field =
  'mt-2 w-full border border-[rgba(236,226,196,0.3)] bg-[#0b0d12] px-3 py-2 text-sm text-[#ece2c4]'
const label = 'block text-xs uppercase tracking-[0.14em] text-[#b8ad8d]'
const primary =
  'mt-3 bg-[#78aea2] px-4 py-2 font-mono text-[10px] uppercase tracking-[0.18em] text-[#0b0d12] disabled:opacity-35'

/** The owner's tools on their own page: visibility, a new tab, the picture. */
export function OwnerTools({
  visibility,
  onChanged,
}: {
  visibility: ProfileVisibility
  onChanged: () => void
}) {
  const auth = useOrgAuth()
  const [chosen, setChosen] = useState<ProfileVisibility>(visibility)
  const [title, setTitle] = useState('')
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string>()
  const [problem, setProblem] = useState<string>()

  const run = async (
    action: (token: string) => Promise<unknown>,
    done: string,
  ) => {
    setBusy(true)
    setNotice(undefined)
    setProblem(undefined)
    try {
      const token = await auth.getToken()
      if (!token) throw new Error(SESSION_UNCONFIRMED)
      await action(token)
      setNotice(done)
      onChanged()
      return true
    } catch (err) {
      setProblem(err instanceof Error ? err.message : 'Something went wrong.')
      return false
    } finally {
      setBusy(false)
    }
  }

  const saveVisibility = (event: FormEvent) => {
    event.preventDefault()
    void run((token) => changeVisibility(token, chosen), 'Visibility saved.')
  }

  const saveBelief = (event: FormEvent) => {
    event.preventDefault()
    void run(
      (token) => addBeliefTab(token, { title, text }),
      'Your new tab is on your page.',
    ).then((saved) => {
      if (saved) {
        setTitle('')
        setText('')
      }
    })
  }

  const choosePicture = (event: ChangeEvent<HTMLInputElement>) => {
    const picture = event.target.files?.[0]
    event.target.value = ''
    if (!picture) return
    if (picture.size > MAX_PICTURE_BYTES) {
      setProblem('That picture is over 10 MB. Please choose a smaller one.')
      return
    }
    void run(
      (token) => uploadProfilePicture(token, picture),
      'Your picture is saved.',
    )
  }

  return (
    <section
      aria-label="Your page settings"
      className="mt-10 border border-[rgba(236,226,196,0.16)] bg-[rgba(11,13,18,0.85)] p-5 sm:p-8"
    >
      <h2 className="text-lg font-light uppercase tracking-[0.06em] text-[#f6efd9]">
        Your page
      </h2>

      <form onSubmit={saveVisibility} className="mt-5">
        <label className={label}>
          Who can see your page
          <select
            value={chosen}
            onChange={(event) =>
              setChosen(event.target.value as ProfileVisibility)
            }
            className={field}
          >
            {VISIBILITY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <p className="mt-2 text-xs leading-5 text-[#9f9676]">
          {VISIBILITY_OPTIONS.find((option) => option.value === chosen)?.hint}
        </p>
        <button type="submit" disabled={busy} className={primary}>
          Save visibility
        </button>
      </form>

      <form onSubmit={saveBelief} className="mt-8">
        <h3 className="text-sm uppercase tracking-[0.14em] text-[#ece2c4]">
          Add a belief tab
        </h3>
        <p className="mt-2 text-xs leading-5 text-[#9f9676]">
          Ideally there is one belief per tab, so each can have its own comments
          and votes. Separate paragraphs with a blank line.
        </p>
        <p className="mt-2 text-xs leading-5 text-[#9f9676]">
          Your bio is free text, and beliefs can be in any order. An outline
          list is suggested, but not required.
        </p>
        <label className={`${label} mt-3`}>
          Title
          <input
            required
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className={field}
          />
        </label>
        <label className={`${label} mt-3`}>
          Belief
          <textarea
            required
            rows={5}
            value={text}
            onChange={(event) => setText(event.target.value)}
            className={field}
          />
        </label>
        <button type="submit" disabled={busy} className={primary}>
          Add tab
        </button>
      </form>

      <div className="mt-8">
        <label className={label}>
          Profile picture
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            disabled={busy}
            onChange={choosePicture}
            className="mt-2 block w-full text-sm text-[#b8ad8d]"
          />
        </label>
        <p className="mt-2 text-xs leading-5 text-[#9f9676]">
          Optional, and it doesn't have to be you: artwork, an AI image, a pet
          or a hobby all work. Up to 10 MB.
        </p>
      </div>

      {notice && (
        <p role="status" className="mt-4 text-sm text-[#78aea2]">
          {notice}
        </p>
      )}
      {problem && (
        <p role="alert" className="mt-4 text-sm text-[#f1a07a]">
          {problem}
        </p>
      )}
    </section>
  )
}
