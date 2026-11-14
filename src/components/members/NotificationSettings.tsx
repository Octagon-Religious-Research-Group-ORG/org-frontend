import { useEffect, useState } from 'react'
import { useOrgAuth } from '#/lib/auth'
import {
  ADMIN_CATEGORIES,
  fetchNotificationSettings,
  MEMBER_CATEGORIES,
  saveNotificationSettings,
} from '#/lib/notifications-api'
import type { NotificationSettings as Settings } from '#/lib/notifications-api'
import { primaryStyle } from './editor-styles'

export const EMAILS_EXPLAINED =
  'ORG emails you about activity that concerns you. To keep within its free email service, most news comes once a day in one summary; decisions on your claims and on your comments come at once. Emails never quote anyone: they say there is something new and link to it, and the site shows you only what you are allowed to see.'
export const ADMIN_EMAILS_EXPLAINED =
  'The admin inbox, by email. New claims and reports can come at once; new pages and EaM requests come in the daily summary.'
export const SAVED = 'Your email settings are saved.'
export const SESSION_EXPIRED = 'Your sign-in session has expired.'

const boxStyle =
  'mt-6 border border-[rgba(236,226,196,0.16)] bg-[rgba(11,13,18,0.85)] p-6 sm:p-8'

function Toggle({
  id,
  label,
  hint,
  checked,
  disabled,
  onChange,
}: {
  id: string
  label: string
  hint: string
  checked: boolean
  disabled: boolean
  onChange: (on: boolean) => void
}) {
  return (
    <div className="mt-4 flex items-start gap-3">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        aria-describedby={`${id}-hint`}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-1 h-4 w-4 accent-[#9dcf83]"
      />
      <div>
        <label htmlFor={id} className="text-sm text-[#f6efd9]">
          {label}
        </label>
        <p id={`${id}-hint`} className="text-xs leading-6 text-[#9f9676]">
          {hint}
        </p>
      </div>
    </div>
  )
}

/**
 * A member's own email settings (Chunk 14): each category on or off, the
 * daily summary, immediate emails, and an admins' section for admins.
 * Nothing changes until "Save".
 */
export function NotificationSettings() {
  const auth = useOrgAuth()
  const [settings, setSettings] = useState<Settings>()
  const [loadError, setLoadError] = useState<string>()
  const [attempt, setAttempt] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    const closed = new AbortController()
    setLoadError(undefined)
    void (async () => {
      try {
        const token = await auth.getToken()
        if (!token) throw new Error(SESSION_EXPIRED)
        const result = await fetchNotificationSettings(token)
        if (!closed.signal.aborted) setSettings(result)
      } catch (err) {
        if (closed.signal.aborted) return
        setLoadError(err instanceof Error ? err.message : 'That did not load.')
      }
    })()
    return () => closed.abort()
  }, [auth, attempt])

  if (loadError) {
    return (
      <div className={boxStyle}>
        <p role="alert" className="text-sm text-[#f1a07a]">
          {loadError}
        </p>
        <button
          type="button"
          className={primaryStyle}
          onClick={() => setAttempt((n) => n + 1)}
        >
          Try again
        </button>
      </div>
    )
  }
  if (!settings) {
    return (
      <p className="mt-6 font-mono text-[10px] uppercase tracking-[0.2em] text-[#9f9676]">
        Loading your email settings…
      </p>
    )
  }

  const change = (next: Settings) => {
    setSaved(false)
    setSettings(next)
  }
  const setCategory = (key: string, on: boolean) =>
    change({ ...settings, categories: { ...settings.categories, [key]: on } })
  const admin = settings.admin
  const setAdminCategory = (key: string, on: boolean) =>
    admin &&
    change({
      ...settings,
      admin: { ...admin, categories: { ...admin.categories, [key]: on } },
    })

  async function save(current: Settings) {
    setBusy(true)
    setError(undefined)
    setSaved(false)
    try {
      const token = await auth.getToken()
      if (!token) throw new Error(SESSION_EXPIRED)
      const result = await saveNotificationSettings(token, {
        categories: { ...current.categories, ...current.admin?.categories },
        digest: current.digest,
        immediate: current.immediate,
        ...(current.admin
          ? { adminImmediate: current.admin.adminImmediate }
          : {}),
      })
      setSettings(result)
      setSaved(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That did not work.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        void save(settings)
      }}
    >
      <p className="mt-4 max-w-2xl text-sm leading-7 text-[#b8ad8d]">
        {EMAILS_EXPLAINED}
      </p>

      <fieldset className={boxStyle}>
        <legend className="px-2 text-lg text-[#f6efd9]">How emails come</legend>
        <Toggle
          id="notify-digest"
          label="A daily summary"
          hint="One email a day with everything new. Off: no summary at all."
          checked={settings.digest}
          disabled={busy}
          onChange={(on) => change({ ...settings, digest: on })}
        />
        <Toggle
          id="notify-immediate"
          label="Claims and moderation at once"
          hint="Off: they wait for the daily summary instead (if it is on)."
          checked={settings.immediate}
          disabled={busy}
          onChange={(on) => change({ ...settings, immediate: on })}
        />
      </fieldset>

      <fieldset className={boxStyle}>
        <legend className="px-2 text-lg text-[#f6efd9]">What to email</legend>
        {MEMBER_CATEGORIES.map(({ key, label, hint }) => (
          <Toggle
            key={key}
            id={`notify-${key}`}
            label={label}
            hint={hint}
            checked={settings.categories[key] !== false}
            disabled={busy}
            onChange={(on) => setCategory(key, on)}
          />
        ))}
      </fieldset>

      {admin && (
        <fieldset className={boxStyle}>
          <legend className="px-2 text-lg text-[#f6efd9]">For admins</legend>
          <p className="mt-2 text-xs leading-6 text-[#9f9676]">
            {ADMIN_EMAILS_EXPLAINED}
          </p>
          <Toggle
            id="notify-admin-immediate"
            label="Claims and reports at once"
            hint="Off: they wait for the daily summary instead."
            checked={admin.adminImmediate}
            disabled={busy}
            onChange={(on) =>
              change({ ...settings, admin: { ...admin, adminImmediate: on } })
            }
          />
          {ADMIN_CATEGORIES.map(({ key, label, hint }) => (
            <Toggle
              key={key}
              id={`notify-${key}`}
              label={label}
              hint={hint}
              checked={admin.categories[key] !== false}
              disabled={busy}
              onChange={(on) => setAdminCategory(key, on)}
            />
          ))}
        </fieldset>
      )}

      {error && (
        <p role="alert" className="mt-4 text-sm text-[#f1a07a]">
          {error}
        </p>
      )}
      {saved && (
        <p role="status" className="mt-4 text-sm text-[#9dcf83]">
          {SAVED}
        </p>
      )}
      <button type="submit" className={primaryStyle} disabled={busy}>
        Save
      </button>
    </form>
  )
}
