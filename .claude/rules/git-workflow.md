# Git Workflow

## Rule 5: Always Use SSH for GitHub Remotes

**All GitHub remotes MUST use SSH format, never HTTPS.**

**SSH format (correct):**
```
git@github.com:SCDEVBrazil/repository-name.git
```

**HTTPS format (incorrect):**
```
https://github.com/SCDEVBrazil/repository-name.git
```

**Why SSH is required:**
- SSH uses key-based authentication (no password prompts)
- Works reliably in automated workflows and background processes
- HTTPS remotes timeout and require interactive credential input
- Workspace SSH key configured in `~/.ssh/config` for github.com

**When configuring remotes:**

1. **Cloning a new repository:**
   ```bash
   git clone git@github.com:SCDEVBrazil/repository-name.git
   ```

2. **Initializing a new repository:**
   ```bash
   git remote add origin git@github.com:SCDEVBrazil/repository-name.git
   ```

3. **Switching existing HTTPS to SSH:**
   ```bash
   git remote set-url origin git@github.com:SCDEVBrazil/repository-name.git
   ```

**SSH Configuration:**
- Workspace key: `~/.ssh/id_ed25519_workspace`
- Config file: `~/.ssh/config` (automatically routes github.com through workspace key)
- Key comment: `claude-workspace-windows`

**Never use HTTPS remotes** - they cause push timeouts and authentication failures in the workspace environment.
