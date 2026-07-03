# Fault catalog (generic, data-driven apps)

A living, append-only taxonomy of the faults a test case can kill. Every case names one id. If none
fits, mint a `NEW-<tag>-<n>` proposed-fault and flag it for the gate - never drop the case, never
mint a fault just to pass a weak case.

Tags: `data`, `ui`, `roles`, `workflow`, `integration`.

## F-DATA - data correctness

- **F-DATA-01 wrong-filter** - a list shows rows it should exclude, or hides rows it should include.
- **F-DATA-02 compensating-count** - the visible total is right but the underlying rows are wrong
  (two errors cancel). Killed only by per-bucket equality, not a sum.
- **F-DATA-03 partial-set / silent cap** - a query returns only the first page / a capped subset and
  the UI presents it as complete (see the platform delegation constraints).
- **F-DATA-04 stale / non-recent** - "latest" shows a stale record; recency window violated.
- **F-DATA-05 boundary** - off-by-one at a date/number boundary (inclusive vs exclusive window).
- **F-DATA-06 culture / format** - a date or number parsed under the wrong locale flips or drops
  values.
- **F-DATA-07 truncation** - a value silently truncated at a length limit on write.

## F-UI - presentation

- **F-UI-01 virtualization miscount** - asserting on rendered DOM rows instead of the true item count
  in a virtualized list.
- **F-UI-02 unit / scale** - a size/measure interpreted in the wrong unit.
- **F-UI-03 empty / error state** - the empty-result or error path is unhandled or misleading.
- **F-UI-04 prototype drift** - the built UI diverges from the agreed prototype contract (labels,
  fields, order).

## F-ROLES - authorization

- **F-ROLES-01 over-exposure** - a user sees data outside their scope (region/team/owner).
- **F-ROLES-02 under-exposure** - a user is denied data they should see.
- **F-ROLES-03 client-only enforcement** - a security rule enforced only in the UI, bypassable at the
  data layer.

## F-WORKFLOW - process

- **F-WORKFLOW-01 illegal transition** - a state change the process forbids is allowed.
- **F-WORKFLOW-02 missing precondition** - an action proceeds without its required precondition.
- **F-WORKFLOW-03 ordering / FK availability** - a dependent step runs before its dependency exists.
- **F-WORKFLOW-04 verification false-negative** - a "success" check passes despite a silent failure
  (driver never ran, empty result, swallowed exception).

## F-INT - integration

- **F-INT-01 contract mismatch** - the shape a caller sends does not match what the callee expects.
- **F-INT-02 idempotency** - a retried operation double-applies.
- **F-INT-03 pagination** - a multi-page read processes only the first page.

Append new ids as `NEW-<tag>-<n>` (proposed) and promote them at the gate once confirmed.
