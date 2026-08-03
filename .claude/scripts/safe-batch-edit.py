#!/usr/bin/env python3
"""
safe-batch-edit.py — atomic, all-or-nothing exact-string replacement across many files.

WHY THIS EXISTS (2026-08-02 incident)
    A reconcile script truncated a 30,890-byte vault file to ZERO. The defect:

        io.open(path, "w", encoding="utf-8").write(transform(content))

    `open(path, "w")` truncates the file IMMEDIATELY — before the argument to .write()
    is even evaluated. The replacement text contained surrogate-pair emoji that Python
    could not encode, so .write() raised AFTER the file was already empty.

    Two independent failures made it dangerous: (a) the file was opened before the
    content was known-good, and (b) one bad edit in a batch left earlier files in an
    unknown state. This script fixes both.

GUARANTEES
    1. VALIDATE EVERYTHING FIRST. Every file is read and every `old` string is checked
       for presence and uniqueness before ANY file is written. One bad edit aborts the
       whole run with zero side effects.
    2. ENCODE BEFORE OPEN. Replacement content is encoded to bytes up front. An
       un-encodable character fails while every file on disk is still intact.
    3. ATOMIC WRITES. Content goes to a temp file in the same directory, is flushed and
       fsync'd, then os.replace()'d over the target — an atomic rename on POSIX and on
       Windows (same volume). A crash mid-run can never leave a truncated file.
    4. SURROGATE REPAIR. Lone surrogate pairs from \\uD83D\\uDD34-style escapes are
       normalised to real codepoints instead of raising.

USAGE
    python scripts/safe-batch-edit.py edits.json [--dry-run]

    edits.json:
    [
      {"path": "abs/or/rel/path.md",
       "old":  "exact text to find (must appear EXACTLY once)",
       "new":  "replacement text",
       "label": "short description for the report"}
    ]

    --dry-run validates and reports without writing anything. Run it first.

EXIT CODES
    0 = all edits applied (or dry-run passed)   1 = validation failed, nothing written
"""

import io
import json
import os
import sys
import tempfile

# Windows consoles default to cp1252, which cannot encode much of what appears in
# labels or file paths. A crash HERE would hide which edit failed — the reporting
# must never be the thing that breaks. Force UTF-8, degrade gracefully if unavailable.
for _stream in (sys.stdout, sys.stderr):
    try:
        _stream.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass


def fix_surrogates(text):
    """Normalise lone/paired surrogates (from \\uD83D\\uDE00-style escapes) to real chars."""
    try:
        text.encode("utf-8")
        return text
    except UnicodeEncodeError:
        return text.encode("utf-16", "surrogatepass").decode("utf-16")


def atomic_write(path, text):
    """Write text to path atomically. The target is never opened for truncation."""
    data = fix_surrogates(text).encode("utf-8")  # encode FIRST — fail before touching disk
    directory = os.path.dirname(os.path.abspath(path)) or "."
    fd, tmp = tempfile.mkstemp(dir=directory, prefix=".sbe-", suffix=".tmp")
    try:
        with os.fdopen(fd, "wb") as fh:
            fh.write(data)
            fh.flush()
            os.fsync(fh.fileno())
        os.replace(tmp, path)  # atomic on POSIX and Windows (same volume)
    except BaseException:
        try:
            os.unlink(tmp)
        except OSError:
            pass
        raise


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    dry_run = "--dry-run" in sys.argv
    if not args:
        print(__doc__)
        return 1

    edits = json.load(io.open(args[0], encoding="utf-8"))

    # ---- PHASE 1: validate everything. Touch nothing. ----
    problems, planned = [], []
    cache = {}
    for i, e in enumerate(edits):
        path, label = e["path"], e.get("label", "edit %d" % (i + 1))
        old, new = fix_surrogates(e["old"]), fix_surrogates(e["new"])

        if path not in cache:
            try:
                cache[path] = io.open(path, encoding="utf-8").read()
            except Exception as ex:
                problems.append("%s — cannot read %s (%s)" % (label, path, ex))
                continue
        content = cache[path]

        n = content.count(old)
        if n == 0:
            problems.append("%s — `old` NOT FOUND in %s" % (label, path))
            continue
        if n > 1:
            problems.append("%s — `old` appears %d times in %s (must be unique)" % (label, n, path))
            continue
        try:
            new.encode("utf-8")
        except UnicodeEncodeError as ex:
            problems.append("%s — `new` is not encodable (%s)" % (label, ex))
            continue

        cache[path] = content.replace(old, new, 1)  # stage in memory only
        planned.append((path, label))

    if problems:
        print("VALIDATION FAILED — nothing was written.\n")
        for p in problems:
            print("  [FAIL] " + p)
        print("\n%d/%d edits would have applied. Fix the above and re-run." % (len(planned), len(edits)))
        return 1

    print("Validation passed: %d edit(s) across %d file(s)." % (len(planned), len(cache)))
    for path, label in planned:
        print("  [ok]   %s  [%s]" % (label, path))

    if dry_run:
        print("\n--dry-run: no files written.")
        return 0

    # ---- PHASE 2: write. Every target already validated and encodable. ----
    written = []
    try:
        for path, text in cache.items():
            atomic_write(path, text)
            written.append(path)
    except Exception as ex:
        print("\nWRITE FAILED on %s: %s" % (path, ex))
        print("Files already written (each atomically, none truncated): %s" % (written or "none"))
        print("No file is in a partial state. Re-run after fixing.")
        return 1

    print("\nApplied %d edit(s) to %d file(s) atomically." % (len(planned), len(written)))
    return 0


if __name__ == "__main__":
    sys.exit(main())
