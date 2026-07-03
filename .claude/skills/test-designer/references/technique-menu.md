# Technique menu

A menu of test-design techniques the designer applies deliberately, plus the LLM bias each one
compensates for. Draw from external technique enumeration, not model recall.

| # | Technique | Use when | LLM bias it compensates |
|---|-----------|----------|-------------------------|
| T1 | Equivalence partitioning | An input has classes that behave alike | Model tests one happy value, skips the classes |
| T2 | Boundary value analysis | Any ordered/ranged input or window | **Model picks mid-range values, not edges - write the exact boundaries from live data FIRST** |
| T3 | Decision table | Multiple conditions combine to decide an outcome | Model tests a few combinations, not the grid |
| T4 | Pairwise / combinatorial | >= 3 independent factors | Model cannot hold the full cross-product |
| T5 | State transition | A workflow with legal/illegal moves | Model tests legal moves, forgets the illegal ones |
| T6 | Role / permission matrix | Access differs by role/scope | Model tests one role |
| T7 | Negative / adversarial scenarios | Any feature | Model is optimistic - defaults to the success path |

## Two-step extraction

1. **Enumerate techniques** relevant to the story's factors (do not pick cases yet).
2. **Instantiate** each with values sourced externally - boundaries from the live data, roles from the
   role matrix, combinations from a pairwise tool - and only then write cases.

## The boundary rule (T2), spelled out

Before writing any ranged-input case, query the live source for the actual min, max, and the values
straddling every boundary. Write those exact boundary cases first. Only then add representative
mid-range cases. This inverts the model's natural bias toward "typical" values that never exercise an
off-by-one.
