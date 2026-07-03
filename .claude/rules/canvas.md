---
paths:
  - "**/CanvasApps/**"
  - "**/*.fx.yaml"
  - "**/*.pa.yaml"
---

# Canvas apps (Power Fx)

Conventions for canvas app formulas. Sourced from public Microsoft Learn canvas-app and delegation
guidance.

- **Mind delegation.** Non-delegable functions (many uses of `Search`, `Filter` with unsupported
  operators, etc.) fall back to a client-side row cap (default 500, max 2000). On a large data source
  this silently returns a partial set. Keep queries delegable, or the result is wrong, not just slow.
- **Do not load large datasets into memory.** Avoid `ClearCollect` of a big table just to filter it
  client-side; filter at the source instead.
- **Use named formulas and `With()`** to name intermediate values, rather than sprinkling global
  `Set()` calls. Named formulas recompute lazily and keep the app easier to reason about.
- **Load in parallel with `Concurrent()`** where independent data calls happen on start, instead of
  serial calls that stack latency.
- **Prefer `Switch()` over deeply nested `If()`** for readability and to avoid subtle precedence bugs.
- **Follow control naming conventions** - a type prefix per control (e.g. `gal` gallery, `btn`
  button, `lbl` label, `frm` form) so formulas that reference controls stay legible.
- **Do not duplicate business logic** already enforced server-side (security, mandatory validation).
  Client-side rules are UX, not enforcement.
