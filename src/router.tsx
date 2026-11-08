import {
  Link,
  createRouter as createTanStackRouter,
} from '@tanstack/react-router'
import { routeTree } from './routeTree.gen'

export function getRouter() {
  const router = createTanStackRouter({
    routeTree,
    scrollRestoration: true,
    defaultPreload: 'intent',
    defaultPreloadStaleTime: 0,
    defaultNotFoundComponent: NotFound,
  })

  return router
}

function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#0b0d12] px-6 text-[#ece2c4]">
      <div className="max-w-md text-center">
        <p className="mb-3 text-xs uppercase tracking-[0.4em] text-[#b8ad8d]">
          404
        </p>
        <h1 className="m-0 text-3xl font-thin uppercase tracking-[0.18em]">
          Page not found
        </h1>
        <p className="mx-auto mt-4 max-w-sm text-sm leading-6 text-[#b8ad8d]">
          The requested page does not exist in the ORG archive.
        </p>
        <Link
          to="/"
          className="mt-8 inline-flex border border-[#b8ad8d] px-5 py-3 text-xs uppercase tracking-[0.28em] text-[#ece2c4] no-underline transition-colors hover:border-[#ece2c4] hover:bg-[#ece2c4] hover:text-[#0b0d12]"
        >
          Return home
        </Link>
      </div>
    </main>
  )
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
