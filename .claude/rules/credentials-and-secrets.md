# Credentials and Secrets Management

## Rule 3: Never Hardcode Credentials

**NEVER hardcode API tokens, secrets, or credentials in any file. Always use environment variable references.**

This applies to:
- Plans (use `$VERCEL_TOKEN`, `$CLERK_SECRET_KEY`, etc.)
- Scripts (use `$VARIABLE_NAME` references)
- Commands (use `$VARIABLE_NAME` references)
- Documentation (show examples with `$VARIABLE_NAME`, never actual values)
- All other files in the workspace

**Where credentials belong:**
- ✅ `.env.local` files (never committed to git)
- ✅ Shell profiles (`~/.bashrc`, `~/.zshrc`, PowerShell `$PROFILE`)
- ❌ NEVER in version-controlled files
- ❌ NEVER in plans, scripts, commands, or documentation

**Example - Correct:**
```bash
curl -H "Authorization: Bearer $VERCEL_TOKEN" https://api.vercel.com/...
```

**Example - Wrong:**
```bash
curl -H "Authorization: Bearer vcp_abc123..." https://api.vercel.com/...
```

If you find hardcoded credentials in any file, flag it immediately as a security issue and replace with environment variable references.

## Rule 4: Load Secrets from File Before API Calls

**Before any Vercel API call (or other external API requiring authentication), load the required secret using the three-layer fallback approach.**

**Three-layer fallback (in order):**

1. **Primary: Read from secrets file** (most reliable)
   ```bash
   VERCEL_TOKEN=$(cat ~/.secrets/vercel-token 2>/dev/null)
   ```

2. **Secondary: Use environment variable** (if file doesn't exist)
   ```bash
   if [ -z "$VERCEL_TOKEN" ]; then
     VERCEL_TOKEN=$VERCEL_TOKEN
   fi
   ```

3. **Tertiary: Source shell profile** (if environment variable empty)
   ```bash
   if [ -z "$VERCEL_TOKEN" ]; then
     source ~/.bashrc
   fi
   ```

4. **Verify token is set before proceeding:**
   ```bash
   if [ -z "$VERCEL_TOKEN" ]; then
     echo "ERROR: VERCEL_TOKEN not found in file, environment, or shell profile"
     exit 1
   fi
   ```

**Never proceed with an empty token.** API calls with missing authentication will fail with 403 Forbidden errors and waste time debugging.

**Secret file locations:**
- `~/.secrets/vercel-token` — Vercel API token (primary source)
- `~/.secrets/` directory has restricted permissions (chmod 700)
- Token files have restricted permissions (chmod 600)
- Secrets directory is NOT committed to git

**Fallback locations:**
- `$VERCEL_TOKEN` environment variable (secondary)
- `~/.bashrc` export statement (tertiary, kept for compatibility)

**Why this three-layer approach:**
- **File-based secrets are most reliable** — persist across sessions, work in all contexts
- **Environment variables may not be available** — background processes, different shell contexts
- **Shell profile reload is last resort** — may not work in all environments (Git Bash on Windows)
- **Three layers ensure secrets are accessible** — graceful degradation

**Example - Correct workflow:**
```bash
# Load token with three-layer fallback
VERCEL_TOKEN=$(cat ~/.secrets/vercel-token 2>/dev/null)
if [ -z "$VERCEL_TOKEN" ]; then
  # File doesn't exist, try environment variable
  VERCEL_TOKEN=$VERCEL_TOKEN
fi
if [ -z "$VERCEL_TOKEN" ]; then
  # Environment variable empty, source shell profile
  source ~/.bashrc
fi

# Verify token is set
if [ -z "$VERCEL_TOKEN" ]; then
  echo "ERROR: VERCEL_TOKEN not found"
  exit 1
fi

# Now proceed with API call
curl -H "Authorization: Bearer $VERCEL_TOKEN" \
  "https://api.vercel.com/v9/projects/..."
```

**Simplified one-liner (for quick checks):**
```bash
VERCEL_TOKEN=$(cat ~/.secrets/vercel-token 2>/dev/null || echo $VERCEL_TOKEN)
[ -z "$VERCEL_TOKEN" ] && source ~/.bashrc
echo $VERCEL_TOKEN | head -c 5  # Verify it's set
```
