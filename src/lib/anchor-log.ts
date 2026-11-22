/**
 * The ORG anchor log (Chunk 16b): its name and public key, shipped with the
 * website so a reader can check a receipt's checkpoint without trusting the
 * server that sent it.
 *
 * The key is made by the owner on his own machine
 * (`node scripts/anchor-log-keygen.mjs` in the backend) and pasted here in
 * a commit, so any change to it is visible in history. `null` for a backend
 * with no pinned key: the page then says the key is not published yet.
 */
export const ANCHOR_LOG_ORIGIN = 'orgspirituality.org/anchors/v1'

/**
 * One pinned key per backend, chosen by the API address this build talks to.
 * TEST (org-backend-testing) has its own log and key, published in the public
 * repository org-anchor-checkpoints-testing; the live log gets its own key
 * and repository when the Members Area goes live (Chunk 20) and is added
 * here then. A build pointed at any other backend shows no key.
 */
export const ANCHOR_LOG_KEYS: Readonly<Record<string, string>> = {
  'org-backend-testing.onrender.com':
    'orgspirituality.org/anchors/v1+eea2e407+AZ+JAu4kO5U20kQD9FactFXJ3+TV0XqV9cS7c3qBPozm',
}

/** The pinned key for the backend at apiBaseUrl, or null when none is pinned. */
export function verifierKeyFor(apiBaseUrl: string | undefined): string | null {
  if (!apiBaseUrl) return null
  try {
    return ANCHOR_LOG_KEYS[new URL(apiBaseUrl).host] ?? null
  } catch {
    return null
  }
}

export const ANCHOR_LOG_VERIFIER_KEY: string | null = verifierKeyFor(
  import.meta.env.VITE_API_BASE_URL,
)
