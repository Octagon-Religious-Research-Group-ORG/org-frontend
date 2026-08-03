---
paths: ["prisma/**/*", "src/lib/db.ts", "DATABASE_URL"]
---

# Database Patterns & Infrastructure

## Rule 14: Database Patterns & Infrastructure

**All projects requiring persistent data use Railway PostgreSQL + Prisma ORM following workspace database standard documented in `.claude/skills/database-pipeline/`.**

**Railway MCP Integration:**
- Railway MCP enables autonomous database management
- Create databases, provision from templates, manage environment variables

**Five Database Domains:**

1. **Railway Infrastructure & MCP:**
   - Railway MCP in .mcp.json
   - CLI auth, token management (Rule 4 fallback)
   - deploy-template for PostgreSQL
   - Environment variables
   - TCP Proxy
   - Optional PostgreSQL MCP

2. **Prisma Schema Conventions:**
   - Singleton pattern `lib/db.ts` via `@scdevbrazil/database` (`createPrismaSingleton()`) or inline — prevents connection leaks
   - cuid primary keys for sortability
   - Native types: @db.Text/@db.VarChar/@db.Timestamptz
   - Indexes for query performance
   - Multi-tenant userId isolation (application-level)
   - Soft deletes: deletedAt (never hard delete)
   - Audit logging: createdAt/updatedAt
   - Explicit @relation names

3. **Migration Workflow:**
   - `prisma migrate` for production (never `db push`)
   - Migration naming: descriptive not timestamps
   - Seed patterns: idempotent upsert not create
   - Package.json scripts: migrate:dev, db:push, db:seed, prisma:generate, prisma:studio, production:build

4. **Connection Management & Performance:**
   - Connection pooling: `connection_limit=1` for serverless Vercel functions
   - Railway private network vs TCP Proxy for local dev
   - Query optimization: select specific fields, avoid N+1
   - Transactions: $transaction API
   - Index strategy driven by query patterns
   - Query logging middleware for debugging

5. **Integration with Existing Pipelines:**
   - Docs pipeline: generates database ADR + docs/database.md
   - Structure pipeline: defines lib/db.ts + prisma/ directory locations
   - Security pipeline: prevents DATABASE_URL commits via .gitignore
   - Error handling: wraps Prisma errors with custom error classes
   - Code quality: runs prisma generate in build
   - Testing: mocks Prisma with vitest-mock-extended

**Desktop/Electron Apps:**
- ALWAYS skipped (use local storage: SQLite/LevelDB/IndexedDB)
- PostgreSQL defeats purpose of desktop apps (offline-first architecture)

**Commands:**
- `/db-init projects/{name}` — Initialize database setup (4 modes: Audit, Generate conversion plan, Scaffold from scratch, Skip static sites/desktop)
- `/db-update projects/{name}` — Validate incremental compliance (schema drift, conventions, connection management)

For complete database standard, see `.claude/skills/database-pipeline/references/`
