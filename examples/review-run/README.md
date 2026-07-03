# Worked review run

A committed, end-to-end run of the adversarial design review over
[`examples/sample-design.md`](../sample-design.md). It exists so the pipeline's headline
behavior is *shown running*, not just described, and so CI can prove the deterministic parts stay
deterministic.

## What is real vs. illustrative

The pipeline has two substrates. This example is explicit about which is which:

- **Illustrative (the LLM part).** The three reviewers are language-model agents, so their output
  is not reproducible byte-for-byte. To keep the example deterministic, the reviewer outputs are
  committed as **fixtures** under [`inputs/`](inputs/) - hand-authored to represent a realistic
  reviewer pass over the sample, in the exact findings schema the reviewers emit. `pre_scan.json` is
  the genuine output of `pre_scan.py` (it is deterministic).
- **Reproducible (the deterministic part).** Everything downstream of the reviewers -
  synthesis, evidence grounding, and the verdict - is pure script. Given the fixtures, it produces
  [`review.json`](review.json) identically every time. That is the property `npm run test:review`
  (and CI) enforces: regenerate from the fixtures and assert the result still equals the committed
  `review.json`.

## The run

Inputs: one deterministic pre-scan finding + two reviewer fixtures (`consistency`, `platform`).
The `alignment` reviewer is skipped here because the sample has no external source document to
align against.

Final verdict: **REJECT** (`critical=1, major=5, minor=1`).

Three behaviors worth reading the JSON for:

1. **The verdict is computed, not judged.** `compute_verdict.py` counted one surviving critical and
   applied the fixed rule (`REJECT if critical>=1 or major>=3`). No model decides the gate.

2. **A fabricated finding was demoted, not deleted (F2).** The platform fixture includes a finding
   whose quoted evidence - client-side column encryption - does **not** appear in the design. Word-level
   LCS scored it `0.23` against the document (below the `0.65` threshold), so
   `verify_evidence.py` dropped it from `critical` to `major` and recorded `original_severity` +
   `demotion_reason`. It stays visible so a human can overrule; it just loses its teeth. Note the
   verdict is still REJECT - because a *genuine* delegation critical (F1) remains. Grounding defends
   the gate against fabrication without hiding the model's failure mode.

3. **A paraphrase survived (F7).** The consistency reviewer quoted "Managers get a read only view
   across regions", a loose paraphrase of the document's "Managers get a read-only view across all
   regions." LCS tolerates the reordering/omission, so it grounded `true`. Grounding punishes
   fabrication, not honest paraphrase.

The genuine defects the reviewers caught in the sample: a delegation cap presented as a full result
set (F1), an unresolved `TBD` gate (F3/F5), security-by-UI-hide instead of a data-layer control (F4),
and a choice-column compared by localized label (F6).

## Regenerate it

From the repo root:

```bash
npm run test:review     # regenerates from the fixtures and asserts it equals review.json
```

or by hand:

```bash
S=.claude/skills/design-review/scripts
python $S/pre_scan.py examples/sample-design.md > examples/review-run/pre_scan.json
python $S/synthesize_findings.py \
  examples/review-run/inputs/pre_scan_findings.json \
  examples/review-run/inputs/consistency.json \
  examples/review-run/inputs/platform.json > /tmp/review.json
python $S/verify_evidence.py /tmp/review.json --doc examples/sample-design.md
python $S/compute_verdict.py /tmp/review.json
# /tmp/review.json now equals examples/review-run/review.json
```

## Files

```
review-run/
  README.md        this file
  pre_scan.json    genuine pre_scan.py output on the sample
  review.json      final synthesized + grounded + scored review (verdict: REJECT)
  inputs/
    pre_scan_findings.json   the pre-scan's deterministic_findings, shaped for synthesis
    consistency.json         consistency reviewer fixture
    platform.json            platform reviewer fixture (includes the fabricated F2 for the demo)
```
