import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import {
  adminTime,
  fetchAdmins,
  fetchInvitations,
  inviteByEmail,
  MAX_ROLE_REASON_LENGTH,
  removeAdminRole,
  revokeInvitation,
} from '#/lib/admin-api'
import type { AdminPerson, PendingInvitation } from '#/lib/admin-api'
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
  sectionHeading,
  useAdminAction,
  useAdminLoad,
} from './admin-shared'

export const ROLES_EXPLAINED =
  'Admins can read every page and belief, decide on new pages, claims and removals, and change these settings. To make an existing member an admin, use "Make admin…" on their card under Members. There is no password tool: members reset their own password by email.'
export const LAST_ADMIN_NOTE =
  'The only admin cannot be removed. Make someone else an admin first.'
export const ALLOWLIST_NOTE =
  "Admin through the server's allowlist; remove it from the server configuration."
export const ADMIN_INVITE_NOTE =
  'Admin invitations expire after 3 days, and are withdrawn if the admin who sent them loses the role.'
export const INVITATIONS_INCOMPLETE =
  'There are more waiting invitations than this list shows; these are the newest.'
export const ALLOWLIST_UNKNOWN_NOTE =
  "The server's allowlist could not be checked, so admins who are admins only through it may be missing here."
export const ALSO_ALLOWLISTED_NOTE =
  "Also on the server's allowlist: remove it from the server configuration before this role can be removed."
export const INCOMPLETE_NOTE =
  'Not every account could be read, so this list may be missing someone, and no admin can be removed from here.'

/** Roles (Chunk 12): the admins, removing one, and invitations by email. */
export function RolesSection() {
  const admins = useAdminLoad(fetchAdmins, 'admins')
  const invitations = useAdminLoad(fetchInvitations, 'invitations')
  const list = admins.data?.admins ?? []
  // The last-admin rule counts Clerk roles only, like the server.
  const onlyOne = list.filter((person) => !person.viaAllowlist).length <= 1
  const [warning, setWarning] = useState<string>()
  const withdraw = useAdminAction()
  const [withdrawing, setWithdrawing] = useState<string>()

  return (
    <section aria-labelledby="roles-heading">
      <h2 id="roles-heading" className={sectionHeading}>
        Roles
      </h2>
      <p className={noteStyle}>{ROLES_EXPLAINED}</p>
      <h3 className="mt-6 text-lg text-[#f6efd9]">Admins</h3>
      <LoadState
        denied={admins.denied}
        error={admins.error}
        loading={!admins.data}
        onRetry={admins.reload}
      >
        {warning && (
          <p role="alert" className="mt-3 text-sm text-[#f1d78a]">
            {warning}
          </p>
        )}
        {admins.data?.allowlistUnknown && (
          <p className="mt-3 text-xs text-[#f1a07a]">
            {ALLOWLIST_UNKNOWN_NOTE}
          </p>
        )}
        {admins.data?.complete === false && (
          <p className="mt-3 text-xs text-[#f1a07a]">{INCOMPLETE_NOTE}</p>
        )}
        {onlyOne && (
          <p className="mt-3 text-xs text-[#9f9676]">{LAST_ADMIN_NOTE}</p>
        )}
        <ul className="mt-4 flex flex-col gap-3">
          {list.map((person) => (
            <li key={person.userId}>
              <AdminCard
                person={person}
                removable={
                  !person.isYou &&
                  !person.viaAllowlist &&
                  !person.allowlisted &&
                  !onlyOne &&
                  admins.data?.complete !== false
                }
                onChanged={(followUp) => {
                  setWarning(followUp)
                  admins.reload()
                }}
                onRefresh={admins.reload}
              />
            </li>
          ))}
        </ul>
      </LoadState>

      <h3 className="mt-10 text-lg text-[#f6efd9]">Invite someone</h3>
      <InviteForm onSent={invitations.reload} />

      <h3 className="mt-10 text-lg text-[#f6efd9]">Waiting invitations</h3>
      <LoadState
        denied={invitations.denied}
        error={invitations.error}
        loading={!invitations.data}
        onRetry={invitations.reload}
      >
        {invitations.data?.complete === false && (
          <p className="mt-3 text-xs text-[#f1a07a]">
            {INVITATIONS_INCOMPLETE}
          </p>
        )}
        {/* Here, not on the card: the re-read removes a withdrawn card. */}
        {withdraw.error && (
          <p role="alert" className="mt-3 text-sm text-[#f1a07a]">
            {withdrawing}: {withdraw.error}
          </p>
        )}
        {invitations.data?.invitations.length === 0 && (
          <p className="mt-3 text-sm text-[#9f9676]">None.</p>
        )}
        <ul className="mt-4 flex flex-col gap-3">
          {invitations.data?.invitations.map((invitation) => (
            <li key={invitation.invitationId}>
              <InvitationCard
                invitation={invitation}
                busy={withdraw.busy}
                onWithdraw={() => {
                  setWithdrawing(invitation.email)
                  void withdraw.run(
                    (token) => revokeInvitation(token, invitation.invitationId),
                    invitations.reload,
                    invitations.reload,
                  )
                }}
              />
            </li>
          ))}
        </ul>
      </LoadState>
    </section>
  )
}

