// Shared fake for the admin dashboard tests. Synthetic data only.
import type { ReactNode } from 'react'

/** The router's Link as a plain anchor, enough to read where it points. */
export function FakeLink({
  children,
  params,
  to,
}: {
  children: ReactNode
  params?: { slug: string }
  to: string
}) {
  return <a href={params ? `/${params.slug}` : to}>{children}</a>
}
