import { defineConfig } from 'vitest/config'
import { devtools } from '@tanstack/devtools-vite'

import { tanstackStart } from '@tanstack/react-start/plugin/vite'

import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import netlify from '@netlify/vite-plugin-tanstack-start'

const config = defineConfig({
  resolve: { tsconfigPaths: true },
  plugins: [devtools(), netlify(), tailwindcss(), tanstackStart(), viteReact()],
  test: {
    exclude: ['e2e/**', 'node_modules/**', 'dist/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json-summary'],
      include: [
        'src/lib/api.ts',
        'src/lib/auth.tsx',
        'src/lib/cart.tsx',
        'src/lib/content-api.ts',
        'src/lib/content-defaults.ts',
        'src/lib/search.tsx',
        'src/lib/sections.ts',
        'src/lib/svg.ts',
        'src/lib/membership-api.ts',
        'src/components/members/MembersEntry.tsx',
        'src/components/shop/MemberProfileSync.tsx',
        'src/components/TestSiteBanner.tsx',
        'src/components/admin/content-editor/editor-utils.ts',
        'src/components/admin/website-workbench/workbench-state.ts',
        'src/components/admin/website-workbench/website-pages.ts',
      ],
      thresholds: {
        statements: 100,
        branches: 100,
        functions: 100,
        lines: 100,
      },
    },
  },
})

export default config