function AdminCard({
  person,
  removable,
  onChanged,
  onRefresh,
}: {
  person: AdminPerson
  removable: boolean
  /** With the server's follow-up warning, when there is one. */
  onChanged: (followUpWarning?: string) => void
  /** Re-reads the admins after a 409 or 500, claiming nothing. */
  onRefresh: () => void
}) {
  const action = useAdminAction()
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const name =
    person.page?.displayName ?? person.name ?? person.email ?? person.userId
  let followUp: string | undefined

  return (
    <article aria-label={name} className={cardStyle}>
      <p className="text-[#f6efd9]">
        {person.page ? (
          <Link
            to="/$slug"
            params={{ slug: person.page.slug }}
            className="underline underline-offset-4"
          >
            {name}
          </Link>
        ) : (
          name
        )}
        {person.isYou && (
          <span className="ml-2 text-xs text-[#9dcf83]">(you)</span>
        )}
      </p>
      {person.viaAllowlist && (
        <p className="mt-1 text-xs text-[#f1d78a]">{ALLOWLIST_NOTE}</p>
      )}
      {person.allowlisted && (
        <p className="mt-1 text-xs text-[#f1d78a]">{ALSO_ALLOWLISTED_NOTE}</p>
      )}
      {person.email && (
        <p className="mt-1 text-xs text-[#9f9676] [overflow-wrap:anywhere]">
          {person.email}
        </p>
      )}
      {action.error && (
        <p role="alert" className="mt-2 text-sm text-[#f1a07a]">
          {action.error}
        </p>
      )}
      {removable && !open && (
        <button
          type="button"
          className={dangerStyle}
          onClick={() => setOpen(true)}
        >
          Remove admin role…
        </button>
      )}
      {removable && open && (
        <form
          className="mt-3"
          onSubmit={(event) => {
            event.preventDefault()
            void action.run(
              async (token) => {
                const result = await removeAdminRole(
                  token,
                  person.userId,
                  reason,
                )
                followUp = result.followUpWarning
              },
              () => onChanged(followUp),
              onRefresh,
            )
          }}
        >
          <label htmlFor={`demote-${person.userId}`} className={labelStyle}>
            Why (kept in the moderation log)
          </label>
          <textarea
            id={`demote-${person.userId}`}
            rows={2}
            required
            maxLength={MAX_ROLE_REASON_LENGTH}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            className={fieldStyle}
          />
          <div className="flex flex-wrap gap-3">
            <button
              type="submit"
              className={dangerStyle}
              disabled={action.busy || !reason.trim()}
            >
              Remove the admin role
            </button>
            <button
              type="button"
              className={buttonStyle}
              onClick={() => {
                setOpen(false)
                setReason('')
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </article>
  )
}

function InviteForm({ onSent }: { onSent: () => void }) {
  const action = useAdminAction()
  const [email, setEmail] = useState('')
  const [as, setAs] = useState<'member' | 'admin'>('member')
  const [reason, setReason] = useState('')
  const [sent, setSent] = useState<string>()

  return (
    <form
      className="mt-3 max-w-xl"
      onSubmit={(event) => {
        event.preventDefault()
        setSent(undefined)
        const address = email.trim()
        void action.run(
          (token) => inviteByEmail(token, address, as, reason),
          () => {
            setSent(address)
            setEmail('')
            setReason('')
            onSent()
          },
          // Not a success to announce, but the list may have changed.
          onSent,
        )
      }}
    >
      <label className="block">
        <span className={labelStyle}>Email address</span>
        <input
          type="email"
          required
          maxLength={254}
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className={fieldStyle}
        />
      </label>
      <fieldset className="mt-4">
        <legend className={labelStyle}>Invite as</legend>
        <div className="mt-2 flex gap-6 text-sm text-[#ece2c4]">
          {(['member', 'admin'] as const).map((value) => (
            <label key={value} className="flex items-center gap-2">
              <input
                type="radio"
                name="invite-as"
                value={value}
                checked={as === value}
                onChange={() => setAs(value)}
              />
              {value === 'member' ? 'A member' : 'An admin'}
            </label>
          ))}
        </div>
        {as === 'admin' && (
          <p className="mt-2 text-xs text-[#9f9676]">{ADMIN_INVITE_NOTE}</p>
        )}
      </fieldset>
      <label className="mt-4 block">
        <span className={labelStyle}>Note for the log (optional)</span>
        <input
          type="text"
          maxLength={MAX_ROLE_REASON_LENGTH}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          className={fieldStyle}
        />
      </label>
      {action.error && (
        <p role="alert" className="mt-2 text-sm text-[#f1a07a]">
          {action.error}
        </p>
      )}
      {sent && (
        <p role="status" className="mt-2 text-sm text-[#9dcf83]">
          Invitation sent to {sent}.
        </p>
      )}
      <button type="submit" className={primaryStyle} disabled={action.busy}>
        Send invitation
      </button>
    </form>
  )
}

function InvitationCard({
  invitation,
  busy,
  onWithdraw,
}: {
  invitation: PendingInvitation
  busy: boolean
  onWithdraw: () => void
}) {
  return (
    <article aria-label={invitation.email} className={cardStyle}>
      <p className="text-[#f6efd9] [overflow-wrap:anywhere]">
        {invitation.email}
      </p>
      <p className="mt-1 text-xs text-[#9f9676]">
        {invitation.role === 'admin' ? 'As an admin' : 'As a member'}
        {invitation.createdAt && ` · sent ${adminTime(invitation.createdAt)}`}
      </p>
      <button
        type="button"
        className={dangerStyle}
        disabled={busy}
        onClick={onWithdraw}
      >
        Withdraw
      </button>
    </article>
  )
}
