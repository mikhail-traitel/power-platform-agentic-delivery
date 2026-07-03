#!/usr/bin/env python3
"""Deterministic verdict computation - the single source of truth.

The LLM reviewers produce findings; they never decide the gate. This script counts
severities and applies one fixed rule, so the same findings always yield the same verdict.

Usage:
    python compute_verdict.py <review.json>        # rewrites the file in place
    cat review.json | python compute_verdict.py -   # reads stdin, writes stdout

Rule:
    REJECT  if critical >= 1 or major >= 3
    REVISE  if major >= 1
    APPROVE otherwise
"""
import json
import sys


def compute(findings):
    counts = {"critical": 0, "major": 0, "minor": 0}
    for f in findings:
        sev = str(f.get("severity", "")).lower()
        if sev in counts:
            counts[sev] += 1
    if counts["critical"] >= 1 or counts["major"] >= 3:
        verdict = "REJECT"
    elif counts["major"] >= 1:
        verdict = "REVISE"
    else:
        verdict = "APPROVE"
    return verdict, counts


def main(argv):
    if not argv:
        sys.stderr.write("usage: compute_verdict.py <review.json | ->\n")
        return 2
    path = argv[0]
    if path == "-":
        review = json.load(sys.stdin)
    else:
        with open(path, "r", encoding="utf-8") as fh:
            review = json.load(fh)

    verdict, counts = compute(review.get("findings", []))
    review["verdict"] = verdict
    review["counts"] = counts

    out = json.dumps(review, indent=2, ensure_ascii=False)
    if path == "-":
        sys.stdout.write(out + "\n")
    else:
        with open(path, "w", encoding="utf-8") as fh:
            fh.write(out + "\n")
        sys.stderr.write("verdict: %s  (critical=%d major=%d minor=%d)\n"
                         % (verdict, counts["critical"], counts["major"], counts["minor"]))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
