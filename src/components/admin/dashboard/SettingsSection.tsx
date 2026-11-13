import { useState } from 'react'
import {
  fetchAdminSettings,
  isVotingInvite,
  setAnonymousVoting,
  setVotingInvite,
} from '#/lib/admin-api'
import type { AdminSettings } from '#/lib/admin-api'
import {
  buttonStyle,
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

export const INVITE_FORMAT =
  'Use the private Telegram invite link, starting with https://t.me/.'
export const INVITE_SHOWN_WHERE =
  'Members with an approved page see it in the Members Community, under ORG chats. Guests, members waiting for approval and the public never do.'
export const ANONYMOUS_VOTING_EXPLAINED =
  'Whether members who joined under a nickname can vote, and have their votes counted. The members decide this in a vote of their own; until then it stays off.'

/** Settings (Chunk 12): anonymous voting and the ORG Voting invite. */
export function SettingsSection() {
  const settings = useAdminLoad(fetchAdminSettings, 'settings')
  return (
    <section aria-labelledby="settings-heading">
      <h2 id="settings-heading" className={sectionHeading}>
        Settings
      </h2>
      <LoadState
        denied={settings.denied}
        error={settings.error}
        loading={!settings.data}
        onRetry={settings.reload}
      >
        {settings.data && (
          <SettingsForms settings={settings.data} onChanged={settings.reload} />
        )}
      </LoadState>
    </section>
  )
}

function SettingsForms({
  settings,
  onChanged,
}: {
  settings: AdminSettings
  onChanged: () => void
}) {
  const voting = useAdminAction()
  const invite = useAdminAction()
  const [inviteUrl, setInviteUrl] = useState(settings.votingInvite ?? '')
  const [saved, setSaved] = useState<string>()
  const typed = inviteUrl.trim()
  const invalid = typed !== '' && !isVotingInvite(typed)

  return (
    <>
      <div className={`${cardStyle} mt-6`}>
        <h3 className="text-lg text-[#f6efd9]">Anonymous members voting</h3>
        <p className={noteStyle}>{ANONYMOUS_VOTING_EXPLAINED}</p>
        <p className="mt-3 text-sm text-[#ece2c4]">
          Now:{' '}
          {settings.anonymousMayVote ? 'they can vote' : 'they cannot vote'}
        </p>
        {voting.error && (
          <p role="alert" className="mt-2 text-sm text-[#f1a07a]">
            {voting.error}
          </p>
        )}
        <button
          type="button"
          className={buttonStyle}
          disabled={voting.busy}
          onClick={() =>
            void voting.run(
              (token) => setAnonymousVoting(token, !settings.anonymousMayVote),
              onChanged,
              onChanged,
            )
          }
        >
          {settings.anonymousMayVote
            ? 'Stop anonymous members voting'
            : 'Let anonymous members vote'}
        </button>
      </div>

      <form
        className={`${cardStyle} mt-6`}
        onSubmit={(event) => {
          event.preventDefault()
          setSaved(undefined)
          void invite.run(
            (token) => setVotingInvite(token, typed),
            () => {
              setSaved(typed ? 'Invite saved.' : 'Invite cleared.')
              onChanged()
            },
            // Re-read only: a failed save never says "saved".
            onChanged,
          )
        }}
      >
        <h3 className="text-lg text-[#f6efd9]">ORG Voting invite</h3>
        <p className={noteStyle}>{INVITE_SHOWN_WHERE}</p>
        <label className="mt-3 block">
          <span className={labelStyle}>Invite link (empty to clear it)</span>
          <input
            type="url"
            inputMode="url"
            maxLength={300}
            value={inviteUrl}
            onChange={(event) => setInviteUrl(event.target.value)}
            aria-invalid={invalid}
            aria-describedby="invite-format"
            className={fieldStyle}
          />
        </label>
        <p
          id="invite-format"
          className={`mt-2 text-xs ${invalid ? 'text-[#f1a07a]' : 'text-[#9f9676]'}`}
        >
          {INVITE_FORMAT}
        </p>
        {invite.error && (
          <p role="alert" className="mt-2 text-sm text-[#f1a07a]">
            {invite.error}
          </p>
        )}
        {saved && (
          <p role="status" className="mt-2 text-sm text-[#9dcf83]">
            {saved}
          </p>
        )}
        <button
          type="submit"
          className={primaryStyle}
          disabled={invite.busy || invalid}
        >
          Save the invite
        </button>
      </form>
    </>
  )
}
