import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { useOrgAuth } from '#/lib/auth'
import {
  adminTime,
  decideOnPage,
  fetchAdminMembers,
  fetchAdmins,
  MAX_REMOVAL_REASON_LENGTH,
  MAX_ROLE_REASON_LENGTH,
  promoteToAdmin,
} from '#/lib/admin-api'
import type { AdminMember, MemberFilter, PageDecision } from '#/lib/admin-api'
import {
  buttonStyle,
  dangerStyle,
  fieldStyle,
  labelStyle,
  primaryStyle,
} from '#/components/members/editor-styles'
import {
  cardStyle,
  LoadState,
  noteStyle,
  Pager,
  sectionHeading,
  useAdminAction,
  useAdminLoad,
} from './admin-shared'

export const FILTERS: Array<{ filter: MemberFilter; label: string }> = [
  { filter: 'pending', label: 'Waiting' },
  { filter: 'approved', label: 'On the site' },
  { filter: 'removed', label: 'Removed' },
  { filter: 'all', label: 'All' },
]

export const STATUS_LABELS: Record<AdminMember['reviewStatus'], string> = {
  pending: 'Waiting for approval',
  approved: 'On the site',
  removed: 'Removed',
}

export const REMOVAL_EXPLAINED =
  'Removing takes the page off the site for everyone but the admins. Nothing is deleted: ORG keeps it for at least five years, and an admin can restore it. The member can no longer edit, comment or vote, and their comments elsewhere stay, signed "A member".'
export const OWN_PAGE_NOTE =
  'This is your own page: another admin decides about it.'

/** What each decision is called on its button and asks for. */
const DECISIONS: Record<
  Exclude<PageDecision, 'approve'>,
  { label: string; submit: string; prompt: string }
> = {
  reject: {
    label: 'Reject…',
    submit: 'Reject the page',
    prompt: 'Why (for the admins only)',
  },
  remove: {
    label: 'Remove…',
    submit: 'Remove the page',
    prompt: 'Why (for the admins only)',
  },
  restore: {
    label: 'Restore…',
    submit: 'Restore the page',
    prompt: 'Why it comes back (for the admins only)',
  },
}

/**
 * Member pages (Chunk 12): find one, approve or reject a new page, remove or
 * restore a page, and make its owner an admin.
 */
