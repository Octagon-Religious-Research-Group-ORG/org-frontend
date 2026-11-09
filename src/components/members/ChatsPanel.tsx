import { useEffect, useState } from 'react'
import { useOrgAuth } from '#/lib/auth'
import { fetchMemberChats } from '#/lib/members-api'
import type { ChatsView } from '#/lib/members-api'

const PUBLIC_CHATS = [
  { label: 'ORG on Telegram', href: 'https://t.me/ORG_Spirituality' },
  {
    label: 'Events and Ceremonies',
    href: 'https://t.me/ORG_Events_and_Ceremonies',
  },
]

const CONTACT_TRIPP = 'https://t.me/Tripp_ORG'

const link =
  'text-[#f1d78a] underline underline-offset-4 [overflow-wrap:anywhere]'

/** Only ever a Telegram address, whatever the server hands back. */
function isTelegramInvite(url: string) {
  return /^https:\/\/t\.me\//.test(url)
}

/**
 * The ORG chats. Public chats and the contact link show for everyone; the
 * ORG Voting line comes from the server, which sends it only to members with
 * an approved page.
 */
export function ChatsPanel() {
  const auth = useOrgAuth()
  const [chats, setChats] = useState<ChatsView>()

  useEffect(() => {
    if (auth.isLoading) return
    const closed = new AbortController()
    void (async () => {
      try {
        const token = auth.isAuthenticated ? await auth.getToken() : undefined
        const result = await fetchMemberChats(token)
        if (!closed.signal.aborted) setChats(result)
      } catch {
        // The public links still work; only the voting line waits.
      }
    })()
    return () => closed.abort()
  }, [auth])

  return (
    <section
      aria-label="ORG chats"
      className="mt-12 border border-[rgba(236,226,196,0.16)] bg-[rgba(11,13,18,0.85)] p-6 sm:p-10"
    >
      <h2 className="text-2xl font-light uppercase tracking-[0.06em] text-[#f6efd9]">
        ORG chats
      </h2>
      <ul className="mt-5 flex flex-col gap-4 text-sm text-[#b8ad8d]">
        {PUBLIC_CHATS.map((chat) => (
          <li key={chat.href}>
            <a
              href={chat.href}
              target="_blank"
              rel="noopener noreferrer"
              className={link}
            >
              {chat.label}
            </a>
          </li>
        ))}
        <li>
          <a
            href={CONTACT_TRIPP}
            target="_blank"
            rel="noopener noreferrer"
            className={link}
          >
            Contact Tripp
          </a>
          <p className="mt-1 text-xs text-[#9f9676]">
            Tip: start a secret chat in Telegram for anything private.
          </p>
        </li>
        {chats?.voting === 'invite' && isTelegramInvite(chats.inviteUrl) && (
          <li>
            <a
              href={chats.inviteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={link}
            >
              ORG Voting
            </a>
            <p className="mt-1 text-xs text-[#9f9676]">
              For members only. Please keep this link private.
            </p>
          </li>
        )}
        {chats?.voting === 'ask-tripp' && (
          <li>Ask Tripp for the link to the ORG Voting group.</li>
        )}
      </ul>
    </section>
  )
}
