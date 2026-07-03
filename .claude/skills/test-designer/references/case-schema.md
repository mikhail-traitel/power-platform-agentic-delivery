# Case schema

The shape of each entry in `cases.yaml`. Kept small and machine-validatable.

```yaml
cases:
  - id: TC-01
    title: "coordinator sees only their region's rows"
    tag: roles                 # one of: data | ui | roles | workflow | integration
    kills: F-ROLES-01          # a fault-catalog id (or NEW-<tag>-<n> proposed)
    proposed_fault: false      # true if `kills` is a freshly minted NEW-* id (flag for gate)
    given:
      - "coordinator in region R"
    when: "open the list"
    then:
      oracle: equality         # equality | recency  (relational oracles are forbidden here)
      expected: "<count of region-R rows, queried live>"
      derived_at_runtime: true # true = no baked-in literal; the oracle re-queries at assert time
    disposition: asserted      # asserted | needs_data | pending | descoped | blocked
    owner_story: null          # required when disposition is pending on another capability
    reason: null               # required for pending / descoped / blocked
```

Validation rules:
- Every case has a `kills` id. `proposed_fault: true` requires a `NEW-*` id and is flagged for the gate.
- `oracle` is `equality` or `recency` only.
- A numeric `expected` requires `derived_at_runtime: true` (no hardcoded counts).
- `pending` / `descoped` / `blocked` require a `reason`; `blocked` also requires an attached live query
  result proving rung 1 of the oracle ladder was attempted.
- A `pending` whose `owner_story` is already built is a hard-fail.
```
