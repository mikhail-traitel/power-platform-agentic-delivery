# Coverage tags

Five tags drive external enumeration. Assign every story one or more; each tag has its own external
source, so coverage does not depend on model recall.

| Tag | Covers | External enumeration source |
|-----|--------|-----------------------------|
| `data` | correctness of what is shown/stored | a live query against the source of truth |
| `ui` | presentation, states, layout | the agreed prototype / design contract |
| `roles` | who can see/do what | the role x scope permission matrix |
| `workflow` | legal/illegal state transitions | a decision table / state model |
| `integration` | contracts with other systems | the interface spec of each dependency |

For each assigned tag, produce a per-tag coverage check with an explicit disposition per item:
**asserted**, **needs-data** (state must be seeded), **pending** (owner + reason), or **descoped**
(reason). Track the rates - see the anti-abuse alarms in the skill.
