// @vitest-environment jsdom

import { renderToString } from 'react-dom/server'
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { OrgAuthProvider, useOrgAuth } from './auth'

const PUBLISHABLE_KEY = 'pk_test_stub'

const mocks = vi.hoisted(() => ({
  openSignIn: vi.fn(),
  openSignUp: vi.fn(),
  signOut: vi.fn(),
  getToken: vi.fn(),
  clerkState: {
    isLoaded: true,
    isSignedIn: false,
    user: undefined as
      | {
          id: string
          fullName: string | null
          imageUrl: string
          primaryEmailAddress?: { emailAddress: string }
        }
      | undefined,
  },
  historyPush: vi.fn(),
  historyReplace: vi.fn(),
  providerProps: undefined as
    | {
        publishableKey?: string
        afterSignOutUrl?: string
        signInFallbackRedirectUrl?: string
        signUpFallbackRedirectUrl?: string
        routerPush?: (to: string) => unknown
        routerReplace?: (to: string) => unknown
      }
    | undefined,
}))

vi.mock('@tanstack/react-router', () => ({
  useRouter: () => ({
    history: {
      push: mocks.historyPush,
      replace: mocks.historyReplace,
    },
  }),
}))

vi.mock('@clerk/react', () => ({
  ClerkProvider: (
    props: React.PropsWithChildren<{
      publishableKey?: string
      afterSignOutUrl?: string
      signInFallbackRedirectUrl?: string
      signUpFallbackRedirectUrl?: string
      routerPush?: (to: string) => unknown
      routerReplace?: (to: string) => unknown
    }>,
  ) => {
    mocks.providerProps = props
    return props.children
  },
  useAuth: () => ({
    isLoaded: mocks.clerkState.isLoaded,
    isSignedIn: mocks.clerkState.isSignedIn,
    getToken: mocks.getToken,
  }),
  useUser: () => ({ user: mocks.clerkState.user }),
  useClerk: () => ({
    openSignIn: mocks.openSignIn,
    openSignUp: mocks.openSignUp,
    signOut: mocks.signOut,
  }),
}))

function AuthProbe() {
  const auth = useOrgAuth()
  return (
    <>
      <output data-testid="auth-state">
        {JSON.stringify({
          configured: auth.configured,
          isAuthenticated: auth.isAuthenticated,
          isLoading: auth.isLoading,
          user: auth.user,
        })}
      </output>
      <button onClick={() => void auth.login()}>Sign in</button>
      <button onClick={() => void auth.login('/profile', true)}>Sign up</button>
      <button onClick={() => void auth.logout()}>Sign out</button>
      <button
        onClick={() =>
          void auth.getToken().then((token) => {
            document.body.dataset.token = token || 'none'
          })
        }
      >
        Get token
      </button>
    </>
  )
}

