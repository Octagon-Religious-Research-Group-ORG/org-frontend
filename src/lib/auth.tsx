import { ClerkProvider, useAuth, useClerk, useUser } from '@clerk/react'
import { useRouter } from '@tanstack/react-router'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
} from 'react'
import type { ReactNode } from 'react'
import {
  DRAFT_SWEEP_INTERVAL_MS,
  clearJoinDraft,
  loadJoinDraft,
  sweepExpiredJoinDraft,
} from './membership-draft'

interface OrgAuth {
  configured: boolean
  isAuthenticated: boolean
  isLoading: boolean
  user?: {
    sub?: string
    name?: string
    email?: string
    picture?: string
    [claim: string]: unknown
  }
  login: (returnTo?: string, signup?: boolean) => Promise<void>
  logout: () => Promise<void>
  getToken: () => Promise<string | undefined>
}

const missingAuth: OrgAuth = {
  configured: false,
  isAuthenticated: false,
  isLoading: false,
  login: async () => {},
  logout: async () => {},
  getToken: async () => undefined,
}

const OrgAuthContext = createContext<OrgAuth>(missingAuth)
const serverAuth: OrgAuth = {
  ...missingAuth,
  configured: true,
  isLoading: true,
}

function ClerkBridge({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn, getToken: getClerkToken } = useAuth()
  const { user: clerkUser } = useUser()
  const clerk = useClerk()

  // Auth0 redirected away to a hosted page; Clerk opens in-page. `returnTo` is
  // preserved via forceRedirectUrl, which overrides Clerk's own redirect_url.
  const login = useCallback(
    async (returnTo = window.location.pathname, signup = false) => {
      const options = { forceRedirectUrl: returnTo }
      if (signup) {
        clerk.openSignUp(options)
      } else {
        clerk.openSignIn(options)
      }
    },
    [clerk],
  )

  const logout = useCallback(async () => {
    // Beliefs written in this tab must not outlive a deliberate sign-out.
    clearJoinDraft()
    await clerk.signOut({ redirectUrl: `${window.location.origin}/logout` })
  }, [clerk])

  // Clerk returns null when signed out; the OrgAuth contract is undefined.
  const getToken = useCallback(async () => {
    if (!isSignedIn) return undefined
    return (await getClerkToken()) ?? undefined
  }, [isSignedIn, getClerkToken])

  // Mapped to the Auth0-shaped claims the rest of the app already reads.
  // `sub` becomes the Clerk user id and is what MemberProfile keys on.
  const user = useMemo(() => {
    if (!clerkUser) return undefined
    return {
      sub: clerkUser.id,
      name: clerkUser.fullName ?? undefined,
      email: clerkUser.primaryEmailAddress?.emailAddress,
      picture: clerkUser.imageUrl,
    }
  }, [clerkUser])

  // Reading as the account now signed in drops a draft that belongs to another.
  const clerkUserId = clerkUser?.id
  useEffect(() => {
    if (clerkUserId) loadJoinDraft(clerkUserId)
  }, [clerkUserId])

  const value = useMemo<OrgAuth>(
    () => ({
      configured: true,
      isAuthenticated: Boolean(isSignedIn),
      isLoading: !isLoaded,
      user,
      login,
      logout,
      getToken,
    }),
    [isSignedIn, isLoaded, user, login, logout, getToken],
  )

  return (
    <OrgAuthContext.Provider value={value}>{children}</OrgAuthContext.Provider>
  )
}

export function OrgAuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter()
  const publishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY
  const hydrated = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  )

  useEffect(() => {
    sweepExpiredJoinDraft()
    const timer = setInterval(sweepExpiredJoinDraft, DRAFT_SWEEP_INTERVAL_MS)
    return () => clearInterval(timer)
  }, [])

  if (!hydrated) {
    return (
      <OrgAuthContext.Provider value={serverAuth}>
        {children}
      </OrgAuthContext.Provider>
    )
  }

  if (!publishableKey) {
    return (
      <OrgAuthContext.Provider value={missingAuth}>
        {children}
      </OrgAuthContext.Provider>
    )
  }

  return (
    <ClerkProvider
      publishableKey={publishableKey}
      afterSignOutUrl="/logout"
      signInFallbackRedirectUrl="/profile"
      signUpFallbackRedirectUrl="/profile"
      routerPush={(to) => router.history.push(to)}
      routerReplace={(to) => router.history.replace(to)}
    >
      <ClerkBridge>{children}</ClerkBridge>
    </ClerkProvider>
  )
}

export function useOrgAuth() {
  return useContext(OrgAuthContext)
}
