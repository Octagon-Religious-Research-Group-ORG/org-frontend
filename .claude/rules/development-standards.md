# Development Standards — Quick Reference

Condensed actionable patterns from all 8 workspace pipelines. Auto-loaded every session.
Apply these patterns during active coding — pipelines audit compliance after the fact.

---

## 1. Documentation

**When to update docs:**
- Modified function signature → update its JSDoc/TSDoc
- Added/modified API route → update `docs/api.md`
- Changed auth logic or middleware → update `docs/auth.md`
- Modified database schema → update `docs/database.md`
- Significant technical decision → create ADR in `docs/decisions/`
- Deployment config change → update `docs/deployment.md`

**Inline docs:**
- All exported functions/interfaces/types get JSDoc with `@param`, `@returns`
- Focus on WHY (constraints, edge cases), not WHAT (code is self-documenting)
- Skip docs on private functions unless logic is complex

**Doc files:**
- Keep under 400 lines each — split if longer
- One concern per file (don't mix architecture with deployment)
- Project CLAUDE.md is a router under 150 lines, not a knowledge base

---

## 2. Project Structure

**Directory layout (hybrid feature-based + route colocation):**
```
src/
├── app/              # Route colocation (pages, layouts, API routes)
│   ├── (auth)/       # Route groups for shared layouts
│   ├── (dashboard)/
│   │   └── settings/
│   │       └── _components/  # Route-private (underscore prefix)
│   └── api/v1/       # Versioned API routes
├── features/         # Business logic spanning routes
│   └── billing/
│       ├── components/
│       ├── hooks/
│       ├── types/
│       ├── utils/
│       └── index.ts  # Public API (barrel file)
├── components/ui/    # Shared UI primitives
├── hooks/            # Shared hooks
├── lib/              # Configured third-party libs (db, auth, stripe)
├── types/            # Shared TypeScript types
├── utils/            # Shared utilities
├── config/           # Validated env vars + constants
└── test/             # Shared test utilities
```

**Import direction (CRITICAL — unidirectional flow):**
```
app/ → features/ → shared (components/, hooks/, utils/, types/)
```
- Features CANNOT import from other features
- Features CANNOT import from app/
- Shared CANNOT import from features/ or app/

**Naming conventions:**
| Type | Convention | Example |
|------|-----------|---------|
| Directories | kebab-case | `user-management/` |
| Components | PascalCase.tsx | `BillingForm.tsx` |
| Hooks | kebab-case.ts | `use-auth.ts` |
| Utilities | kebab-case.ts | `format-date.ts` |
| Types | kebab-case.types.ts | `auth.types.ts` |
| Framework files | exact Next.js names | `page.tsx`, `layout.tsx`, `route.ts` |
| Private dirs | underscore prefix | `_components/` |
| Barrel files | index.ts | `index.ts` (never .tsx) |

**Import conventions:**
- `@/` alias for cross-directory imports (never `../../../`)
- Relative imports only within same directory or subdirectory
- Import from feature barrel files, never from feature internals
- Order: external deps → `@/` imports → relative → type imports → CSS

---

## 3. Security

**Input validation (EVERY boundary):**
- Every API route: validate body/params with Zod `safeParse()` before processing
- Every Server Action: validate inputs with Zod + re-check auth (they're public endpoints)
- Every form: client-side validation mirrors server-side Zod schemas
- File uploads: validate MIME type, extension, and size

**Environment variables:**
- Never use `process.env` directly — access through `src/config/env.ts` (use `@scdevbrazil/config` for new projects; inline Zod valid in existing projects)
- Never prefix secrets with `NEXT_PUBLIC_` (exposes to client bundle)
- `.env.example` committed with variable names only, `.env.local` gitignored

**Server/client boundary:**
- Use `server-only` package on modules with DB access or secrets
- Server Actions always re-validate auth — never assume caller is your UI
- Data Access Layer returns DTOs, never raw DB objects to client
- `import 'server-only'` on every file touching Prisma or secrets

**Headers & XSS:**
- `src/middleware.ts` sets CSP, HSTS, X-Frame-Options, X-Content-Type-Options
- Never use `dangerouslySetInnerHTML` — if unavoidable, sanitize with DOMPurify
- Auth: multi-layer (middleware → page → server action → data layer)

---

## 4. Error Handling

**Custom error classes** (`src/lib/errors.ts` — use `@scdevbrazil/errors` for new projects; inline valid in existing projects):
- `AppError` base with `statusCode`, `code`, `isOperational`
- `ValidationError` (400), `NotFoundError` (404), `UnauthorizedError` (401)
- `ForbiddenError` (403), `ConflictError` (409), `RateLimitError` (429)

**API routes:**
- Wrap handler in try/catch → centralized `handleApiError()` utility
- Return `{ success, data }` or `{ success: false, error: { code, message } }`
- Never leak stack traces to client — log full details server-side
- `redirect()` and `notFound()` go OUTSIDE try/catch (they throw internally)

**Server Actions:**
- Return result objects `{ success, data }` or `{ success: false, error }` — never throw
- Flatten Zod errors to `fieldErrors` for form field mapping
- Use `useActionState` on client for form integration

**Error boundaries (required for every project):**
- `app/error.tsx` — root error boundary
- `app/global-error.tsx` — catches root layout errors
- `app/not-found.tsx` — custom 404
- SaaS apps: granular `error.tsx` per route segment

**Logging:**
- Use structured `logger` from `src/lib/logger.ts` (use `@scdevbrazil/logger` for new projects; inline valid in existing projects) — never raw `console.log` in production
- JSON format in production (queryable in Vercel), pretty-print in dev
- Log: errors with context, auth failures, rate limit hits, slow operations
- Never log: passwords, tokens, API keys, full request bodies, PII

---

## 5. Code Quality

**TypeScript:**
- `strict: true` + `noUnusedLocals`, `noUnusedParameters`, `noUncheckedIndexedAccess`
- No `any` unless explicitly justified with `@ts-expect-error` + explanation
- Prefer `@ts-expect-error` over `@ts-ignore`

**Formatting & linting:**
- ESLint 9 flat config (`eslint.config.mjs`) + Prettier (`.prettierrc`)
- `no-console` rule: only `console.warn` and `console.error` allowed
- Prettier: semi, singleQuote, trailingComma es5, tabWidth 2, printWidth 100
- Tailwind plugin for automatic class sorting

**Pre-commit (Husky + lint-staged):**
- JS/TS files: `eslint --fix` then `prettier --write`
- JSON/MD/CSS/YAML: `prettier --write` only
- No TypeScript type-checking in pre-commit (too slow — IDE + CI handles it)

**File size:** Modularize at ~700 lines — break into focused modules

---

## 6. Testing

**File placement:** Colocated with source — `Button.test.tsx` next to `Button.tsx`
- `.test.ts/.test.tsx` for unit/integration (Vitest)
- `.spec.ts` for E2E (Playwright) in top-level `e2e/` directory
- Shared test utilities in `src/test/` (render helpers, mocks, fixtures)

**Minimum test requirements for new features:**
- 1 unit test per utility function
- 1 component test per interactive component
- Server Actions: test result objects with mocked Prisma
- API routes: test status codes and response format

**Testing patterns:**
- Vitest + React Testing Library + userEvent for components
- `renderHook` for custom hooks
- `vitest-mock-extended` for type-safe Prisma mocking
- Arrange-Act-Assert structure, "it does X when Y" descriptions
- Query by accessible roles/labels, not test IDs
- Async Server Components: test data layer separately, use E2E for rendering

**What NOT to test:** implementation details, third-party internals, trivial wrappers, CSS

---

## 7. Database

**Prisma singleton** (`src/lib/db.ts` — use `@scdevbrazil/database` `createPrismaSingleton()` for new projects; inline valid in existing projects):
- Cache PrismaClient on `globalThis` to prevent connection leaks in hot-reload
- `connection_limit=1` on DATABASE_URL for serverless (prevents pool exhaustion)

**Schema conventions:**
- `cuid()` primary keys (sortable, collision-resistant)
- `@db.Timestamptz` on all date fields, `@db.VarChar(N)` for bounded strings
- `createdAt` + `updatedAt` on every model
- `deletedAt` for soft deletes (never hard delete by default)
- Always index foreign keys and common WHERE clause fields
- Explicit `@relation` names on all relations

**Queries:**
- Always filter by `userId` for multi-tenant isolation — never query without it
- Use `select` to pick specific fields (avoid SELECT *)
- Use `include` to prevent N+1 queries
- `$transaction` for atomic operations
- Validate input with Zod BEFORE any database write

**Migrations:**
- `prisma migrate dev --name descriptive-name` (never generic "migration" or "update")
- Never `db push` in production — always `prisma migrate deploy`
- Seeds use `upsert` (idempotent, safe to re-run)
- `prisma generate` in build script: `"build": "prisma generate && next build"`
- Desktop/Electron apps: use SQLite, not Railway PostgreSQL

---

## 8. API

**Response envelope:**
```typescript
// Success: { success: true, data: T, meta?: {} }
// Error:   { success: false, error: { code, message, details? } }
```
Use `apiSuccess()` and `apiError()` helpers from `@scdevbrazil/api` (use `@scdevbrazil/api` for new projects via `src/lib/api/index.ts` re-export; inline `src/lib/api/response.ts` valid in existing projects).

**Pagination:**
- Cursor-based (default): `{ cursor, limit }` → `{ data, pagination: { hasMore, nextCursor } }`
- Offset-based (small datasets): `{ page, limit }` → `{ data, pagination: { total, page, hasMore } }`
- Default limit 20, max limit 100

**Rate limiting:**
- Upstash Redis in production, in-memory Map in development
- `withRateLimit()` wrapper on route handlers
- Always return 429 with `Retry-After` header
- Stricter limits on unauthenticated and sensitive endpoints (login: 5/min)

**API versioning:** Path prefix `/api/v1/`

**HTTP status codes:**
- 200 OK, 201 Created (+ Location header), 204 No Content (deletes)
- 400 Validation, 401 Unauthorized, 403 Forbidden, 404 Not Found, 409 Conflict
- 429 Rate Limited (+ Retry-After), 500 Internal Error

**Caching:** Cache-Control headers + ETags for GET endpoints serving public data

**Webhooks:** Verify HMAC-SHA256 signature, check timestamp freshness, idempotency via processed webhook table

**Health check:** `GET /api/health` returning status, version, timestamp

---

## 9. Code Change Tracking

**When modifying project source files during a session, log each changed file to `outputs/.session-changes.tmp`:**

```
CODE_CHANGED: projects/<project-name>/<relative-path> — <what changed>
```

**Examples:**
```
CODE_CHANGED: projects/autoassistpro/src/app/api/users/route.ts — added Zod validation to POST handler
CODE_CHANGED: projects/loadtruth/prisma/schema.prisma — added AuditLog model with soft delete
CODE_CHANGED: projects/accelerate-ai/src/lib/errors.ts — added RateLimitError class
```

**Rules:**
- One line per file changed (multiple changes to same file = one line with combined description)
- Only log project source files — not workspace infrastructure (commands, rules, context)
- `/done` extracts these lines and passes them to `/validate` for targeted pipeline validation
- This enables surgical validation of only the files you actually changed, avoiding full-project scans

---

## 10. Infrastructure & Plan Completion Logging (CRITICAL — prevents vault/plan staleness)

These events are NOT code changes, but they MUST be logged to `outputs/.session-changes.tmp` or they will be silently missed by `/done`.

### Infrastructure activation events → always log BOTH `type: status` AND `type: context`

When any of the following happen, write two `[VAULT-UPDATE]` blocks (status + context):
- Deploying a service to a VPS or cloud provider
- Running `prisma migrate` or `prisma db push` (tables created/changed)
- Configuring auth keys (Clerk, OAuth, API keys) in production
- Setting environment variables in Vercel, Railway, or VPS `.env`
- Enabling a domain, SSL, or nginx config

**Why both are needed:**
- `type: status` → updates STATUS.md (what's working/blocked/next steps) ✅
- `type: context` → updates CONTEXT.md (architecture live, services active, env vars configured) — **this is what gets missed**

Example when deploying a VPS service:
```
[VAULT-UPDATE] project: aios-studio
  what: Hetzner VPS provisioned at 89.167.71.108 — FastAPI deployed as systemd service; all Vercel env vars set
  files: vps-api/main.py, vps-api/deploy-vps-api.sh
  type: status
  ---
[VAULT-UPDATE] project: aios-studio
  what: Phase 2 infrastructure now live: VPS (89.167.71.108), Clerk real keys active, Railway DB tables created, all 5 Vercel env vars configured
  files: vps-api/main.py, src/middleware.ts, prisma/schema.prisma
  type: context
  ---
```

### Plan completion events → always update the plan file AND log it

When completing steps from an existing plan in `plans/`:
1. Edit the plan file directly — mark steps as done, update "Next Steps" section, add an implementation note block with the date
2. Log to session-changes: `Updated plans/<plan-file>.md — marked [step description] as complete`

**Rule 7 only fires when a plan file is already open.** Infrastructure sessions (SSH, MCP calls, env var configuration) don't open plan files — so you must remember to connect the work to the plan manually. If the session involved completing steps from a plan, the plan file MUST be updated before `/done` is run.

---

**Last Updated:** 2026-03-09
