import { ChatsPanel } from './ChatsPanel'
import { EamRequestPanel } from './EamRequestPanel'
import { MembersDirectory } from './MembersDirectory'
import { ReferenceLinks } from './ReferenceLinks'

/** What a visitor finds inside the Members Community, beside the page's text. */
export function CommunityPanels() {
  return (
    <>
      <MembersDirectory />
      <ChatsPanel />
      <EamRequestPanel />
      <ReferenceLinks />
    </>
  )
}
