import { createFileRoute, useLocation } from '@tanstack/react-router'
import { UnsubscribePanel } from '#/components/members/UnsubscribePanel'
import { ShopShell } from '#/components/shop/ShopShell'

export const Route = createFileRoute('/unsubscribe')({
  head: () => ({
    meta: [
      { title: 'Turn off emails — ORG' },
      { name: 'robots', content: 'noindex' },
    ],
  }),
  component: UnsubscribePage,
})

/**
 * Public: the link from an email works without signing in. The token is read
 * from the address as it is, not declared as a route search parameter, so
 * the site's other links keep their own search types.
 */
function UnsubscribePage() {
  const search = useLocation({
    select: (location) => location.search as Record<string, unknown>,
  })
  const token =
    typeof search.token === 'string' && search.token.length <= 300
      ? search.token
      : undefined
  return (
    <ShopShell>
      <main className="relative z-[1] mx-auto max-w-[880px] px-[clamp(16px,4vw,40px)] pb-24 pt-[clamp(132px,16vh,176px)]">
        <UnsubscribePanel token={token} />
      </main>
    </ShopShell>
  )
}
