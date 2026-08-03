---
paths: ["src/**/*", "app/**/*", "eslint.config.js", ".prettierrc", "tsconfig.json", ".husky/**/*"]
---

# Code Quality & Consistency

## Rule 11: Code Quality & Consistency

**All projects follow the workspace code quality standard documented in `.claude/skills/code-quality/`.**

**Pre-Commit Enforcement:**
- All code must pass ESLint, Prettier, and TypeScript checks before commit
- Enforced by Husky + lint-staged pre-commit hooks

**Five Quality Domains:**

1. **ESLint 9 flat config:**
   - Next.js + React + TypeScript rules
   - Prefer @ts-expect-error over @ts-ignore
   - no-console warns on console.log

2. **Prettier formatting:**
   - Tailwind plugin for class sorting
   - Separate from ESLint, no eslint-plugin-prettier

3. **TypeScript strict mode:**
   - Plus: noUnusedLocals, noUnusedParameters, noUncheckedIndexedAccess, noImplicitOverride

4. **Naming conventions:**
   - Directories: kebab-case
   - Components: PascalCase.tsx
   - Non-components: kebab-case.ts
   - Next.js framework files: exact conventions

5. **Pre-commit hooks:**
   - Husky + lint-staged
   - Run ESLint --fix and Prettier --write on staged files
   - NO TypeScript type checking (too slow)

**Integration with Other Pipelines:**
- Structure pipeline defines naming conventions (quality enforces)
- Security pipeline recommends ESLint patterns (quality could enforce)
- Error handling pipeline bans console.log (quality flags with no-console)
- Docs pipeline defines markdown formatting (quality enforces with Prettier)

**Validation:** Run `/quality-update` before commits to validate compliance

For complete quality standard, see `.claude/skills/code-quality/references/`