export function MembersSection({
  initialFilter = 'pending',
}: {
  initialFilter?: MemberFilter
}) {
  const [filter, setFilter] = useState<MemberFilter>(initialFilter)
  const [typed, setTyped] = useState('')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const list = useAdminLoad(
    (token) => fetchAdminMembers(token, filter, query, page),
    `${filter}:${query}:${page}`,
  )
  const admins = useAdminLoad(fetchAdmins, 'admins')
  const adminIds = new Set(admins.data?.admins.map((a) => a.userId) ?? [])

  return (
    <section aria-labelledby="members-heading">
      <h2 id="members-heading" className={sectionHeading}>
        Members
      </h2>
      <p className={noteStyle}>{REMOVAL_EXPLAINED}</p>
      <div
        role="tablist"
        aria-label="Pages"
        className="mt-4 flex flex-wrap gap-2"
      >
        {FILTERS.map((tab) => (
          <button
            key={tab.filter}
            type="button"
            role="tab"
            aria-selected={tab.filter === filter}
            className={tab.filter === filter ? primaryStyle : buttonStyle}
            onClick={() => {
              setFilter(tab.filter)
              setPage(1)
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <form
        role="search"
        className="mt-4 flex max-w-xl flex-wrap items-end gap-3"
        onSubmit={(event) => {
          event.preventDefault()
          setQuery(typed)
          setPage(1)
        }}
      >
        <label className="min-w-0 flex-1">
          <span className={labelStyle}>Name or page address</span>
          <input
            type="search"
            maxLength={100}
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            className={fieldStyle}
          />
        </label>
        <button type="submit" className={buttonStyle}>
          Search
        </button>
      </form>
      <LoadState
        denied={list.denied}
        error={list.error}
        loading={!list.data}
        onRetry={list.reload}
      >
        {list.data?.members.length === 0 && (
          <p className="mt-6 text-sm text-[#9f9676]">No pages here.</p>
        )}
        <ul className="mt-6 flex flex-col gap-4">
          {list.data?.members.map((member) => (
            <li key={member.slug}>
              <MemberCard
                member={member}
                isAdmin={
                  member.ownerUserId !== undefined &&
                  adminIds.has(member.ownerUserId)
                }
                adminsKnown={admins.data !== undefined}
                onChanged={() => {
                  list.reload()
                  admins.reload()
                }}
              />
            </li>
          ))}
        </ul>
        <Pager
          page={page}
          hasMore={list.data?.hasMore ?? false}
          onPage={setPage}
        />
      </LoadState>
    </section>
  )
}

function MemberCard({
  member,
  isAdmin,
  adminsKnown,
  onChanged,
}: {
  member: AdminMember
  isAdmin: boolean
  adminsKnown: boolean
  onChanged: () => void
}) {
  const auth = useOrgAuth()
  const action = useAdminAction()
  const [open, setOpen] = useState<
    Exclude<PageDecision, 'approve'> | 'promote'
  >()
  const [reason, setReason] = useState('')
  const own =
    member.ownerUserId !== undefined && auth.user?.sub === member.ownerUserId
  const close = () => {
    setOpen(undefined)
    setReason('')
  }

  const offered: Array<Exclude<PageDecision, 'approve'>> =
    member.reviewStatus === 'pending'
      ? ['reject']
      : member.reviewStatus === 'approved'
        ? ['remove']
        : ['restore']
  const mayPromote =
    adminsKnown &&
    !isAdmin &&
    member.ownerUserId !== undefined &&
    member.reviewStatus === 'approved'

  return (
    <article aria-label={member.displayName} className={cardStyle}>
      <h3 className="text-lg text-[#f6efd9]">
        <Link
          to="/$slug"
          params={{ slug: member.slug }}
          className="underline underline-offset-4"
        >
          {member.displayName}
        </Link>
        {isAdmin && (
          <span className="ml-3 font-mono text-[10px] uppercase tracking-[0.18em] text-[#9dcf83]">
            Admin
          </span>
        )}
      </h3>
      <p className="mt-1 text-xs text-[#9f9676]">
        {STATUS_LABELS[member.reviewStatus]} · /{member.slug} ·{' '}
        {member.anonymous ? 'nickname' : 'own name'} · {member.visibility}
        {member.source === 'migrated' &&
          (member.ownerUserId
            ? ' · imported, claimed'
            : ' · imported, unclaimed')}
        {member.createdAt && ` · since ${adminTime(member.createdAt)}`}
      </p>
      {member.similarNameOf && (
        <p className="mt-2 text-xs text-[#f1d78a]">
          Name reads like: {member.similarNameOf.map((s) => `/${s}`).join(', ')}
        </p>
      )}
      {member.removal && (
        <p className="mt-2 text-xs text-[#f1a07a]">
          Removed {adminTime(member.removal.at)} · {member.removal.reason}
        </p>
      )}
      {action.error && (
        <p role="alert" className="mt-2 text-sm text-[#f1a07a]">
          {action.error}
        </p>
      )}
      {own && <p className="mt-3 text-xs text-[#f1d78a]">{OWN_PAGE_NOTE}</p>}
      {!own && !open && (
        <div className="flex flex-wrap gap-3">
          {member.reviewStatus === 'pending' && (
            <button
              type="button"
              className={primaryStyle}
              disabled={action.busy}
              onClick={() =>
                void action.run(
                  (token) => decideOnPage(token, member.slug, 'approve'),
                  onChanged,
                )
              }
            >
              Approve
            </button>
          )}
          {offered.map((decision) => (
            <button
              key={decision}
              type="button"
              className={decision === 'restore' ? buttonStyle : dangerStyle}
              disabled={action.busy}
              onClick={() => setOpen(decision)}
            >
              {DECISIONS[decision].label}
            </button>
          ))}
          {mayPromote && (
            <button
              type="button"
              className={buttonStyle}
              disabled={action.busy}
              onClick={() => setOpen('promote')}
            >
              Make admin…
            </button>
          )}
        </div>
      )}
      {open && (
        <form
          className="mt-3"
          onSubmit={(event) => {
            event.preventDefault()
            void action.run(
              (token) =>
                open === 'promote'
                  ? promoteToAdmin(token, String(member.ownerUserId), reason)
                  : decideOnPage(token, member.slug, open, reason),
              () => {
                close()
                onChanged()
              },
            )
          }}
        >
          <label htmlFor={`reason-${member.slug}`} className={labelStyle}>
            {open === 'promote'
              ? 'Why they become an admin'
              : DECISIONS[open].prompt}
          </label>
          <textarea
            id={`reason-${member.slug}`}
            rows={2}
            required
            maxLength={
              open === 'promote'
                ? MAX_ROLE_REASON_LENGTH
                : MAX_REMOVAL_REASON_LENGTH
            }
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            className={fieldStyle}
          />
          <div className="flex flex-wrap gap-3">
            <button
              type="submit"
              className={
                open === 'restore' || open === 'promote'
                  ? primaryStyle
                  : dangerStyle
              }
              disabled={action.busy || !reason.trim()}
            >
              {open === 'promote'
                ? 'Make them an admin'
                : DECISIONS[open].submit}
            </button>
            <button
              type="button"
              className={buttonStyle}
              disabled={action.busy}
              onClick={close}
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </article>
  )
}
