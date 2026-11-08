import { createMiddleware, createStart } from '@tanstack/react-start'

/**
 * Stops other sites framing this one (clickjacking). It lives here as well as
 * in netlify.toml because Netlify applies that file's headers only to static
 * files, not to server-rendered pages.
 *
 * Only `frame-ancestors` on purpose: a full policy would have to allow the
 * inline server-rendering scripts and Clerk, and a wrong one breaks sign-in.
 */
export const FRAME_PROTECTION_HEADERS = {
  'X-Frame-Options': 'DENY',
  'Content-Security-Policy': "frame-ancestors 'none'",
} as const

const frameProtection = createMiddleware().server(async ({ next }) => {
  const result = await next()
  for (const [name, value] of Object.entries(FRAME_PROTECTION_HEADERS)) {
    result.response.headers.set(name, value)
  }
  return result
})

export const startInstance = createStart(() => ({
  requestMiddleware: [frameProtection],
}))
