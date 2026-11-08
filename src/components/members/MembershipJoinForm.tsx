import { useEffect, useRef, useState } from 'react'
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
} from '#/lib/membership-api'
import {
  clearJoinDraft,
  loadJoinDraft,
  saveJoinDraft,
} from '#/lib/membership-draft'
import { ContactRows, field } from './ContactRows'
import { SLOW_SERVER_MESSAGE, useSlowNotice } from './use-slow-notice'

const MAX_BELIEFS = 20
/** Match the server's limits: per text box, and bio plus beliefs together. */
const MAX_TEXT = 20_000
const MAX_TOTAL_TEXT = 200_000
const formatCount = (value: number) => value.toLocaleString('en-US')
const SLUG_FORMAT = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

type SlugStatus =
  'idle' | 'format' | 'checking' | 'available' | 'unavailable' | 'failed'

const SLUG_MESSAGES: Partial<Record<SlugStatus, string>> = {
  format: 'Use lowercase letters, numbers and single hyphens (2 to 80).',
  checking: 'Checking…',
  available: 'Available.',
  unavailable: 'That address is not available. Please choose another.',
}

/** The terms and this member's status, read together. */
async function loadJoinState(getToken: () => Promise<string | undefined>) {
  const token = await getToken()
  return Promise.all([
    fetchMembershipTerms(),
    token ? fetchMyMembership(token) : undefined,
  ])
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

/** A live count, and a plain warning instead of quietly cutting long text. */
function TextCounter({ length }: { length: number }) {
  const over = length > MAX_TEXT
  return (
    <span className={`text-xs ${over ? 'text-[#f1a07a]' : 'text-[#9f9676]'}`}>
      {formatCount(length)} / {formatCount(MAX_TEXT)} characters
      {over && (
        <span role="alert">
          {' '}
          This is over the limit. Nothing has been cut; please shorten it.
        </span>
      )}
    </span>
  )
}

/**
 * The new-member form (plan Chunk 6). Keyed by account: a different account
 * gets a new form, never the fields and draft of the previous one.
 */
export function MembershipJoinForm({ nickname }: { nickname: boolean }) {
  const account = useOrgAuth().user?.sub
  return <JoinForm key={account ?? 'no-account'} nickname={nickname} />
}

/**
 * How the member is known, their page address, who can see it, bio, beliefs
 * (one per tab), contacts, and the membership terms, which the server
 * versions and records.
 */
function JoinForm({ nickname }: { nickname: boolean }) {
  const auth = useOrgAuth()
  // Fixed for the life of this form, so its draft can only ever be this account's.
  const [draftOwner] = useState(auth.user?.sub)
  const authRef = useRef(auth)
  authRef.current = auth
  const [terms, setTerms] = useState<MembershipTerms>()
  const [summary, setSummary] = useState<MembershipSummary>()
  const [loadError, setLoadError] = useState<string>()
  const [loadAttempt, setLoadAttempt] = useState(0)
  const [termsChanged, setTermsChanged] = useState(false)
  const seenTermsVersion = useRef<string>(undefined)

  // Restored once, on first render: what was typed before a session lapse.
  const [draft] = useState(() => loadJoinDraft(draftOwner))
  // A draft can only keep someone anonymous, never undo "Join anonymously".
  const [anonymous, setAnonymous] = useState(
    nickname || (draft?.anonymous ?? false),
  )
  const [displayName, setDisplayName] = useState(draft?.displayName ?? '')
  const [slug, setSlug] = useState(draft?.slug ?? '')
  const [slugEdited, setSlugEdited] = useState(draft?.slugEdited ?? false)
  const [slugStatus, setSlugStatus] = useState<SlugStatus>('idle')
  const [slugFailure, setSlugFailure] = useState<string>()
  const [slugAttempt, setSlugAttempt] = useState(0)
  const [visibility, setVisibility] = useState<ProfileVisibility>(
    draft?.visibility ?? (nickname ? 'members' : 'public'),
  )
  const [bio, setBio] = useState(draft?.bio ?? '')
  const [beliefs, setBeliefs] = useState(
    draft?.beliefs ?? [{ title: '', text: '' }],
  )
  const [contacts, setContacts] = useState<ContactEntry[]>(
    draft?.contacts ?? [],
  )
  // Admin-only: deliberately not part of the draft (see membership-draft.ts).
  const [backup, setBackup] = useState<ContactEntry[]>([
    { method: 'telegram', value: '' },
  ])
  const [agreed, setAgreed] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string>()

  const slow = useSlowNotice(
    submitting || slugStatus === 'checking' || (!terms && !loadError),
  )

  useEffect(() => {
    const closed = new AbortController()
    void (async () => {
      try {
        const [loadedTerms, loadedSummary] = await loadJoinState(() =>
          auth.getToken(),
        )
        if (closed.signal.aborted) return
        setTerms(loadedTerms)
        setSummary(loadedSummary)
        setLoadError(undefined)
      } catch (err) {
        if (!closed.signal.aborted) {
          setLoadError(
            err instanceof Error ? err.message : 'Membership is unavailable.',
          )
        }
      }
    })()
    return () => closed.abort()
  }, [auth, loadAttempt])

  // New terms mean the earlier agreement no longer stands.
  useEffect(() => {
    if (!terms) return
    if (
      seenTermsVersion.current &&
      seenTermsVersion.current !== terms.version
    ) {
      setAgreed(false)
      setTermsChanged(true)
    }
    seenTermsVersion.current = terms.version
  }, [terms])

  useEffect(() => {
    if (!slugEdited) setSlug(suggestSlug(displayName))
  }, [displayName, slugEdited])

  useEffect(() => {
    setSlugFailure(undefined)
    if (slug.length < 2) {
      setSlugStatus('idle')
      return
    }
    if (!SLUG_FORMAT.test(slug)) {
      setSlugStatus('format')
      return
    }
    setSlugStatus('idle')
    // Set when the address changes: a slower answer about an earlier address
    // must not speak for this one.
    let stale = false
    const timer = setTimeout(() => {
      setSlugStatus('checking')
      void (async () => {
        try {
          const token = await authRef.current.getToken()
          if (!token) throw new Error('Please sign in again.')
          const { available } = await checkSlug(slug, token)
          if (!stale) setSlugStatus(available ? 'available' : 'unavailable')
        } catch (err) {
          if (stale) return
          setSlugFailure(
            err instanceof Error
              ? err.message
              : 'We could not check that address.',
          )
          setSlugStatus('failed')
        }
      })()
    }, 400)
    return () => {
      stale = true
      clearTimeout(timer)
    }
  }, [slug, slugAttempt])

  // Typed text, kept in this tab so a session lapse can't lose it.
  useEffect(() => {
    const typed =
      displayName ||
      bio ||
      beliefs.some((belief) => belief.title || belief.text) ||
      contacts.some((row) => row.value)
    if (!typed) return
    saveJoinDraft(draftOwner, {
      displayName,
      slug,
      slugEdited,
      anonymous,
      visibility,
      bio,
      beliefs,
      contacts,
    })
  }, [
    draftOwner,
    displayName,
    slug,
    slugEdited,
    anonymous,
    visibility,
    bio,
    beliefs,
    contacts,
  ])

  useEffect(() => {
    if (summary && summary.status !== 'none') clearJoinDraft()
  }, [summary])

  // Only a first load with nothing to show blocks the page; a later refetch
  // that fails must never take the form (and what was typed) away.
  if (loadError && !terms) {
    return (
      <div>
        <p role="alert" className="text-sm text-[#f1a07a]">
          {loadError}
        </p>
        <button
          type="button"
          onClick={() => {
            setLoadError(undefined)
            setLoadAttempt((count) => count + 1)
          }}
          className="mt-4 bg-[#78aea2] px-4 py-3 font-mono text-[10px] uppercase tracking-[0.2em] text-[#0b0d12]"
        >
          Try again
        </button>
      </div>
    )
  }
  if (!terms) {
    return (
      <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#9f9676]">
        Loading…
        {slow && <p role="status">{SLOW_SERVER_MESSAGE}</p>}
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
  const totalText =
    bio.length + beliefs.reduce((sum, belief) => sum + belief.text.length, 0)
  const tooLong =
    bio.length > MAX_TEXT ||
    beliefs.some((belief) => belief.text.length > MAX_TEXT) ||
    totalText > MAX_TOTAL_TEXT
  const canSubmit =
    !tooLong &&
    agreed &&
    !submitting &&
    displayName.trim() &&
    bio.trim() &&
    beliefs.every((b) => b.title.trim() && b.text.trim()) &&
    filledBackup.length > 0 &&
    slugStatus === 'available'

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
      await refreshAfterRefusal()
    } finally {
      setSubmitting(false)
    }
  }

  // A refusal can mean the terms changed while reading (409), or that a join
  // which timed out actually landed. Either way the fresh state fixes it.
  const refreshAfterRefusal = async () => {
    try {
      const [loadedTerms, loadedSummary] = await loadJoinState(() =>
        auth.getToken(),
      )
      setTerms(loadedTerms)
      setSummary(loadedSummary)
    } catch {
      // The refusal is already on screen and the form is still there.
    }
  }

  return (
    <form onSubmit={(event) => void submit(event)} className="grid gap-8">
      <header>
        {draft && (
          <p role="status" className="mb-3 text-xs leading-6 text-[#9f9676]">
            We kept what you had typed in this browser tab. For your privacy,
            backup contacts are not kept, so please add them again.
          </p>
        )}
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
          {SLUG_MESSAGES[slugStatus] && (
            <span
              className={
                slugStatus === 'available' || slugStatus === 'checking'
                  ? 'text-[#9dcf83]'
                  : 'text-[#f1a07a]'
              }
            >
              {SLUG_MESSAGES[slugStatus]}
            </span>
          )}
          {slugStatus === 'failed' && (
            <span role="alert" className="text-[#f1a07a]">
              {slugFailure}{' '}
              <button
                type="button"
                onClick={() => setSlugAttempt((count) => count + 1)}
                className="underline underline-offset-4"
              >
                Check again
              </button>
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
        <TextCounter length={bio.length} />
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
            <TextCounter length={belief.text.length} />
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
        <p
          className={`text-xs ${totalText > MAX_TOTAL_TEXT ? 'text-[#f1a07a]' : 'text-[#9f9676]'}`}
        >
          Bio and beliefs together: {formatCount(totalText)} /{' '}
          {formatCount(MAX_TOTAL_TEXT)} characters.
          {totalText > MAX_TOTAL_TEXT && (
            <span role="alert">
              {' '}
              Please shorten them. You can add more on your page later.
            </span>
          )}
        </p>
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
        {termsChanged && (
          <p role="status" className="text-xs leading-6 text-[#f1a07a]">
            The terms changed while you were writing. Please read them again and
            tick the box.
          </p>
        )}
        <label className="flex items-start gap-3 text-sm text-[#ece2c4]">
          <input
            type="checkbox"
            className="mt-1"
            checked={agreed}
            onChange={(event) => {
              setAgreed(event.target.checked)
              setTermsChanged(false)
            }}
          />
          I have read this and agree.
        </label>
      </Section>

      {submitError && (
        <p role="alert" className="text-sm text-[#f1a07a]">
          {submitError}
        </p>
      )}
      {slow && (
        <p role="status" className="text-xs leading-6 text-[#9f9676]">
          {SLOW_SERVER_MESSAGE}
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
