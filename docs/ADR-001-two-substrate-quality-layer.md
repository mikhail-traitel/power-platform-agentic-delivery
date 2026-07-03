# ADR-001: A two-substrate quality layer (rules + hooks)

## Status

Accepted.

## Context

An LLM coding agent working on Power Platform needs to respect a large body of conventions and hard
platform constraints. There are two different problems hidden in that sentence:

1. **Knowledge delivery** - the agent needs to *know* the relevant convention at the moment it is
   writing a given file (a C# plugin rule is irrelevant while editing a canvas app formula).
2. **Enforcement** - some rules are important enough that we cannot rely on the model choosing to
   comply; they must be *guaranteed*.

Putting everything in one giant instruction file fails both: it bloats context (the model reads C#
rules while editing JavaScript) and it still only *asks* the model to comply.

## Decision

Split the quality layer into two substrates:

- **Rules (`.claude/rules/`)** - markdown convention files for the model to read, scoped to the file
  type they apply to via the `paths` frontmatter. Claude Code loads a path-scoped rule only when the
  matching file is in play, so context stays small and relevant.
- **Hooks (`.claude/hooks/` wired in `.claude/settings.json`)** - deterministic `PreToolUse` guards
  that inspect an `Edit`/`Write` before it is applied and **block** known-bad patterns regardless of
  what the model intended.

Rules teach; hooks enforce. A rule is the right tool for "prefer X over Y"; a hook is the right tool
for "never ship Z".

## Consequences

- Context cost scales with the file being edited, not with the total ruleset.
- Critical patterns are enforced mechanically - a hook does not depend on model compliance.
- Two places to maintain. The rule and the hook for the same concern should agree (e.g. the
  JavaScript rule explains *why* `Xrm.Page` is deprecated; the `no-xrm-page` hook *blocks* it).

## Notes

Most shipped hook examples are regex-based; the ESM hook already escalates to an acorn AST parse, the pattern described next. For patterns where a regex is too
blunt (matching a construct, not a string), escalate the hook to a real parser (e.g. `acorn` for
JavaScript) inside the same `PreToolUse` script. The substrate is the same; only the matching
precision changes.
