# ADR-003: Adversarial design review before build

## Status

Accepted.

## Context

The cheapest defect to fix is one caught before it is built. LLM-assisted delivery is fast at
producing a design, but the same agent is a weak reviewer of its own output - it rationalizes rather
than refutes. Power Platform makes this worse: designs can reference APIs that do not exist, assume
behavior the platform forbids, or ignore hard limits (delegation caps, column truncation, publish-time
validation) that only surface late.

## Decision

Gate a solution design with an **adversarial** review skill (`.claude/skills/design-review/`) before
development starts. Two principles:

1. **Reviewers do not edit what they review.** Review is a separate concern from authoring; a reviewer
   that can rewrite the design will smooth over problems instead of reporting them.
2. **Ground the review, then try to refute.** Each reviewer is pointed at public Microsoft Learn
   guidance and asked to *disprove* the design, not bless it. A finding must cite the constraint it
   violates.

Suggested reviewer lenses (run independently, then merge):

- **Consistency** - does the design contradict itself or the stated requirements?
- **Platform correctness** - does every referenced API, function, and limit actually exist and behave
  as assumed? (grounded in Microsoft Learn)
- **Source fidelity** - does every claim about the current solution match what is actually there,
  rather than an assumption?

Each finding gets a severity (critical / major / minor); reviewers never set a verdict. A single
verdict per review (APPROVE / REVISE / REJECT) is computed deterministically from the surviving
findings (see ADR-004).

## Consequences

- Design-level defects are caught at plan stage: nonexistent APIs, platform-constraint violations,
  and silent-data-loss risks surface before a line is written.
- The review is only as good as its grounding - an ungrounded reviewer invents findings. Demote or
  drop any finding that cannot cite a source.
- It costs an extra pass. That is the point: the pass is cheap relative to reworking a built solution.

## Non-goals

This ADR describes the *pattern*. It does not prescribe a specific number of reviewers, model, or
orchestration - tune those to the risk of the work.
