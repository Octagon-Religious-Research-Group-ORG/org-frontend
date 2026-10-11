/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string
  readonly VITE_CLERK_PUBLISHABLE_KEY?: string
  /** `test` on the test site (shows the test-site banner); unset on the live site. */
  readonly VITE_SITE_ENV?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
