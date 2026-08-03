---
paths: ["src/**/*", "app/**/*", "middleware.ts", "config/env.ts", ".env*"]
---

# Security-First Development

## Rule 9: Security-First Development

**All projects follow the workspace security standard documented in `.claude/skills/security-hardening/`.**

**Input Validation:**
- Validate all inputs with Zod at API routes and Server Actions
- Never trust client data

**Security Headers:**
- Configure in middleware via `@scdevbrazil/middleware` (`createSecurityHeaders()`) or inline
- CSP with nonces, HSTS, X-Frame-Options

**Server/Client Boundaries:**
- Enforce with `server-only` package
- Never use `NEXT_PUBLIC_` for secrets

**Multi-Layer Authentication:**
- Middleware + page + action + data layer
- Never rely on middleware alone

**Environment Variables:**
- Validate at startup via `config/env.ts` using `@scdevbrazil/config` (`createEnvConfig()`) or inline Zod
- Crash on missing required vars

**Secrets:**
- Never commit secrets
- Use `.env.example` for documentation

**Next.js Version:**
- Keep updated (16.1.6+ required for CVE-2025-55182, CVE-2025-66478)

**Validation:** Run `/security-update` before commits to validate compliance

For complete security standard, see `.claude/skills/security-hardening/references/`
