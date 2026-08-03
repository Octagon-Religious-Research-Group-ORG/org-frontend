---
paths: ["src/**/*", "app/**/*", "src/lib/errors.ts", "src/lib/logger.ts", "app/error.tsx"]
---

# Error Handling & Logging

## Rule 10: Error Handling & Logging

**All projects follow the workspace error handling standard documented in `.claude/skills/error-handling/`.**

**API Routes:**
- Consistent JSON error response format: `{ success: false, error: { code, message, details? } }`
- Try/catch with centralized error handling
- Never expose stack traces or internal details to clients

**Server Actions:**
- Return result objects, never throw
- Use discriminated union types `ActionResult<T>` for type safety

**Custom Error Classes:**
- Define in `src/lib/errors.ts` (re-exports from `@scdevbrazil/errors` or inline)
- Typed, contextual errors with `isOperational` flag
- Operational errors get user-friendly messages
- Unexpected errors get generic "Something went wrong"
- New projects use `@scdevbrazil/errors` package; existing inline classes are also valid

**React Error Boundaries:**
- `error.tsx` at app root and critical route segments
- Catch rendering errors with retry + recovery UI

**Structured Logging:**
- Use `src/lib/logger.ts` (re-exports from `@scdevbrazil/logger` or inline)
- Output JSON in production for queryable Vercel logs
- Never log passwords/tokens/PII
- New projects use `@scdevbrazil/logger` package; existing inline logger is also valid

**Async Event Handlers:**
- Wrap in try/catch (error boundaries don't catch these)

**User-Friendly Messages:**
- Map error codes to user-friendly messages
- Never display raw API errors

**Integration with Security:**
- Zod validation errors formatted consistently as `{ code: "VALIDATION_ERROR", message, details: zodError.errors }`

**Validation:** Run `/error-update` before commits to validate compliance

For complete error handling standard, see `.claude/skills/error-handling/references/`
