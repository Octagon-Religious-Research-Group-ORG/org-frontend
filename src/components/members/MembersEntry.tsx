import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import { DoorOpen, Drama, LogIn, UserPlus } from 'lucide-react'
import { useOrgAuth } from '#/lib/auth'
import {
  fetchMyMembership,
  isGuest,
  recordGuestEntry,
  setGuest,
} from '#/lib/membership-api'
import type { MembershipSummary } from '#/lib/membership-api'
import { SLOW_SERVER_MESSAGE, useSlowNotice } from './use-slow-notice'

export const JOIN_PATH = '/membership/join'
export const JOIN_NICKNAME_PATH = '/membership/join?nickname=1'

/**
 * Whether a guest needs their visit recorded before coming in (the owner's
 * D10: visitors' IP addresses are tracked). True means that when the record
 * can't be written the guest waits and retries rather than entering unseen.
 * Policy belongs to the owner; flip it here if he prefers guests never wait.
 */
export const GUEST_ENTRY_NEEDS_RECORD = true

const button =
  'flex items-center justify-center gap-2 px-4 py-3 font-mono text-[10px] uppercase tracking-[0.18em] transition disabled:opacity-35'

function Panel({ children }: { children: ReactNode }) {
  return (
    <section className="mt-12 border border-[rgba(236,226,196,0.16)] bg-[rgba(11,13,18,0.85)] p-6 sm:p-10">
      {children}
    </section>
  )
}

function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <div className="font-mono text-[10px] uppercase tracking-[0.28em] text-[#78aea2]">
      {children}
    </div>
  )
}

/**
 * The door to the Members Community (owner, D09/D10/Q01): log in, sign up,
 * join anonymously, or enter as a guest in one click. Members whose page is
 * approved, and guests, see the community content (`children`).
 */