describe('OrgAuthProvider', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_CLERK_PUBLISHABLE_KEY', PUBLISHABLE_KEY)
    mocks.openSignIn.mockReset()
    mocks.openSignUp.mockReset()
    mocks.signOut.mockReset()
    mocks.getToken.mockReset()
    mocks.clerkState.isLoaded = true
    mocks.clerkState.isSignedIn = false
    mocks.clerkState.user = undefined
    mocks.historyPush.mockReset()
    mocks.historyReplace.mockReset()
    mocks.providerProps = undefined
    delete document.body.dataset.token
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllEnvs()
  })

  it('configures Clerk with the publishable key and post-auth destinations', () => {
    render(
      <OrgAuthProvider>
        <div>child</div>
      </OrgAuthProvider>,
    )

    expect(mocks.providerProps?.publishableKey).toBe(PUBLISHABLE_KEY)
    expect(mocks.providerProps?.afterSignOutUrl).toBe('/logout')
    expect(mocks.providerProps?.signInFallbackRedirectUrl).toBe('/profile')
    expect(mocks.providerProps?.signUpFallbackRedirectUrl).toBe('/profile')
  })

  it('routes Clerk navigation through client-side router history', () => {
    render(
      <OrgAuthProvider>
        <div>child</div>
      </OrgAuthProvider>,
    )

    act(() => {
      mocks.providerProps?.routerPush?.('/pushed')
      mocks.providerProps?.routerReplace?.('/replaced')
    })

    expect(mocks.historyPush).toHaveBeenCalledWith('/pushed')
    expect(mocks.historyReplace).toHaveBeenCalledWith('/replaced')
  })

  it('returns from sign-out through the dedicated logout route', () => {
    render(
      <OrgAuthProvider>
        <AuthProbe />
      </OrgAuthProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }))

    expect(mocks.signOut).toHaveBeenCalledWith({
      redirectUrl: `${window.location.origin}/logout`,
    })
  })

  it('exposes the loading server auth state during SSR', () => {
    const html = renderToString(
      <OrgAuthProvider>
        <AuthProbe />
      </OrgAuthProvider>,
    )

    expect(html).toContain('&quot;configured&quot;:true')
    expect(html).toContain('&quot;isLoading&quot;:true')
  })

  it('uses inert auth actions when the publishable key is missing', async () => {
    vi.stubEnv('VITE_CLERK_PUBLISHABLE_KEY', '')

    render(
      <OrgAuthProvider>
        <AuthProbe />
      </OrgAuthProvider>,
    )

    expect(screen.getByTestId('auth-state').textContent).toContain(
      '"configured":false',
    )
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }))
    fireEvent.click(screen.getByRole('button', { name: 'Get token' }))
    await waitFor(() => expect(document.body.dataset.token).toBe('none'))
    expect(mocks.openSignIn).not.toHaveBeenCalled()
    expect(mocks.openSignUp).not.toHaveBeenCalled()
    expect(mocks.signOut).not.toHaveBeenCalled()
  })

  it('opens sign-in by default and sign-up when requested, preserving returnTo', () => {
    render(
      <OrgAuthProvider>
        <AuthProbe />
      </OrgAuthProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))
    fireEvent.click(screen.getByRole('button', { name: 'Sign up' }))

    expect(mocks.openSignIn).toHaveBeenCalledWith({
      forceRedirectUrl: window.location.pathname,
    })
    expect(mocks.openSignUp).toHaveBeenCalledWith({
      forceRedirectUrl: '/profile',
    })
  })

  it('reports the loading state until Clerk has loaded', () => {
    mocks.clerkState.isLoaded = false

    render(
      <OrgAuthProvider>
        <AuthProbe />
      </OrgAuthProvider>,
    )

    expect(screen.getByTestId('auth-state').textContent).toContain(
      '"isLoading":true',
    )
  })

  it('maps a fully populated Clerk user onto the Auth0-shaped claims', () => {
    mocks.clerkState.isSignedIn = true
    mocks.clerkState.user = {
      id: 'user_123',
      fullName: 'Member Name',
      imageUrl: 'https://img.example/avatar.png',
      primaryEmailAddress: { emailAddress: 'member@example.org' },
    }

    render(
      <OrgAuthProvider>
        <AuthProbe />
      </OrgAuthProvider>,
    )

    const state = JSON.parse(
      screen.getByTestId('auth-state').textContent || '{}',
    )
    expect(state.isAuthenticated).toBe(true)
    expect(state.user).toEqual({
      sub: 'user_123',
      name: 'Member Name',
      email: 'member@example.org',
      picture: 'https://img.example/avatar.png',
    })
  })

  it('omits name and email when Clerk supplies neither', () => {
    mocks.clerkState.isSignedIn = true
    mocks.clerkState.user = {
      id: 'user_456',
      fullName: null,
      imageUrl: 'https://img.example/anon.png',
    }

    render(
      <OrgAuthProvider>
        <AuthProbe />
      </OrgAuthProvider>,
    )

    const state = JSON.parse(
      screen.getByTestId('auth-state').textContent || '{}',
    )
    expect(state.user.sub).toBe('user_456')
    expect(state.user.name).toBeUndefined()
    expect(state.user.email).toBeUndefined()
  })

  it.each([
    [false, undefined, 'none', 0],
    [true, null, 'none', 1],
    [true, 'session-token', 'session-token', 1],
  ])(
    'resolves the session token when signed in is %s',
    async (isSignedIn, token, expected, calls) => {
      mocks.clerkState.isSignedIn = isSignedIn
      mocks.clerkState.user = isSignedIn
        ? {
            id: 'user_123',
            fullName: 'Member',
            imageUrl: 'https://img.example/avatar.png',
          }
        : undefined
      mocks.getToken.mockResolvedValue(token)

      render(
        <OrgAuthProvider>
          <AuthProbe />
        </OrgAuthProvider>,
      )

      fireEvent.click(screen.getByRole('button', { name: 'Get token' }))
      await waitFor(() => expect(document.body.dataset.token).toBe(expected))
      expect(mocks.getToken).toHaveBeenCalledTimes(calls)
    },
  )
})
