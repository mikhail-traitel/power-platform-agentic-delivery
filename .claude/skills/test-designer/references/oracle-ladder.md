# The oracle ladder

Runtime oracles are trimmed to two kinds. Everything else is a design-time cross-check.

## Allowed runtime oracles

- **equality** - an observed value equals an expected value that is re-derived from the live source at
  assert time (`derived_at_runtime: true`). No baked-in literal.
- **recency** - an item's timestamp is within an expected window (for "latest / most recent" claims).

## Forbidden as runtime oracles (design-time only)

Sum, subset, superset, disjoint, difference, A > B, ratios. These are **relational** - proving them
at runtime invites brittle, self-confirming assertions. Use them only while designing, to confirm an
oracle filter is correct, then re-express the proof as equality cases.

## Count-delta -> separate equality cases

Claim: *the visible total equals the sum of the included status buckets.*

Wrong (relational runtime oracle):
```
assert visibleTotal == active + approved + completed   # forbidden
```

Right (equality cases, each re-derived live):
```
case A: equality  visibleTotal      == <count of rows matching the visible filter, queried live>
case B: equality  count(status=Active)    == <live>
case C: equality  count(status=Approved)  == <live>
case D: equality  count(status=Excluded1) == 0
case E: equality  count(status=Excluded2) == 0
```
Per-bucket equality catches the **compensating-error blind spot**: a wrong-total bug and a
wrong-records bug can cancel to the right sum; per-bucket equality cannot be fooled that way.

## Metamorphic relations - design-time confirmation

Use the standard relation patterns (equivalence, equality, subset, disjoint, complete, difference) to
confirm your oracle filter is correct *while designing*. Then throw the relation away and ship
equality cases. Give the model the patterns plus real counts; do not expect it to invent them.

## The ladder (before you call a case "blocked")

Climb until you can assert, or you have a defensible reason not to:

1. **equality against the live source** - re-query the source of truth and assert equality.
2. **seeded precondition** (`needs_data`) - if the state you need does not exist, seed it, then assert.
3. **pending** - you genuinely cannot assert yet; record an `owner` and the reason.
4. **descoped** - out of scope for this story; record the reason.

"blocked/untestable" is the last resort and must attach the live query result that proves you tried
rung 1. A `pending` on a capability whose owner is already built is a hard-fail.
