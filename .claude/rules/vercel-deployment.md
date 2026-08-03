# Vercel Deployment Architecture (CRITICAL)

## Understanding Local Workspace vs. Vercel Deployment

This workspace organizes projects locally under `projects/` for filesystem organization. This is **completely independent** from Vercel deployment configuration.

## Key Concepts

1. **Local Workspace Paths:**
   - Projects live at: `C:\Users\Renan\claude-workspace\projects/<project-name>/`
   - This is for local organization and workspace automation only
   - Enables commands/agents to access projects via relative paths

2. **GitHub Repository Structure:**
   - Each project is a standalone git repository
   - Project files (src/, public/, package.json, etc.) are at the **repository root**
   - Example: `https://github.com/SCDEVBrazil/accelerate-ai-website.git` has files at repository root

3. **Vercel Deployment:**
   - Vercel clones from GitHub and builds from the **repository structure**
   - Local filesystem paths are irrelevant to Vercel
   - Vercel never sees your `projects/` directory structure

## Vercel Root Directory Setting

For **all standalone project repositories in this workspace:**

- ✅ **Correct:** `rootDirectory: null` (deploys from repository root)
- ❌ **Wrong:** `rootDirectory: "projects/<project-name>"` (this path doesn't exist in GitHub)

## When to use Root Directory

- **`null` (default):** Standalone project repositories (all projects in this workspace)
- **Subdirectory path:** Only for monorepos where multiple projects live in subdirectories
  - Example: A monorepo with `/frontend` and `/backend` folders
  - Set `rootDirectory: "frontend"` for the frontend project
  - Set `rootDirectory: "backend"` for the backend project

## ⚠️ CRITICAL WARNING

DO NOT set Vercel Root Directory to workspace paths like `projects/accelerate-ai`. This path exists on your local machine but NOT in the GitHub repository. Vercel deployment will fail with `NOW_SANDBOX_WORKER_ROOTDIR_NOT_EXIST`.

## Correct Configuration for All Projects

Every standalone project in `projects/` should have:
- Vercel Root Directory: `null`
- Git repository: Project files at repository root
- Local workspace: Files at `projects/<project-name>/`

The local workspace path and Vercel deployment path are **completely independent concepts**.

## ⚠️ CRITICAL: Next.js Version Requirement

All projects must use **Next.js 16.1.6 or higher** to avoid CVE-2025-66478, which blocks deployment on Vercel.

**During every project migration:**
1. Check Next.js version in `package.json`
2. If version < 16.1.6, update immediately: `npm install next@16.1.6`
3. Verify build passes: `npm run build`
4. Commit and push the update before completing migration

**Projects updated:**
- Accelerate AI: ✅ Next.js 16.1.6 (2026-02-15)
- AutoAssistPro: ✅ Next.js 15.5.9 (needs update to 16.1.6+)
- LoadTruth: ✅ Next.js 16.1.6 (2026-02-15)

## Vercel REST API (Write Operations)

**Environment Variable:** `VERCEL_TOKEN`

For operations requiring write access (updating project settings, triggering deployments, managing environment variables), use the Vercel REST API directly with the `VERCEL_TOKEN` environment variable.

**Setup:**
```bash
# Set VERCEL_TOKEN in your shell profile (~/.bashrc, ~/.zshrc, or PowerShell $PROFILE)
export VERCEL_TOKEN="your-vercel-api-token-here"

# Verify it's set in current session
echo $VERCEL_TOKEN
```

**Obtaining a token:** Generate from https://vercel.com/account/tokens

**Usage in API calls:**
```bash
# Example: Update project settings
curl -X PATCH \
  -H "Authorization: Bearer $VERCEL_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"nodeVersion": "22.x"}' \
  "https://api.vercel.com/v9/projects/my-project-name"
```

**When to use:**
- **MCP (read-only):** Checking deployment status, viewing logs, searching docs, listing projects
- **API token (write):** Updating project settings, triggering deployments, managing env vars, creating resources

**API Documentation:** https://vercel.com/docs/rest-api

**Security:**
- Token stored ONLY as environment variable (never hardcode in files or commit to git)
- Provides full read/write access to Vercel account
- Use MCP for read operations when possible (OAuth-based, scoped permissions)
- Never commit the token value to version control
