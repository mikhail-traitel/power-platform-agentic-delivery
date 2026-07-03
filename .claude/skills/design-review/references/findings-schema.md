# Findings schema

The contract every reviewer emits and every deterministic script consumes. Kept deliberately small.

## Review object

```json
{
  "document": "path/to/design.md",
  "reviewer": "consistency | alignment | platform | pre-scan",
  "findings": [ /* Finding[] */ ],
  "verdict": null,
  "counts": { "critical": 0, "major": 0, "minor": 0 }
}
```

`verdict` is `null` until `compute_verdict.py` sets it. Reviewers never set it.

## Finding object

| Field | Required | Notes |
|-------|----------|-------|
| `id` | yes | `F1`, `F2`, ... (renumbered on synthesis) |
| `severity` | yes | `critical` \| `major` \| `minor` |
| `reviewer` | yes | which lens produced it |
| `location` | yes | section heading / file:line the finding is about |
| `description` | yes | one clear sentence: the defect and why it matters |
| `evidence` | yes | a `"quoted span"` copied verbatim from the document (or, for alignment, doc quote + source quote). Enables deterministic grounding. |
| `rubric_id` | no | e.g. `U12`, `V1`, `X-03` |
| `platform_term` | no | platform findings only; feeds the vocabulary loop |
| `evidence_grounded` | no | set by `verify_evidence.py`: `true` \| `false` \| `null` (no quote to check) |
| `original_severity` | no | set on demotion by `verify_evidence.py` |
| `demotion_reason` | no | set on demotion |

## Severity meaning (shared constitution)

- **critical** - unsafe to act on the document as written; would cause a real failure.
- **major** - needs rework before proceeding.
- **minor** - could be better; not blocking.

## Verdict rule (deterministic, single source of truth)

```
REJECT  if critical >= 1  OR  major >= 3
REVISE  if major    >= 1
APPROVE otherwise
```
