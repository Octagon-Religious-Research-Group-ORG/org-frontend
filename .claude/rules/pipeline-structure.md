---
paths: ["src/**/*", "app/**/*", "features/**/*", "components/**/*", "hooks/**/*", "utils/**/*"]
---

# Structure-First Development

## Rule 8: Structure-First Development

**All projects follow the hybrid feature-based + route colocation structure standard documented in `.claude/skills/project-structure/`.**

**Before creating new files, determine correct location:**
- Route-private components use `app/[route]/_components/`
- Feature logic uses `features/[feature]/`
- Shared primitives use top-level `components/`, `hooks/`, `utils/`

**Follow unidirectional import flow:** `app/` → `features/` → `shared/`

**Naming conventions:**
- Directories: kebab-case
- Components: PascalCase.tsx
- Non-components: kebab-case.ts

**Feature modules:**
- Must expose public API via `index.ts`
- External code imports from barrel file
- Never import from feature internals

**Path aliases:** Use `@/` for cross-directory imports

**Validation:** Run `/structure-update` before committing to validate structure compliance

For complete structure standard, see `.claude/skills/project-structure/references/`
