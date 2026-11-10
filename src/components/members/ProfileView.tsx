import { Link } from '@tanstack/react-router'
import type { MemberProfile } from '#/lib/members-api'
import { CONTACT_METHODS } from '#/lib/membership-api'
import { BeliefTabs } from './BeliefTabs'
import { BioSection } from './BioSection'
import { GetStartedChecklist } from './GetStartedChecklist'
import { OwnerTools } from './OwnerTools'
import { Paragraphs } from './Paragraphs'
import { ProfilePicture } from './ProfilePicture'
import { RemovedBeliefs } from './RemovedBeliefs'

function methodLabel(method: string) {
  return CONTACT_METHODS.find((entry) => entry.value === method)?.label
}

const EXTRA_TITLES: Partial<Record<string, string>> = {
  considering: 'Considering',
  texts: 'Texts',
}

const heading =
  'break-words text-[clamp(28px,7vw,64px)] font-thin uppercase leading-[1.02] tracking-[0.06em] text-[#f6efd9]'

/** A member's page. Everything in `profile` is what the server chose to send. */
export function ProfileView({
  profile,
  onChanged,
}: {
  profile: MemberProfile
  onChanged: () => void
}) {
  if (profile.access === 'name-only') {
    return (
      <>
        <h1 className={heading}>{profile.displayName}</h1>
        <p className="mt-6 max-w-xl text-sm leading-7 text-[#b8ad8d]">
          This page is for members only.{' '}
          <Link
            to="/community"
            className="text-[#f1d78a] underline underline-offset-4"
          >
            Open the Members Community
          </Link>{' '}
          to join or sign in.
        </p>
      </>
    )
  }

  return (
    <>
      <div className="grid gap-8 sm:grid-cols-[minmax(0,180px)_minmax(0,1fr)] sm:items-end">
        <div className="max-w-[180px]">
          <ProfilePicture
            slug={profile.slug}
            displayName={profile.displayName}
            hasPicture={profile.hasPicture}
            picturePublic={profile.picturePublic}
            version={profile.pictureVersion}
          />
        </div>
        <div className="min-w-0">
          <h1 className={heading}>{profile.displayName}</h1>
          {profile.manage?.reviewStatus === 'pending' && (
            <p className="mt-3 text-sm text-[#f1d78a]">
              Waiting for an admin to approve this page. Only you and the admins
              can see it for now.
            </p>
          )}
        </div>
      </div>

      {/* New members only: an imported member is not new here. */}
      {profile.isOwner && profile.manage?.source === 'native' && (
        <GetStartedChecklist />
      )}
      {profile.isOwner && profile.manage && (
        <OwnerTools
          visibility={profile.manage.visibility}
          onChanged={onChanged}
        />
      )}

      <BioSection
        slug={profile.slug}
        bio={profile.bio}
        owner={
          profile.isOwner && profile.revisions
            ? { baseSeq: profile.revisions.bio, onChanged }
            : undefined
        }
      />

      {profile.contacts.length > 0 && (
        <section aria-label="Contact" className="mt-8">
          <h2 className="font-mono text-[10px] uppercase tracking-[0.28em] text-[#9f9676]">
            Contact
          </h2>
          <ul className="mt-3 flex flex-col gap-2 text-sm text-[#d8ceb0]">
            {profile.contacts.map((contact) => (
              <li key={`${contact.method}-${contact.value}`}>
                <span className="mr-2 text-[#78aea2]">
                  {methodLabel(contact.method)}
                </span>
                <span className="[overflow-wrap:anywhere]">
                  {contact.value}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <BeliefTabs
        slug={profile.slug}
        tabs={profile.tabs}
        owner={
          profile.isOwner && profile.revisions
            ? { revisions: profile.revisions, onChanged }
            : undefined
        }
      />

      {profile.manage?.removedTabs && profile.manage.removedTabs.length > 0 && (
        <RemovedBeliefs slug={profile.slug} tabs={profile.manage.removedTabs} />
      )}

      {profile.extras.map((extra) => (
        <section key={extra.section} className="mt-12 max-w-3xl">
          {EXTRA_TITLES[extra.section] && (
            <h2 className="text-2xl font-light uppercase tracking-[0.06em] text-[#f6efd9]">
              {EXTRA_TITLES[extra.section]}
            </h2>
          )}
          <Paragraphs paragraphs={extra.paragraphs} />
        </section>
      ))}
    </>
  )
}
