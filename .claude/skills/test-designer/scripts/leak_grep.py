#!/usr/bin/env python3
"""Leak-grep gate for the fault-first test designer's input firewall - zero LLM tokens.

The designer must not read the author's own tests or authored assertions; if harness tokens
reach the model it becomes a transcriber of the author's blind spots (see ADR-007). This gate
scans every designer input file for those tokens and FAILS THE RUN (exit 1) on any hit, so the
firewall is enforced by a script, not by promise.

Two classes of leak:
  - harness tokens inside a file's content: expect(, toHave, getByRole, data-testid, .spec.
  - a file that IS a test artifact by name: *.spec.*, *.test.*, cases.yaml

Usage:
    python leak_grep.py <input-file> [<input-file> ...]

Exit codes: 0 = clean, 1 = leak found (abort the run), 2 = usage / unreadable input.
"""
import os
import re
import sys

TOKENS = ["expect(", "toHave", "getByRole", "data-testid", ".spec."]
_NAME_RE = re.compile(r"(\.spec\.|\.test\.|(^|[\\/])cases\.ya?ml$)", re.IGNORECASE)


def main(argv):
    if not argv:
        sys.stderr.write("usage: leak_grep.py <input-file> [<input-file> ...]\n")
        return 2
    leaks = 0
    for path in argv:
        if _NAME_RE.search(path):
            sys.stderr.write("LEAK %s: file name matches a test-artifact pattern (firewalled input)\n" % path)
            leaks += 1
            continue
        try:
            with open(path, "r", encoding="utf-8", errors="replace") as fh:
                text = fh.read()
        except OSError as exc:
            sys.stderr.write("error: cannot read %s (%s)\n" % (path, exc))
            return 2
        for n, line in enumerate(text.splitlines(), 1):
            for token in TOKENS:
                if token in line:
                    sys.stderr.write("LEAK %s:%d: harness token %r: %s\n"
                                     % (path, n, token, line.strip()[:120]))
                    leaks += 1
    if leaks:
        sys.stderr.write("leak-grep gate: %d leak(s); these inputs are firewalled - abort the run\n" % leaks)
        return 1
    sys.stdout.write("leak-grep gate: clean (%d file(s))%s" % (len(argv), os.linesep))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
