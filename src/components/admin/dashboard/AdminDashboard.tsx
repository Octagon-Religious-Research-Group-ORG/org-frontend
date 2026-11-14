import { useState } from 'react'
import { fetchAdminSettings } from '#/lib/admin-api'
import { AdminClaims } from '#/components/admin/claims/AdminClaims'
import { buttonStyle, primaryStyle } from '#/components/members/editor-styles'
import { LoadState, useAdminLoad } from './admin-shared'
import { AnchorsSection } from './AnchorsSection'
import { FragmentsSection } from './FragmentsSection'
import { InboxSection } from './InboxSection'
import { LogSection } from './LogSection'
import { MembersSection } from './MembersSection'
import { ModerationSection } from './ModerationSection'
import { RolesSection } from './RolesSection'
import { SettingsSection } from './SettingsSection'

export const SECTIONS = [
  { id: 'inbox', label: 'Inbox' },
  { id: 'members', label: 'Members' },
  { id: 'claims', label: 'Claims' },
  { id: 'roles', label: 'Roles' },
  { id: 'moderation', label: 'Moderation queue' },
  { id: 'log', label: 'Log' },
  { id: 'fragments', label: 'Search fragments' },
  { id: 'anchors', label: 'Anchors' },
  { id: 'settings', label: 'Settings' },
] as const

export type SectionId = (typeof SECTIONS)[number]['id']

/**
 * The admin dashboard (Chunk 12). The first thing it does is ask the server
 * whether this account is an admin; anyone else sees one line and no admin
 * data, and the server refuses every admin call regardless.
 */
export function AdminDashboard({
  initialSection = 'inbox',
}: {
  initialSection?: SectionId
}) {
  const [section, setSection] = useState<SectionId>(initialSection)
  // The Members section opened from a reported page (Chunk 13), searched.
  const [memberQuery, setMemberQuery] = useState('')
  // The cheapest admin read, as the gate: a 403 here hides every section.
  const gate = useAdminLoad(fetchAdminSettings, 'gate')

  return (
    <div className="text-[#ece2c4]">
      <h1 className="text-[clamp(28px,6vw,52px)] font-thin uppercase tracking-[0.06em] text-[#f6efd9]">
        Admin dashboard
      </h1>
      <LoadState
        denied={gate.denied}
        error={gate.error}
        loading={!gate.data}
        onRetry={gate.reload}
      >
        <nav
          role="tablist"
          aria-label="Sections"
          className="mt-6 flex flex-wrap gap-2"
        >
          {SECTIONS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={tab.id === section}
              className={tab.id === section ? primaryStyle : buttonStyle}
              onClick={() => {
                setMemberQuery('')
                setSection(tab.id)
              }}
            >
              {tab.label}
            </button>
          ))}
        </nav>
        <div role="tabpanel" className="mt-10">
          {section === 'inbox' && (
            <InboxSection
              onReviewPages={() => setSection('members')}
              onOpenModeration={() => setSection('moderation')}
            />
          )}
          {section === 'members' && (
            <MembersSection
              key={memberQuery}
              {...(memberQuery
                ? { initialFilter: 'all' as const, initialQuery: memberQuery }
                : {})}
            />
          )}
          {section === 'claims' && <AdminClaims embedded />}
          {section === 'roles' && <RolesSection />}
          {section === 'moderation' && (
            <ModerationSection
              onOpenMember={(slug) => {
                setMemberQuery(slug)
                setSection('members')
              }}
            />
          )}
          {section === 'log' && <LogSection />}
          {section === 'fragments' && <FragmentsSection />}
          {section === 'anchors' && <AnchorsSection />}
          {section === 'settings' && <SettingsSection />}
        </div>
      </LoadState>
    </div>
  )
}
