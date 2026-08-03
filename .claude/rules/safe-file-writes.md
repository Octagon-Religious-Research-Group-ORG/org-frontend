# Safe File Writes — never truncate on failure

## Rule 25: A file must never be opened for writing until its replacement content is fully materialised and encodable

**Origin — the 2026-08-02 incident.** A `/reconcile` batch-edit script truncated `knowledge-base/personal/health/PROFILE.md` from **30,890 bytes to ZERO**. It was recovered from git within minutes and nothing was lost, but the failure was silent and nearly went unnoticed.

The defect, in one line:

```python
io.open(path, "w", encoding="utf-8").write(transform(content))   # ❌ NEVER DO THIS
```

**`open(path, "w")` truncates the file immediately — before the argument to `.write()` is evaluated.** The replacement text contained surrogate-pair emoji escapes that Python could not encode to UTF-8, so `.write()` raised *after* the file had already been emptied.

Two independent defects made it dangerous:
1. The file was opened **before** the content was known to be valid.
2. One bad edit in a multi-file batch left earlier files in an **unverified** state.

A tool built to enforce *"never delete — only supersede"* deleted a file. **The governing rule was sound; the mechanism enforcing it was not.**

---

## The rules

### 1. Prefer the Edit / Write tools
For ordinary single-file changes, use the harness `Edit` and `Write` tools. They do not have this failure mode. **Ad-hoc Python/bash write logic is a last resort, for genuine multi-file batches.**

### 2. For batch edits, use the shared helper
The script ships in both contexts — pick the path that exists where you are:

```bash
# In the workspace repo:
python scripts/safe-batch-edit.py edits.json --dry-run   # validate first
python scripts/safe-batch-edit.py edits.json             # then apply

# In a project repo (synced copy):
python .claude/scripts/safe-batch-edit.py edits.json --dry-run
python .claude/scripts/safe-batch-edit.py edits.json
```
It guarantees: **validate-all-before-writing-any** · **encode before open** · **atomic temp-file + `os.replace`** · surrogate repair. A failure anywhere leaves every file untouched.

### 3. If you must write by hand, obey all three
- **Encode first.** Build the full string and `.encode("utf-8")` it *before* opening anything. An un-encodable character must fail while the file is still intact.
- **Write atomically.** Temp file in the same directory → `flush` → `fsync` → `os.replace(tmp, target)`. Never open the target in `"w"` mode.
- **Validate the whole batch up front.** Confirm every search string exists and is **unique** in its file before mutating anything. Ambiguous matches are as dangerous as missing ones.

### 4. Emoji and non-ASCII
Write real characters (`🔴`) rather than surrogate-pair escapes (`🔴`). Python cannot encode lone surrogates to UTF-8. If constructing them programmatically, normalise with:
```python
text.encode("utf-16", "surrogatepass").decode("utf-16")
```

### 5. After ANY mid-batch crash, assume the whole batch is suspect
Verify **every file the command touched**, not just the one named in the traceback. The 2026-08-02 truncation was in a file the traceback *did* name — and was still nearly missed, because the traceback was first misread as a cosmetic printing error.

### 6. When a tool reports the evidence is missing, check the tool before doubting the evidence
The truncation surfaced only because a subsequent step reported **"quote not found"** for five edits, and the file was inspected rather than concluding the source had been wrong. **A tool reporting absence is itself a hypothesis.**

---

## Mechanical enforcement — WORKSPACE ONLY

**`.claude/hooks/guard-zero-byte-files.sh`** — a `PostToolUse(Bash)` tripwire. After every Bash call it finds git-**tracked** files that are now **0 bytes** but had content in git, exits **2** (blocking), and prints the exact `git checkout --` restore command. It compares against the **index** (not HEAD), because `git checkout -- <file>` restores from the index — and that also catches a staged-but-never-committed file truncated to zero, which a HEAD-only check misses entirely.

It catches the **symptom**, not one cause — so it also covers `>` redirect typos, interrupted `tee`, failed `sed -i`, and every future variant.

### ⚠️ In a project repo, this tripwire DOES NOT EXIST

Project repos carry `.claude/rules/` and `.claude/scripts/` — **no `settings.json`, no hooks**. Nothing will catch a truncation for you here, including during autonomous GitHub Actions runs. **The discipline above is the only protection**, so in a project repo:
- Never hand-roll write logic — use `Edit`/`Write`, or `.claude/scripts/safe-batch-edit.py`.
- **Commit before any multi-file batch edit.** Restore requires a git copy; without one the bytes are simply gone.

**This is why frequent commits matter.** The 2026-08-02 recovery was clean only because the vault is committed to git after every substantive pass. Recovery is git-dependent: `git checkout` restores the **index** version, so anything edited after the last `git add` existed only on disk and is unrecoverable. Committing often is not hygiene advice — it *is* the recovery mechanism.
