/**
 * The ORG anchor log (Chunk 16b): its name and public key, shipped with the
 * website so a reader can check a receipt's checkpoint without trusting the
 * server that sent it.
 *
 * The key is made by the owner on his own machine
 * (`node scripts/anchor-log-keygen.mjs` in the backend) and pasted here in
 * a commit, so any change to it is visible in history. `null` until then:
 * the page then says the key is not published yet.
 */
export const ANCHOR_LOG_ORIGIN = 'orgspirituality.org/anchors/v1'

export const ANCHOR_LOG_VERIFIER_KEY: string | null = null
