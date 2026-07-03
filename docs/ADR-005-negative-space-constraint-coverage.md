# ADR-005: Negative-space constraint coverage

## Status

Accepted.

## Context

Term-driven review can only check claims the document makes. But the most expensive Power Platform
defects come from what a design **fails to mention** - a delegation cap nobody considered, a column
that will truncate, a view threshold that works in dev and breaks in production. A reviewer reading
top to bottom rarely notices an absence.

## Decision

Add a **constraint-coverage pass** to the platform reviewer that checks the design against an external
catalog of known constraints (`catalog/pp-constraint-catalog.yml`) rather than only against itself.

For a design in a given scope:

1. Identify the in-scope domain(s). If the domain is unclear, skip the pass rather than guess.
2. For each catalog constraint relevant to the scope, classify: **honored implicitly**, **addressed
   explicitly**, or **relevant-but-unaddressed / violated**.
3. Raise a finding only for the last case, at the catalog's `severity_when_silent` (unaddressed) or
   `severity_when_violated`, tagged with the constraint id as `platform_term`.

## Consequences

- The review now catches omissions, not just errors - the highest-leverage class of design defect.
- Coverage is only as good as the catalog. The catalog is public, generic, and versioned so it can
  grow; a self-growing vocabulary (platform findings feeding new terms back) is the natural extension.
- The "skip if the domain is unclear" rule keeps the pass from inventing irrelevant findings.

## Why an external catalog

Encoding the constraints as data (not prose in the prompt) means they can be listed, counted,
audited, and reused by a human as a plain checklist - and updated without touching the reviewer.
