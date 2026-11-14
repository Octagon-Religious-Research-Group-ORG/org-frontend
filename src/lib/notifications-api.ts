import { memberRequest } from './membership-api'

/** Categories every member can turn on or off (Chunk 14). */
export const MEMBER_CATEGORIES = [
  {
    key: 'comments',
    label: 'Comments on my page',
    hint: 'Someone comments on your page or one of your beliefs.',
  },
  {
    key: 'replies',
    label: 'Replies to my comments',
    hint: 'Someone answers a comment you wrote.',
  },
  {
    key: 'suggestions',
    label: 'Suggested rewordings',
    hint: 'Someone suggests a rewording of your belief, or you get an answer on one you suggested.',
  },
  {
    key: 'votes',
    label: 'Agreed beliefs',
    hint: 'One of your beliefs reaches the list agreed by 2 or more members.',
  },
  {
    key: 'claims',
    label: 'My claim requests',
    hint: 'An admin decides on your request to claim an imported page.',
  },
  {
    key: 'moderation',
    label: 'Moderation of my comments',
    hint: 'A moderator hides, removes or restores one of your comments.',
  },
] as const

/** Categories only admins get. */
export const ADMIN_CATEGORIES = [
  {
    key: 'adminPages',
    label: 'New member pages',
    hint: 'A new page is waiting for approval.',
  },
  {
    key: 'adminEam',
    label: 'EaM requests',
    hint: 'A member asks to start the EaM path.',
  },
  {
    key: 'adminReports',
    label: 'Reports',
    hint: 'Someone reports a comment or a member page.',
  },
  {
    key: 'adminClaims',
    label: 'Claim requests',
    hint: 'A member asks to claim an imported page.',
  },
] as const

export interface NotificationSettings {
  categories: Record<string, boolean>
  /** The daily summary email. */
  digest: boolean
  /** Immediate emails for claims and moderation. */
  immediate: boolean
  /** Only for admins. */
  admin?: {
    categories: Record<string, boolean>
    adminImmediate: boolean
  }
}

export interface NotificationSettingsChange {
  categories?: Record<string, boolean>
  digest?: boolean
  immediate?: boolean
  adminImmediate?: boolean
}

/** Email delivery today, for the admin dashboard. */
export interface NotificationStatus {
  enabled: boolean
  digestHourUtc: number
  budget: {
    day: string
    sent: number
    dailyLimit: number
    immediateReserve: number
    limitHitAt?: string
  }
  waiting: { digest: number; immediate: number; adminNotices: number }
  failedLast7Days: number
  /** Daily summaries that ran out of attempts (absent from older servers). */
  digestFailedLast7Days?: number
}

const SCOPE_WORDS: Record<string, string> = {
  digest: 'the daily summary email',
  immediate: 'immediate emails about your claims and moderation',
  adminImmediate: 'immediate admin emails about claims and reports',
  comments: 'emails about comments on your page',
  replies: 'emails about replies to your comments',
  suggestions: 'emails about suggested rewordings',
  votes: 'emails about your agreed beliefs',
  claims: 'emails about your claim requests',
  moderation: 'emails about moderation of your comments',
  adminPages: 'admin emails about new member pages',
  adminEam: 'admin emails about EaM requests',
  adminReports: 'admin emails about reports',
  adminClaims: 'admin emails about claim requests',
}

/**
 * What an unsubscribe link turns off, in words, read from the link itself
 * (the third part of its token). Only the server can say whether the link is
 * genuine; this is just what to show on the button.
 */
export function unsubscribeScopeWords(token: string): string | undefined {
  const scope = token.split('.')[2]
  return scope && Object.hasOwn(SCOPE_WORDS, scope)
    ? SCOPE_WORDS[scope]
    : undefined
}

export function fetchNotificationSettings(token: string) {
  return memberRequest<NotificationSettings>('/me/notification-settings', {
    token,
  })
}

export function saveNotificationSettings(
  token: string,
  change: NotificationSettingsChange,
) {
  return memberRequest<NotificationSettings>('/me/notification-settings', {
    token,
    method: 'PUT',
    body: JSON.stringify(change),
  })
}

/** Needs no sign-in: the link's token says who and what. */
export function unsubscribe(linkToken: string) {
  return memberRequest<{ unsubscribed: boolean; scope: string }>(
    '/notifications/unsubscribe',
    { method: 'POST', body: JSON.stringify({ token: linkToken }) },
  )
}

export function fetchNotificationStatus(token: string) {
  return memberRequest<NotificationStatus>('/admin/notifications', { token })
}
