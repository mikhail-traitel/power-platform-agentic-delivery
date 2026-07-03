# ADR-004: Deterministic verdict and evidence grounding

## Status

Accepted.

## Context

An LLM review pipeline has two reliability problems. First, the same design reviewed twice can yield
different gate decisions - run-to-run variance in exactly the part that must be reproducible. Second,
a reviewer occasionally fabricates a quote to justify a finding, and a fabricated critical can sink a
good design.

## Decision

Take the two things a language model is worst at - arithmetic gates and verbatim matching - out of the
model and into deterministic scripts.

1. **The verdict is computed, never judged.** `compute_verdict.py` counts severities and applies one
   fixed rule (`REJECT if critical>=1 or major>=3; REVISE if major>=1; else APPROVE`). The reviewers
   produce findings; they never decide the gate. Same findings in, same verdict out, always.

2. **Evidence is grounded by normalized word-level LCS inside a local window, and ungrounded
   findings are demoted, not deleted.** `verify_evidence.py` extracts each finding's quoted span and
   scores it by longest-common-subsequence over tokens - but against a *sliding window* of the
   document sized to the quote length plus a slack margin (~1.3x), not the whole token stream. LCS
   tolerates the reordering and paraphrase legitimate reviewers do (verbatim ~1.0, light paraphrase
   ~0.7-0.95), while fabrication that invents claims absent from the document scores far lower. Below
   the threshold (0.65) the finding drops one severity level and records `original_severity` +
   `demotion_reason`. The window sharply reduces, but does not fully eliminate, the inflation
   whole-document LCS suffers on long docs - a maximally adversarial quote reusing only frequent
   document words can still approach the threshold - which is exactly why demotion stays
   human-reviewable and the threshold is a tunable knob rather than a hard gate.

   Demotion, not deletion, is deliberate: a human still sees the down-weighted finding and can
   overrule. A finding with no quote is an allowed observation - left untouched.

## Consequences

- The reproducible parts of the pipeline are reproducible by construction.
- Fabricated findings lose their teeth without silently disappearing.
- The scripts are stdlib-only and abort on malformed input ("same input, same crash") so a corrupt
  intermediate never produces a confidently wrong verdict.
- Threshold choice (0.65) is a knob; tune it against a labeled set if you have one.

## Alternatives rejected

- **Let the LLM self-report a confidence and decide the verdict** - reintroduces the variance and the
  self-justification this ADR removes.
- **Delete ungrounded findings** - loses recall and hides the model's failure mode from the human.
- **Score LCS against the whole document** - on a long document, a fabricated quote of common words
  lines up as a subsequence by chance and scores spuriously high. The local window denies it the
  whole document to scavenge from, so grounding does not weaken as designs get longer.
