import { useEffect, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import { Plus, X } from 'lucide-react'
import { useOrgAuth } from '#/lib/auth'
import {
  VISIBILITY_OPTIONS,
  checkSlug,
  fetchMembershipTerms,
  fetchMyMembership,
  joinMembership,
  suggestSlug,
} from '#/lib/membership-api'
import type {
  ContactEntry,
  MembershipSummary,
  MembershipTerms,
  ProfileVisibility,
  SlugAvailability,
} from '#/lib/membership-api'
import { ContactRows, field } from './ContactRows'

const MAX_BELIEFS = 20

const SLUG_MESSAGES: Record<string, string> = {
  format: 'Use lowercase letters, numbers and single hyphens (2 to 80).',
  reserved: 'That address is used by the website. Please choose another.',
  taken: 'That address is already taken.',
}

function Section({
  title,
  hint,
  children,
}: {
  title: string
  hint?: ReactNode
  children: ReactNode
}) {
  return (
    <fieldset className="grid gap-3 border-t border-[rgba(236,226,196,0.12)] pt-6">
      <legend className="font-mono text-[10px] uppercase tracking-[0.26em] text-[#78aea2]">
        {title}
      </legend>
      {hint && <p className="text-xs leading-6 text-[#9f9676]">{hint}</p>}
      {children}
    </fieldset>
  )
}

/**
 * The new-member form (plan Chunk 6): how the member is known, their page
 * address, who can see it, bio, beliefs (one per tab), contacts, and the
 * membership terms, which the server versions and records.
 */
export function MembershipJoinForm({ nickname }: { nickname: boolean }) {
  const auth = useOrgAuth()
  const [terms, setTerms] = useState<MembershipTerms>()
  const [summary, setSummary] = useState<MembershipSummary>()
  const [loadError, setLoadError] = useState<string>()

  const [anonymous, setAnonymous] = useState(nickname)
  const [displayName, setDisplayName] = useState('')
  const [slug, setSlug] = useState('')
  const [slugEdited, setSlugEdited] = useState(false)
  const [slugState, setSlugState] = useState<SlugAvailability>()
  const [visibility, setVisibility] = useState<ProfileVisibility>(
    nickname ? 'members' : 'public',
  )
  const [bio, setBio] = useState('')
  const [beliefs, setBeliefs] = useState([{ title: '', text: '' }])
  const [contacts, setContacts] = useState<ContactEntry[]>([])
  const [backup, setBackup] = useState<ContactEntry[]>([
    { method: 'telegram', value: '' },
  ])
  const [agreed, setAgreed] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string>()

  useEffect(() => {
    const closed = new AbortController()
    void (async () => {
      try {
        const token = await auth.getToken()
        const [loadedTerms, loadedSummary] = await Promise.all([
          fetchMembershipTerms(),
          token ? fetchMyMembership(token) : undefined,
        ])
        if (closed.signal.aborted) return
        setTerms(loadedTerms)
        setSummary(loadedSummary)
      } catch (err) {
        if (!closed.signal.aborted) {
          setLoadError(
            err instanceof Error ? err.message : 'Membership is unavailable.',
          )
        }
      }
    })()
    return () => closed.abort()
  }, [auth])

  useEffect(() => {
    if (!slugEdited) setSlug(suggestSlug(displayName))
  }, [displayName, slugEdited])

  useEffect(() => {
    setSlugState(undefined)
    if (slug.length < 2) return
    const timer = setTimeout(() => {
      checkSlug(slug)
        .then(setSlugState)
        .catch(() => setSlugState(undefined))
    }, 400)
    return () => clearTimeout(timer)
  }, [slug])

  if (loadError) {
    return (
      <p role="alert" className="text-sm text-[#f1a07a]">
        {loadError}
      </p>
    )
  }
  if (!terms) {
    return (
      <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#9f9676]">
        Loading…
      </div>
    )
  }
  if (summary && summary.status !== 'none') {
    return (
      <div className="border border-[rgba(236,226,196,0.16)] p-8">
        <h1 className="text-3xl font-light uppercase tracking-[0.06em] text-[#f6efd9]">
          {summary.status === 'pending'
            ? 'Your page is waiting for approval'
            : 'You are already a member'}
        </h1>
        <p className="mt-4 text-sm leading-7 text-[#b8ad8d]">
          {summary.status === 'pending'
            ? 'An admin reviews every new page before it opens to the community.'
            : 'Your page is in the Members Community.'}{' '}
          <Link to="/community" className="text-[#f1d78a] underline">
            Back to the Members Community
          </Link>
        </p>
      </div>
    )
  }

  const updateBelief = (
    index: number,
    patch: { title?: string; text?: string },
  ) => setBeliefs(beliefs.map((b, i) => (i === index ? { ...b, ...patch } : b)))

  const filledBackup = backup.filter((row) => row.value.trim())
  const canSubmit =
    agreed &&
    !submitting &&
    displayName.trim() &&
    bio.trim() &&
    beliefs.every((b) => b.title.trim() && b.text.trim()) &&
    filledBackup.length > 0 &&
    slugState?.available === true

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!canSubmit) return
    setSubmitting(true)
    setSubmitError(undefined)
    try {
      const token = await auth.getToken()
      if (!token) throw new Error('Please sign in again.')
      const result = await joinMembership(token, {
        displayName,
        slug,
        anonymous,
        visibility,
        bio,
        beliefs,
        contacts: contacts.filter((row) => row.value.trim()),
        backupContacts: filledBackup,
        termsVersion: terms.version,
      })
      setSummary(result)
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : 'Your page could not be created.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={(event) => void submit(event)} className="grid gap-8">
      <header>
        <div className="font-mono text-[10px] uppercase tracking-[0.28em] text-[#78aea2]">
          Members Community
        </div>
        <h1 className="mt-2 text-[clamp(32px,5vw,56px)] font-light uppercase leading-none tracking-[0.06em] text-[#f6efd9]">
          Create your page
        </h1>
        <p className="mt-4 max-w-2xl text-sm leading-7 text-[#b8ad8d]">
          Your page holds your bio and your beliefs, one belief per tab. Every
          belief and every edit is timestamped. Read{' '}
          <Link to="/membership" className="text-[#f1d78a] underline">
            Membership
          </Link>{' '}
          for the kinds of membership and what each is for.
        </p>
      </header>

      <Section title="How you're known">
        <div className="grid gap-2 sm:grid-cols-2">
          {[
            { value: false, label: 'My own name' },
            { value: true, label: 'A nickname (anonymous)' },
          ].map((option) => (
            <label
              key={option.label}
              className="flex items-center gap-2 border border-[rgba(236,226,196,0.18)] px-3 py-2 text-sm text-[#ece2c4]"
            >
              <input
                type="radio"
                name="anonymous"
                checked={anonymous === option.value}
                onChange={() => setAnonymous(option.value)}
              />
              {option.label}
            </label>
          ))}
        </div>
        <label className="grid gap-1 text-xs text-[#b8ad8d]">
          {anonymous ? 'Nickname' : 'Name'}
          <input
            required
            maxLength={120}
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            className={field}
          />
        </label>
        <label className="grid gap-1 text-xs text-[#b8ad8d]">
          Page address
          <div className="flex items-center gap-1">
            <span className="text-sm text-[#7f775f]">orgspirituality.org/</span>
            <input
              required
              maxLength={80}
              value={slug}
              onChange={(event) => {
                setSlugEdited(true)
                setSlug(event.target.value.toLowerCase())
              }}
              className={field}
            />
          </div>
          {slugState && (
            <span
              className={
                slugState.available ? 'text-[#9dcf83]' : 'text-[#f1a07a]'
              }
            >
              {slugState.available
                ? 'Available.'
                : SLUG_MESSAGES[slugState.reason]}
            </span>
          )}
        </label>
      </Section>

      <Section title="Who can see your page" hint="You can change this later.">
        {VISIBILITY_OPTIONS.map((option) => (
          <label
            key={option.value}
            className="flex items-start gap-3 border border-[rgba(236,226,196,0.18)] px-3 py-2"
          >
            <input
              type="radio"
              name="visibility"
              className="mt-1"
              checked={visibility === option.value}
              onChange={() => setVisibility(option.value)}
            />
            <span>
              <span className="block text-sm text-[#ece2c4]">
                {option.label}
              </span>
              <span className="block text-xs leading-5 text-[#9f9676]">
                {option.hint}
              </span>
            </span>
          </label>
        ))}
      </Section>

      <Section
        title="Bio"
        hint="Free text about yourself. Leave a blank line between paragraphs."
      >
        <textarea
          aria-label="Bio"
          required
          rows={6}
          value={bio}
          onChange={(event) => setBio(event.target.value)}
          className={field}
        />
      </Section>

      <Section
        title="Beliefs"
        hint="Ideally one belief per tab, in any order. You need at least one; you can add more tabs on your page later."
      >
        {beliefs.map((belief, index) => (
          <div
            key={index}
            className="grid gap-2 border border-[rgba(236,226,196,0.14)] p-3"
          >
            <div className="flex gap-2">
              <input
                aria-label={`Belief ${index + 1} title`}
                placeholder="Tab title, e.g. God"
                required
                maxLength={120}
                value={belief.title}
                onChange={(event) =>
                  updateBelief(index, { title: event.target.value })
                }
                className={field}
              />
              {beliefs.length > 1 && (
                <button
                  type="button"
                  aria-label={`Remove belief ${index + 1}`}
                  onClick={() =>
                    setBeliefs(beliefs.filter((_, i) => i !== index))
                  }
                  className="grid w-9 place-items-center border border-[rgba(236,226,196,0.22)] text-[#b8ad8d] hover:text-[#f6efd9]"
                >
                  <X size={14} />
                </button>
              )}
            </div>
            <textarea
              aria-label={`Belief ${index + 1}`}
              placeholder="Your belief, in your own words."
              required
              rows={4}
              value={belief.text}
              onChange={(event) =>
                updateBelief(index, { text: event.target.value })
              }
              className={field}
            />
          </div>
        ))}
        {beliefs.length < MAX_BELIEFS && (
          <button
            type="button"
            onClick={() => setBeliefs([...beliefs, { title: '', text: '' }])}
            className="flex w-fit items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-[#78aea2] hover:text-[#9cc9be]"
          >
            <Plus size={13} /> Add a belief tab
          </button>
        )}
      </Section>

      <Section
        title="Contact on your page (optional)"
        hint="Shown on your page only if you add it."
      >
        <ContactRows label="Contact" rows={contacts} onChange={setContacts} />
      </Section>

      <Section
        title="Backup contacts (admins only)"
        hint="ORG asks every member for at least two ways to reach them, in case one line is lost. Your account email is the first; add at least one more. Only admins can see these."
      >
        <ContactRows
          label="Backup contact"
          rows={backup}
          onChange={setBackup}
        />
      </Section>

      <Section title="Before you join">
        <ul className="grid list-disc gap-2 pl-5 text-sm leading-7 text-[#d8ceb0]">
          {terms.items.map((item) => (
            <li key={item.id}>{item.text}</li>
          ))}
        </ul>
        <label className="flex items-start gap-3 text-sm text-[#ece2c4]">
          <input
            type="checkbox"
            className="mt-1"
            checked={agreed}
            onChange={(event) => setAgreed(event.target.checked)}
          />
          I have read this and agree.
        </label>
      </Section>

      {submitError && (
        <p role="alert" className="text-sm text-[#f1a07a]">
          {submitError}
        </p>
      )}
      <button
        type="submit"
        disabled={!canSubmit}
        className="bg-[#78aea2] px-4 py-3 font-mono text-[10px] uppercase tracking-[0.2em] text-[#0b0d12] disabled:opacity-35"
      >
        {submitting ? 'Creating your page…' : 'Create my page'}
      </button>
      <p className="text-xs text-[#7f775f]">
        An admin reviews every new page before it opens to the community.
      </p>
    </form>
  )
}
