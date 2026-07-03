#!/usr/bin/env python3
"""Merge the reviewers' findings into one deduplicated, severity-ordered review.

Two reviewers often report the same defect in different words. We dedup on character
3-gram Jaccard similarity of (location + description); above the threshold the findings
are treated as the same issue. On a collision we keep the higher-severity copy, breaking
ties by reviewer trust order. Then we sort by severity and renumber F1..Fn.

Usage:
    python synthesize_findings.py <reviewer1.json> <reviewer2.json> ... > merged.json
"""
import json
import sys

JACCARD_THRESHOLD = 0.85
_SEV_RANK = {"critical": 0, "major": 1, "minor": 2}
_REVIEWER_RANK = {"consistency": 0, "alignment": 1, "platform": 2, "pre-scan": 3}


def trigrams(text):
    t = " ".join(text.lower().split())
    if len(t) < 3:
        return {t} if t else set()
    return {t[i:i + 3] for i in range(len(t) - 2)}


def jaccard(a, b):
    if not a or not b:
        return 0.0
    inter = len(a & b)
    return inter / (len(a) + len(b) - inter)


def key_text(f):
    return "%s %s" % (f.get("location", ""), f.get("description", ""))


def better(a, b):
    """Return the finding to keep between two duplicates."""
    ra = _SEV_RANK.get(str(a.get("severity", "")).lower(), 9)
    rb = _SEV_RANK.get(str(b.get("severity", "")).lower(), 9)
    if ra != rb:
        return a if ra < rb else b
    va = _REVIEWER_RANK.get(a.get("reviewer", ""), 9)
    vb = _REVIEWER_RANK.get(b.get("reviewer", ""), 9)
    return a if va <= vb else b


def main(argv):
    if not argv:
        sys.stderr.write("usage: synthesize_findings.py <reviewer.json> ...\n")
        return 2

    incoming = []
    document = None
    for path in argv:
        with open(path, "r", encoding="utf-8") as fh:
            review = json.load(fh)
        document = document or review.get("document")
        for f in review.get("findings", []):
            incoming.append(f)

    kept = []  # list of (trigram_set, finding)
    for f in incoming:
        grams = trigrams(key_text(f))
        dup_idx = None
        for i, (g, existing) in enumerate(kept):
            if jaccard(grams, g) >= JACCARD_THRESHOLD:
                dup_idx = i
                break
        if dup_idx is None:
            kept.append((grams, f))
        else:
            g, existing = kept[dup_idx]
            winner = better(existing, f)
            kept[dup_idx] = (g, winner)

    findings = [f for _, f in kept]
    findings.sort(key=lambda f: _SEV_RANK.get(str(f.get("severity", "")).lower(), 9))
    for i, f in enumerate(findings, 1):
        f["id"] = "F%d" % i

    merged = {
        "document": document,
        "reviewer": "synthesis",
        "findings": findings,
        "verdict": None,
        "counts": {"critical": 0, "major": 0, "minor": 0},
    }
    sys.stdout.write(json.dumps(merged, indent=2, ensure_ascii=False) + "\n")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
