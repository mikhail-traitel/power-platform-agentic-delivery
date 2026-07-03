#!/usr/bin/env python3
"""Validate a reviewer's findings JSON against the schema (stdlib only).

The LLM occasionally emits malformed JSON or a bad severity. Rather than let that
corrupt the pipeline, we validate deterministically and, on failure, print a
machine-readable error the orchestrator feeds back for a one-shot full regeneration
(never a patch - patching invalid JSON tends to compound the damage).

Exit 0 = valid. Exit 1 = invalid (details as JSON on stdout).

Usage:
    python validate_findings_json.py <reviewer.json>
"""
import json
import sys

VALID_SEVERITY = {"critical", "major", "minor"}
REQUIRED_FINDING = ("id", "severity", "reviewer", "location", "description", "evidence")


def fail(msg, line=None, column=None, snippet=None):
    sys.stdout.write(json.dumps({
        "error": msg, "line": line, "column": column, "snippet": snippet
    }, ensure_ascii=False) + "\n")
    return 1


def main(argv):
    if not argv:
        sys.stderr.write("usage: validate_findings_json.py <reviewer.json>\n")
        return 2
    raw = open(argv[0], "r", encoding="utf-8").read()
    try:
        review = json.loads(raw)
    except json.JSONDecodeError as e:
        snippet = raw.splitlines()[e.lineno - 1][:120] if 0 < e.lineno <= len(raw.splitlines()) else None
        return fail("invalid JSON: %s" % e.msg, e.lineno, e.colno, snippet)

    if not isinstance(review, dict):
        return fail("top level must be an object")
    findings = review.get("findings")
    if not isinstance(findings, list):
        return fail("`findings` must be an array")

    for idx, f in enumerate(findings):
        if not isinstance(f, dict):
            return fail("finding %d is not an object" % idx)
        for field in REQUIRED_FINDING:
            if field not in f or f[field] in (None, ""):
                return fail("finding %d missing required field `%s`" % (idx, field), snippet=json.dumps(f)[:120])
        sev = str(f["severity"]).lower()
        if sev not in VALID_SEVERITY:
            return fail("finding %d has invalid severity %r (want one of %s)"
                        % (idx, f["severity"], sorted(VALID_SEVERITY)))

    sys.stderr.write("valid: %d findings\n" % len(findings))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
