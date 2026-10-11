import { HeadContent, Scripts, createRootRoute } from '@tanstack/react-router'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { TanStackDevtools } from '@tanstack/react-devtools'
import '@fontsource/barlow-condensed/400.css'
import '@fontsource/barlow-condensed/600.css'
import '@fontsource/ibm-plex-mono/400.css'

import appCss from '../styles.css?url'
import { SearchOverlay } from '#/components/SearchOverlay'
import { TestSiteBanner } from '#/components/TestSiteBanner'
import { MemberProfileSync } from '#/components/shop/MemberProfileSync'
import { OrgAuthProvider } from '#/lib/auth'
import { CartProvider } from '#/lib/cart'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      },
      {
        title: 'ORG',
      },
    ],
    links: [
      {
        rel: 'stylesheet',
        href: appCss,
      },
    ],
  }),
  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        <OrgAuthProvider>
          <CartProvider>
            <MemberProfileSync />
            <TestSiteBanner />
            {children}
            <SearchOverlay />
          </CartProvider>
        </OrgAuthProvider>
        <TanStackDevtools
          config={{
            position: 'bottom-right',
          }}
          plugins={[
            {
              name: 'Tanstack Router',
              render: <TanStackRouterDevtoolsPanel />,
            },
          ]}
        />
        <Scripts />
      </body>
    </html>
  )
}