export function MembersEntry({
  children,
  guestNeedsRecord = GUEST_ENTRY_NEEDS_RECORD,
}: {
  children: ReactNode
  guestNeedsRecord?: boolean
}) {
  const auth = useOrgAuth()
  const [guest, setGuestState] = useState(false)
  const [membership, setMembership] = useState<MembershipSummary>()
  const [error, setError] = useState<string>()
  const [guestError, setGuestError] = useState<string>()
  const [entering, setEntering] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const slow = useSlowNotice(
    entering || (auth.isAuthenticated && !membership && !error),
  )

  useEffect(() => setGuestState(isGuest()), [])

  useEffect(() => {
    if (!auth.isAuthenticated) return
    const closed = new AbortController()
    void (async () => {
      try {
        const token = await auth.getToken()
        if (!token) return
        const summary = await fetchMyMembership(token)
        if (!closed.signal.aborted) setMembership(summary)
      } catch (err) {
        if (!closed.signal.aborted) {
          setError(
            err instanceof Error ? err.message : 'Membership is unavailable.',
          )
        }
      }
    })()
    return () => closed.abort()
  }, [auth, attempt])

  const openGuestMode = () => {
    setGuest(true)
    setGuestState(true)
  }

  const enterAsGuest = async () => {
    setEntering(true)
    setGuestError(undefined)
    try {
      await recordGuestEntry()
      openGuestMode()
    } catch (err) {
      setGuestError(
        err instanceof Error ? err.message : 'Guest entry is unavailable.',
      )
      if (!guestNeedsRecord) openGuestMode()
    } finally {
      setEntering(false)
    }
  }

  const leaveGuest = () => {
    setGuest(false)
    setGuestState(false)
  }

  const slowNotice = slow && (
    <p role="status" className="mt-4 text-xs leading-6 text-[#9f9676]">
      {SLOW_SERVER_MESSAGE}
    </p>
  )

  const guestOption = (
    <div className="mt-6 max-w-xs">
      <button
        type="button"
        disabled={entering}
        onClick={() => void enterAsGuest()}
        className={`${button} w-full border border-[rgba(236,226,196,0.4)] text-[#ece2c4] hover:border-[#ece2c4]`}
      >
        <DoorOpen size={15} /> {entering ? 'Opening…' : 'Guest'}
      </button>
      {guestError && (
        <p role="alert" className="mt-3 text-sm text-[#f1a07a]">
          {guestError}
        </p>
      )}
    </div>
  )

  const guestView = (
    <>
      <div className="mt-10 flex flex-wrap items-center gap-3 border border-dashed border-[rgba(120,174,162,0.4)] px-4 py-3 text-xs text-[#b8ad8d]">
        <span>
          You're browsing as a guest. Guests can read, but not comment or vote.
        </span>
        {auth.isAuthenticated ? (
          membership?.status === 'none' && (
            <Link
              to={JOIN_PATH}
              className="underline underline-offset-4 hover:text-[#f6efd9]"
            >
              Create my page
            </Link>
          )
        ) : (
          <button
            type="button"
            onClick={() => void auth.login(JOIN_PATH, true)}
            className="underline underline-offset-4 hover:text-[#f6efd9]"
          >
            Become a member
          </button>
        )}
        <button
          type="button"
          onClick={leaveGuest}
          className="underline underline-offset-4 hover:text-[#f6efd9]"
        >
          Leave guest mode
        </button>
      </div>
      {children}
    </>
  )

  if (auth.isLoading) {
    return (
      <Panel>
        <Eyebrow>Checking membership…</Eyebrow>
      </Panel>
    )
  }

  if (auth.isAuthenticated) {
    // Approved members first: everyone else (no page, pending, or the server
    // not answering) may still look around as a guest.
    if (membership?.status === 'approved') return <>{children}</>
    if (guest) return guestView
    if (error) {
      return (
        <Panel>
          <Eyebrow>Members Community</Eyebrow>
          <p role="alert" className="mt-4 text-sm text-[#f1a07a]">
            {error}
          </p>
          <button
            type="button"
            onClick={() => {
              setError(undefined)
              setAttempt((count) => count + 1)
            }}
            className={`${button} mt-6 max-w-xs bg-[#78aea2] text-[#0b0d12]`}
          >
            Try again
          </button>
          {guestOption}
        </Panel>
      )
    }
    if (!membership) {
      return (
        <Panel>
          <Eyebrow>Checking membership…</Eyebrow>
          {slowNotice}
        </Panel>
      )
    }
    if (membership.status === 'none') {
      return (
        <Panel>
          <Eyebrow>One more step</Eyebrow>
          <h2 className="mt-3 text-3xl font-light uppercase tracking-[0.06em] text-[#f6efd9]">
            Finish joining
          </h2>
          <p className="mt-4 max-w-xl text-sm leading-7 text-[#b8ad8d]">
            Your account is ready. Add your bio and at least one belief to
            create your member page.
          </p>
          <Link
            to={JOIN_PATH}
            className={`${button} mt-6 max-w-xs bg-[#78aea2] text-[#0b0d12]`}
          >
            <UserPlus size={15} /> Create my page
          </Link>
          {guestOption}
          {slowNotice}
        </Panel>
      )
    }
    return (
      <Panel>
        <Eyebrow>Waiting for approval</Eyebrow>
        <p className="mt-4 max-w-xl text-sm leading-7 text-[#b8ad8d]">
          Thank you, {membership.profile?.displayName}. An admin reviews every
          new page before it opens to the community; you'll be able to come in
          as soon as it's approved. Until then you can look around as a guest.
        </p>
        {guestOption}
        {slowNotice}
      </Panel>
    )
  }

  if (guest) return guestView

  return (
    <Panel>
      <Eyebrow>Members Community</Eyebrow>
      <h2 className="mt-3 text-3xl font-light uppercase tracking-[0.06em] text-[#f6efd9]">
        How would you like to come in?
      </h2>
      <p className="mt-4 max-w-2xl text-sm leading-7 text-[#b8ad8d]">
        Members have a page with their bio and beliefs, and can comment and
        vote. Not sure which kind of membership fits you? Read{' '}
        <Link
          to="/membership"
          className="text-[#f1d78a] underline underline-offset-4"
        >
          Membership
        </Link>
        .
      </p>
      <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <button
          type="button"
          disabled={!auth.configured}
          onClick={() => void auth.login('/community')}
          className={`${button} border border-[#78aea2] text-[#78aea2] hover:bg-[#78aea2] hover:text-[#0b0d12]`}
        >
          <LogIn size={15} /> Log in
        </button>
        <button
          type="button"
          disabled={!auth.configured}
          onClick={() => void auth.login(JOIN_PATH, true)}
          className={`${button} bg-[#78aea2] text-[#0b0d12] hover:bg-[#9cc9be]`}
        >
          <UserPlus size={15} /> Sign up
        </button>
        <button
          type="button"
          disabled={!auth.configured}
          onClick={() => void auth.login(JOIN_NICKNAME_PATH, true)}
          className={`${button} border border-[#c99bdd] text-[#c99bdd] hover:bg-[#c99bdd] hover:text-[#0b0d12]`}
        >
          <Drama size={15} /> Join anonymously
        </button>
        <button
          type="button"
          disabled={entering}
          onClick={() => void enterAsGuest()}
          className={`${button} border border-[rgba(236,226,196,0.4)] text-[#ece2c4] hover:border-[#ece2c4]`}
        >
          <DoorOpen size={15} /> {entering ? 'Opening…' : 'Guest'}
        </button>
      </div>
      {guestError && (
        <p role="alert" className="mt-4 text-sm text-[#f1a07a]">
          {guestError}
        </p>
      )}
      {slowNotice}
      <p className="mt-6 max-w-2xl text-[11px] leading-6 text-[#7f775f]">
        Anonymous members join under a nickname and still need an email address
        and a bio with at least one belief. Guests can read but not comment or
        vote; ORG records the IP address of each guest visit.
      </p>
    </Panel>
  )
}
