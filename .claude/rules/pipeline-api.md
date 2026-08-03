---
paths: ["src/app/api/**/*", "src/lib/api/**/*"]
---

# API/RESTful Standards

## Rule 15: API/RESTful Standards

**All projects with API routes (`src/app/api/`) follow the workspace API standard documented in `.claude/skills/api-pipeline/`.**

**Core Requirements:**

**Response Format:**
- Use `apiSuccess()`/`apiError()` envelope helpers from `@scdevbrazil/api` (via `src/lib/api/index.ts` re-export or inline `src/lib/api/response.ts`)
- Never raw `NextResponse.json()`
- Standard envelope: `{ success, data?, error?, meta? }`
- Integrates with error handling pipeline's error format

**Pagination:**
- Collection endpoints (GET routes returning arrays) MUST implement pagination
- Cursor-based pagination (default) via `paginateCursor()` for optimal performance
- Offset-based via `paginateOffset()` for simple bounded datasets
- Default page size: 20, max: 100

**Rate Limiting:**
- All routes MUST have rate limiting via middleware (global) or per-route wrapper
- Use `@upstash/ratelimit` for production (serverless-compatible)
- In-memory Map for development fallback
- Expose rate limit headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`
- Return 429 with `Retry-After` when exceeded

**Caching:**
- GET routes MUST set appropriate `Cache-Control` headers
- Use `setCacheHeaders()` helper with strategy types: `'no-cache'`, `'short'` (60s), `'medium'` (5min), `'long'` (1hr), `'immutable'`
- Support ETags for conditional requests (`If-None-Match` → 304)
- Never cache authenticated/user-specific data publicly

**API Documentation:**
- Generate OpenAPI 3.0 specs via `next-swagger-doc` with JSDoc `@swagger` comments
- Serve spec at `/api/openapi.json`, Swagger UI at `/api-docs` (dev only, gated by `NODE_ENV`)
- Integrate Zod schemas for request/response types

**Webhook Handling:**
- Webhook routes at `app/api/webhooks/[provider]/route.ts`
- MUST verify signatures via `verifyWebhookSignature()` using HMAC-SHA256 + `crypto.timingSafeEqual`
- Access raw body before parsing
- Implement idempotency: check `webhookId` before processing
- Return 200 immediately, process async
- Validate timestamp freshness (reject >5min old)

**Health Check:**
- Health endpoint at `/api/health` is MANDATORY for SaaS projects
- Returns `{ status: 'ok', timestamp, version, environment }`
- Optional `?check=db` for database connectivity verification
- Used by uptime monitoring and deployment verification

**API Versioning:**
- Use URL path versioning: `app/api/v1/[resource]/route.ts`
- Never use header or query parameter versioning

**Naming Conventions:**
- Resource names: plural nouns (`/users`, `/orders`)
- Paths: kebab-case (`/rate-confirmations`)
- HTTP verbs for actions (GET, POST, PUT, PATCH, DELETE)

**Prohibited Patterns:**
- No verb URLs (`/getUser`, `/createOrder`)
- No raw `NextResponse.json()` outside envelope helpers
- No uncached GET routes without justification
- No routes without rate limiting
- No webhooks without signature verification

**When adding a new API route:**
1. Create route at `src/app/api/v1/{resource}/route.ts`
2. Use `apiSuccess()` and `apiError()` for all responses
3. Add Zod validation schema for request body
4. Add rate limiting via `withRateLimit()` wrapper or middleware
5. Add caching headers if GET route
6. Add JSDoc `@swagger` comments for documentation
7. If collection endpoint: implement pagination
8. Return correct HTTP status codes (200/201/204/400/401/403/404/422/429/500)
9. Log errors server-side, return generic messages client-side
10. Write tests for route using standardized response assertions

**Commands:**
- `/api-init projects/{name}` — Initialize or audit API standards (Audit-Only, Harden Existing, Implement From Scratch, SKIP for static sites)
- `/api-update projects/{name}` — Validate ongoing compliance across seven domains

For complete API standard, see `.claude/skills/api-pipeline/references/`
