# ADR-006: Eval-integrity guards (agent-gated hooks)

## Status

Accepted.

## Context

An adversarial review system is only trustworthy if the reviewers cannot cheat. Two failure modes are
specific to agentic reviewers:

1. A reviewer agent reads the **answer key** - the human resolutions, the grading scripts, the metrics
   log, a prior cross-model review - and tailors its findings to match. Fresh eyes are gone.
2. A reviewer agent edits its **own rubric or skill definition** at runtime to make its findings pass.

Neither is hypothetical; both are trivially exploitable if nothing prevents them.

## Decision

Enforce integrity with `PreToolUse` hooks that gate on the **calling agent type**:

- `block-eval-reads.js` denies `Read`/`Grep`/`Glob` of evaluation data - but only when the caller is
  one of the protected reviewer agents. The main session and every other agent are unaffected.
- `protect-skill-files.js` denies `Write`/`Edit` of the reviewer skill directories - again only for
  the protected reviewer agents, so you can still maintain those skills from the main session.

Both read the protected agent list and the protected paths from `.claude/hooks/config.json`, deny via
the `PreToolUse` `permissionDecision: "deny"` JSON, and **fail open** on anything unexpected - a guard
that crashes must never wedge the session.

## Consequences

- The reviewers are structurally prevented from contaminating their own review, rather than merely
  asked not to.
- The guards are provider-agnostic patterns: "this agent may not read the answer key" and "this agent
  may not edit its own rubric" transfer to any agentic eval setup.
- They depend on the harness surfacing the calling agent's type to the hook. Where it is not
  available, the hook fails open (allows) - integrity then rests on the review being run in a fresh
  context, which the pipeline already does.

## Note

These are safety rails for the *review* system, distinct from the authoring hooks (ADR-001) that block
bad code patterns. Same mechanism (`PreToolUse`), different job.
