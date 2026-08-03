---
paths: ["**/*.test.*", "**/*.spec.*", "vitest.config.ts", "playwright.config.ts", "e2e/**/*"]
---

# Testing & Test Infrastructure

## Rule 13: Testing & Test Infrastructure

**All projects follow the workspace testing standard documented in `.claude/skills/testing-pipeline/`.**

**Four Testing Domains:**

1. **Vitest configuration:**
   - React Testing Library
   - jsdom environment
   - Coverage reporting
   - Globals enabled for describe/it/expect

2. **Test organization:**
   - Colocated test files next to source
   - `.test.ts/.test.tsx` for unit/integration
   - `.spec.ts` for E2E in `e2e/` directory
   - describe + it structure

3. **Testing patterns for Next.js App Router:**
   - Client components: RTL + userEvent
   - Custom hooks: renderHook
   - Server Actions: mocked deps
   - API routes: mocked Prisma
   - Next.js module mocking
   - Prisma mocking with vitest-mock-extended

4. **Playwright E2E testing:**
   - SaaS projects only (detect via `src/app/api/` or `'use server'` or `prisma/schema.prisma`)
   - Chromium-only
   - Production build testing

**Key Rules:**
- Tests colocated with source, NOT in `__tests__` directories
- Tests NOT in pre-commit hooks (too slow)
- No enforced coverage thresholds (coverage for visibility)
- Quality over quantity

**Autonomous Dependencies:**
- Per Rule 12: vitest, React Testing Library, Playwright dependencies installed during `/test-init` implementation

**Validation:** Run `/test-update` before commits to validate test coverage

For complete testing standard, see `.claude/skills/testing-pipeline/references/`
