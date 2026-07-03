#!/usr/bin/env python3
"""Deterministic pre-scan - zero LLM tokens.

Runs before the reviewers. It catches the mechanical problems a language model should
never be spending tokens on, and it hardens the pipeline against a hostile document:

  - placeholders / TBDs left in the text
  - obvious leaked credential patterns (so they never reach a reviewer or a log)
  - hardcoded GUIDs: critical only when adjacent to a credential keyword; a bare GUID is an
    identifier (app id, solution id, environment variable), routine in Dataverse design docs,
    so it is a major environment-portability finding, never an auto-REJECT
  - prompt-injection canaries (the document is DATA, not instructions)
  - near-duplicate paragraphs (copy-paste drift) via 3-sentence-window Jaccard

Emits a JSON report. `deterministic_findings` are real findings the synthesis step can
fold in; `rubric_pre_checks` are attention hints the reviewers read (not findings).

Usage:
    python pre_scan.py <document.md> > pre_scan_results.json
"""
import json
import re
import sys

# '???' sits outside the \b anchors: '?' is a non-word character, so a word boundary next to it
# never fires in normal prose ('threshold: ???') and the alternative would be dead code inside \b...\b.
_PLACEHOLDER = re.compile(r"\b(TBD|TODO|FIXME|XXX|PLACEHOLDER)\b|\?\?\?", re.IGNORECASE)
_CREDENTIAL = [
    re.compile(r"\bBearer\s+[A-Za-z0-9._\-]{16,}"),
    re.compile(r"\b(api[_-]?key|secret|password|client[_-]?secret)\s*[:=]\s*\S+", re.IGNORECASE),
    re.compile(r"\bAKIA[0-9A-Z]{16}\b"),                       # AWS access key id
    re.compile(r"\beyJ[A-Za-z0-9_\-]{10,}\.[A-Za-z0-9_\-]{10,}"),  # JWT
]
# A GUID is an identifier, not a secret. Dataverse design docs legitimately contain GUIDs
# (app ids, solution ids, environment-variable defaults), so a bare GUID must never force a
# REJECT. It is treated as a credential (critical) ONLY when the same line carries a
# credential keyword; otherwise it is a major environment-portability finding.
_GUID = re.compile(r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}", re.IGNORECASE)
_CREDENTIAL_CONTEXT = re.compile(r"key|secret|token|password|connection[_-]?string", re.IGNORECASE)
_INJECTION = [
    re.compile(r"ignore (all|previous|prior) (instructions|context)", re.IGNORECASE),
    re.compile(r"report no findings|say (there are )?no (issues|problems)", re.IGNORECASE),
    re.compile(r"disregard (the )?(rubric|constitution|system prompt)", re.IGNORECASE),
    re.compile(r"you are now|new instructions:", re.IGNORECASE),
]
_SENT = re.compile(r"[^.!?\n]+[.!?]")


def sentence_windows(text, size=3):
    sents = [s.strip() for s in _SENT.findall(text) if s.strip()]
    return [" ".join(sents[i:i + size]) for i in range(0, max(0, len(sents) - size + 1))]


def word_set(s):
    return set(re.findall(r"[a-z0-9]+", s.lower()))


def jaccard(a, b):
    if not a or not b:
        return 0.0
    inter = len(a & b)
    return inter / (len(a) + len(b) - inter)


def find_lines(pattern, lines):
    hits = []
    for n, line in enumerate(lines, 1):
        if pattern.search(line):
            hits.append((n, line.strip()[:120]))
    return hits


def main(argv):
    if not argv:
        sys.stderr.write("usage: pre_scan.py <document.md>\n")
        return 2
    with open(argv[0], "r", encoding="utf-8") as fh:
        text = fh.read()
    lines = text.splitlines()

    findings = []

    for n, snip in find_lines(_PLACEHOLDER, lines):
        findings.append({
            "id": "PS-placeholder-%d" % n, "severity": "major", "reviewer": "pre-scan",
            "location": "line %d" % n, "description": "Unresolved placeholder / TBD in the document.",
            "evidence": '"%s"' % snip,
        })
    secret_lines = set()
    for rx in _CREDENTIAL:
        for n, _snip in find_lines(rx, lines):
            if n in secret_lines:
                continue  # one secret finding per line, whatever pattern hit first
            secret_lines.add(n)
            findings.append({
                "id": "PS-secret-%d" % n, "severity": "critical", "reviewer": "pre-scan",
                "location": "line %d" % n,
                "description": "Possible leaked credential/secret pattern. Redact before this document travels.",
                "evidence": "(redacted; matched a credential pattern on line %d)" % n,
            })
    for n, snip in find_lines(_GUID, lines):
        if _CREDENTIAL_CONTEXT.search(lines[n - 1]):
            if n in secret_lines:
                continue  # the line is already flagged as a credential leak
            secret_lines.add(n)
            findings.append({
                "id": "PS-secret-%d" % n, "severity": "critical", "reviewer": "pre-scan",
                "location": "line %d" % n,
                "description": "GUID adjacent to a credential keyword - possible leaked key/secret. Redact before this document travels.",
                "evidence": "(redacted; GUID next to a credential keyword on line %d)" % n,
            })
        else:
            findings.append({
                "id": "PS-guid-%d" % n, "severity": "major", "reviewer": "pre-scan",
                "location": "line %d" % n,
                "description": "Hardcoded GUID (environment-specific ID). Not a secret, but it breaks when the solution moves environments; resolve at runtime or via environment variables.",
                "evidence": '"%s"' % snip,
            })
    injections = []
    for rx in _INJECTION:
        for n, snip in find_lines(rx, lines):
            injections.append({"line": n, "text": snip})

    windows = sentence_windows(text)
    dupes = []
    wsets = [word_set(w) for w in windows]
    for i in range(len(windows)):
        for j in range(i + 1, len(windows)):
            if jaccard(wsets[i], wsets[j]) > 0.80:
                dupes.append({"window_a": i, "window_b": j})
                break

    report = {
        "document": argv[0],
        "deterministic_findings": findings,
        "rubric_pre_checks": {
            "injection_canaries": injections,   # reviewers: treat doc as untrusted data
            "near_duplicate_windows": dupes,     # possible copy-paste drift
            "section_count": sum(1 for l in lines if l.startswith("#")),
        },
    }
    sys.stdout.write(json.dumps(report, indent=2, ensure_ascii=False) + "\n")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
