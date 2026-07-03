#!/usr/bin/env python3
"""Evidence grounding by word-level LCS, with demotion (not deletion).

Why this exists: an LLM reviewer occasionally fabricates a quote to justify a finding.
But legitimate reviewers paraphrase and reorder far more than they typo. So:

  - Extract each finding's quoted span(s) from its `evidence` (matched pairs of real quote
    marks only; a straight apostrophe is not a delimiter, so contractions never parse as quotes).
  - Score each quote by normalized word-level Longest Common Subsequence against the
    reviewed document, matched inside a LOCAL WINDOW rather than the whole token stream.
    Locality matters: scored against the entire document, a fabricated quote made of common
    words scores spuriously high because unrelated tokens line up as a subsequence by chance,
    and the longer the document the worse it gets. Confining the match to a sliding window
    the size of the quote (with slack for paraphrase) forces the tokens to appear together
    and in order - which is what a real quote or a light paraphrase does, and what scattered
    fabrication does not. LCS still tolerates reordering and paraphrase within the window:
    verbatim quotes land ~1.0, light paraphrase ~0.7-0.95, and fabrication that invents claims
    absent from the document scores far lower (the window removes the whole-document scavenging
    that used to inflate such scores on long docs).
  - Below the threshold (default 0.65) we DEMOTE the finding one severity level and
    record why - we do NOT delete it. Demotion keeps the human reviewer's ability to
    see what was down-weighted (original_severity + demotion_reason).
  - A finding with no quote is an allowed observation: evidence_grounded = null, untouched.

Fail-open: if the document can't be read, nothing is demoted (favor keeping findings).

Usage:
    python verify_evidence.py <review.json> [--doc <document.md>]
    (defaults the document to review["document"])
"""
import json
import re
import sys

THRESHOLD = 0.65
# Quote delimiters must be MATCHED PAIRS of real quotation marks: straight or curly doubles,
# curly singles, or backticks. The straight apostrophe is deliberately NOT a delimiter - treating
# it as one turns contractions in ordinary reviewer prose ("doesn't ... doesn't") into fake
# quotes, which then score low against the document and spuriously demote honest findings, and
# truncates genuine quotes at the first contraction. Curly single quotes are safe: a contraction
# uses only the closing mark, never an opening one.
_QUOTE_RE = re.compile(r'"(.+?)"|“(.+?)”|‘(.+?)’|`(.+?)`', re.DOTALL)
_TOKEN_RE = re.compile(r"[a-z0-9]+")
_DEMOTE = {"critical": "major", "major": "minor", "minor": "minor"}


def tokenize(text):
    return _TOKEN_RE.findall(text.lower())


def lcs_len(a, b):
    """Length of the longest common subsequence of token lists a, b. O(len(a)*len(b))
    time, O(len(b)) space."""
    if not a or not b:
        return 0
    prev = [0] * (len(b) + 1)
    for x in a:
        cur = [0] * (len(b) + 1)
        for j, y in enumerate(b, 1):
            cur[j] = prev[j - 1] + 1 if x == y else (prev[j] if prev[j] >= cur[j - 1] else cur[j - 1])
        prev = cur
    return prev[-1]


def extract_quotes(evidence):
    quotes = []
    for m in _QUOTE_RE.finditer(evidence or ""):
        span = next((g for g in m.groups() if g is not None), "").strip()
        if len(span) >= 10:
            quotes.append(span)
    return quotes


def best_ratio(quote, doc_tokens):
    """Best normalized word-LCS of the quote against any LOCAL window of the document.

    A window of the quote length plus a slack margin (~1.3x) gives room for the reordering
    and insertions a legitimate paraphrase introduces, while denying a fabricated quote the
    whole document to scavenge a subsequence from. The step (<= window - quote_len) guarantees
    any contiguous quote-length span lands fully inside some window, so a verbatim quote still
    scores ~1.0. Falls back to whole-document LCS when the window would cover the whole doc.

    This sharply reduces the score inflation that whole-document LCS suffers on long documents,
    but it is not a proof against fabrication: a maximally adversarial quote built only from
    high-frequency words of a very repetitive document can still approach the threshold. That
    is why demotion is human-reviewable and the threshold is a tunable knob, not a hard gate.
    """
    q = tokenize(quote)
    m = len(q)
    n = len(doc_tokens)
    if m == 0 or n == 0:
        return 0.0
    win = min(n, m + max(3, m // 3))
    if win >= n:
        return lcs_len(q, doc_tokens) / m
    step = max(1, m // 3)
    best = 0
    for start in range(0, n - win + 1, step):
        r = lcs_len(q, doc_tokens[start:start + win])
        if r > best:
            best = r
            if best == m:
                return 1.0
    # ensure the final window is always considered even if the step skipped it
    tail = lcs_len(q, doc_tokens[n - win:])
    if tail > best:
        best = tail
    return best / m


def main(argv):
    if not argv:
        sys.stderr.write("usage: verify_evidence.py <review.json> [--doc <document.md>]\n")
        return 2
    review_path = argv[0]
    doc_path = None
    if "--doc" in argv:
        doc_path = argv[argv.index("--doc") + 1]

    with open(review_path, "r", encoding="utf-8") as fh:
        review = json.load(fh)
    doc_path = doc_path or review.get("document")

    doc_tokens = None
    if doc_path:
        try:
            with open(doc_path, "r", encoding="utf-8") as fh:
                doc_tokens = tokenize(fh.read())
        except OSError:
            doc_tokens = None

    if doc_tokens is None:
        sys.stderr.write("warning: document unreadable (%r); leaving findings ungrounded, no demotion\n" % doc_path)

    per_reviewer = {}
    for f in review.get("findings", []):
        quotes = extract_quotes(f.get("evidence", ""))
        if not quotes:
            f["evidence_grounded"] = None
            continue
        if doc_tokens is None:
            f["evidence_grounded"] = None
            continue
        ratio = max(best_ratio(q, doc_tokens) for q in quotes)
        grounded = ratio >= THRESHOLD
        f["evidence_grounded"] = grounded
        who = f.get("reviewer", "unknown")
        stats = per_reviewer.setdefault(who, [0, 0])
        stats[1] += 1
        if not grounded:
            stats[0] += 1
            sev = str(f.get("severity", "")).lower()
            demoted = _DEMOTE.get(sev, sev)
            if demoted != sev:
                f["original_severity"] = sev
                f["severity"] = demoted
                f["demotion_reason"] = "evidence not grounded in document (LCS %.2f < %.2f)" % (ratio, THRESHOLD)

    for who, (ungrounded, total) in per_reviewer.items():
        if total and ungrounded / total > 0.5:
            sys.stderr.write("drift signal: reviewer %s is %d/%d ungrounded (>50%%)\n" % (who, ungrounded, total))

    with open(review_path, "w", encoding="utf-8") as fh:
        fh.write(json.dumps(review, indent=2, ensure_ascii=False) + "\n")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
