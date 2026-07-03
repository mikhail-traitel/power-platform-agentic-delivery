# ADR-007: Fault-first test design

## Status

Accepted.

## Context

Asked to "write test cases," an LLM produces a thin, optimistic suite: a few happy paths, mid-range
values, one role. It recalls a small fraction of what a careful tester designs, and it inherits the
blind spots of whatever examples it was shown. Left unchecked, that produces a suite that is green and
worthless.

## Decision

Design tests **fault-first**, with coverage driven by **external enumeration**, and constrain the
oracle vocabulary.

1. **Fault-first.** Every case must name the fault it kills (a `fault-catalog.md` id). No unattached
   cases. If no catalog fault fits, mint a `NEW-*` proposed-fault and flag it for the human gate -
   which stops "fault-first" from being gamed by inventing a fault to justify a weak case.

2. **External enumeration beats recall.** Coverage comes from a catalog, a technique menu, a role
   matrix, and the live data - not from the model's memory. Tag the story, and enumerate each tag from
   its own external source.

3. **Trim the runtime oracle to `{equality, recency}`.** All relational reasoning (sum, subset, delta)
   is a design-time cross-check, then re-expressed as equality cases. Count-delta becomes one equality
   case per bucket, which also catches the compensating-error blind spot a sum-oracle misses. No
   literal counts baked in - the oracle re-derives from the live source at assert time.

4. **Input firewall.** The designer must not read the author's own tests or assertions; a leak-grep
   gate fails the run if harness tokens reach the model. Otherwise the model transcribes the author's
   blind spots instead of designing around them.

5. **Anti-abuse alarms.** High rates of unmapped controls, `needs_data`, or `pending` raise flags -
   a silent mapping collapse or a lazy designer produces a misleading all-green.

## Consequences

- The suite is designed against an explicit fault model, so its coverage is inspectable ("which faults
  does this kill?") rather than a vibe.
- The output is a reviewable `cases.yaml` for a human gate; nothing is auto-run.
- The equality-only oracle rule makes assertions robust to data drift and catches a class of bug
  (compensating errors) that sum-based checks cannot.

## Scope

This designs cases; execution (e.g. via a Playwright harness) is a separate concern. The value here is
the design discipline, which is framework-independent.
