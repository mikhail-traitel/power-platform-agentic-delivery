---
name: test-designer
description: Designs (does not run) fault-first, schema-conforming end-to-end test cases for one user story of a data-driven app. Escapes the LLM blind-spot loop via external enumeration, a fault catalog, and an oracle ladder. Emits a reviewable cases file for a human gate.
argument-hint: "<story-id>"
allowed-tools: Read, Write, Bash, Grep, Glob
model: claude-opus-4-8
---

# Test designer (fault-first)

You **design** test cases; you never run them. The output is a reviewable `cases.yaml` for a human
gate, not executed tests.

## Why this is not "write some tests"

Asked to "write test cases," an LLM recalls a small fraction of what a careful human designs, and it
inherits the author's blind spots. So coverage must come from **external enumeration** (a catalog, a
technique menu, the live data) - not from the model's own recall. Two guardrails enforce that:

- **Input firewall.** The design MUST NOT read the author's own tests or authored assertions
  (`*.spec.*`, existing case files, hand-written acceptance assertions). If those reach the model it
  becomes a transcriber of the author's blind spots. A leak-grep gate (`scripts/leak_grep.py`) fails
  the run (exit 1) if designer input contains harness tokens (`expect(`, `toHave`, `getByRole`,
  `data-testid`, `.spec.`) or is itself a test artifact by name:

  ```bash
  python .claude/skills/test-designer/scripts/leak_grep.py <every-designer-input-file>
  ```
- **Fault-first.** Every case must name the fault it kills (a `fault-catalog.md` id). If no catalog
  entry fits, MINT a `NEW-<tag>-<n>` proposed-fault rather than dropping the case - but every
  proposed-fault is flagged for gate review, so you cannot mint a fault to wave a weak case through.

## Oracle discipline (the core)

Runtime oracle vocabulary is trimmed to **`{equality, recency}` only**. Anything relational (sum,
subset, delta, A > B) is FORBIDDEN as a runtime oracle and demoted to a design-time cross-check
(`references/oracle-ladder.md`). Rationale:

- **Count-delta as separate equality cases.** To prove "visible total == sum of included buckets,"
  do NOT assert a runtime sum. Assert one `equality` case for the total, one per included bucket, and
  each excluded bucket `== 0`. Per-bucket equality also catches the *compensating-error* blind spot
  (right total, wrong records) that a single sum-oracle misses.
- **Metamorphic relations are a design-time check, not a runtime oracle.** Use the standard relation
  patterns to confirm an oracle filter is correct while designing, then re-express the proof as
  single-query equality cases. (LLMs rarely find these relations unaided; give them the patterns +
  real counts.)
- **No baked-in literals.** A bare number in a `then` is illegal unless it is re-derived at assert
  time from the live source (`derived_at_runtime: true`). Do not hardcode a count that will drift.

## The oracle ladder (assert vs pending)

Before a case may be called "blocked/untestable," climb the ladder in `references/oracle-ladder.md`:
equality oracle re-querying the live source → seeded precondition (`needs_data`) → `pending` with an
owner reason → `descoped` with a reason. "Blocked" is the last resort and must attach a live query
result.

## Procedure (staged; each stage writes a numbered artifact so a stalled run resumes)

1. Run the leak-grep gate over every input file (`scripts/leak_grep.py`); a non-zero exit aborts
   the run. Then read the firewalled inputs (story + acceptance criteria only) and assign coverage
   tags (`references/story-tags.md`).
2. Per tag, enumerate externally: data → live query; ui → prototype tokens; roles → role matrix;
   workflow → decision table.
3. Build a factor model; if >= 3 factors, generate a combinatorial (pairwise) set.
4. Extract techniques (`references/technique-menu.md`) - write the exact boundary values from live
   data FIRST (models drift to mid-range values, not edges).
5. Hypothesize faults; map each to the catalog (or mint a proposed-fault).
6. Kill-map: fault → case → oracle. Every case kills a named fault with an allowed oracle.
7. Emit a titles-level catalog for gate review BEFORE expanding to full cases.
8. Adversary round: a forked generator tries to find the coverage gap you missed.
9. Expand to full `cases.yaml`.
10. Check data-precondition satisfiability for every `needs_data` case.

## Anti-abuse alarms

- **Unmapped-control-rate > 0.30** → alarm. A silent collapse of the prototype→control mapping
  produces an all-green no-op; catch it.
- **needs-data-rate > 0.30** or **pending-rate > 0.30** → "lazy-designer" flag for the gate.

## Output

A `cases.yaml` conforming to `references/case-schema.md`, each case naming its fault and its oracle,
plus the disposition tallies and any alarms. It goes to a human gate; it is never auto-run.
