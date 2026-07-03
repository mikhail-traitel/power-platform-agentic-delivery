# Power Platform constraint catalog

`pp-constraint-catalog.yml` is a curated list of hard, commonly-violated Power Platform constraints -
the kind a design silently ignores until an implementer hits them. It powers the platform reviewer's
**constraint-coverage pass** (checking what a design fails to address), but it is useful on its own as
a checklist.

## What it is

- **Public and generic.** Every entry is documented Microsoft Power Platform behavior. Nothing here is
  specific to any project, tenant, or solution.
- **Structured** so it can be read by a tool or a human: id, domain, the constraint, why it bites,
  severity when silent vs violated, and a Microsoft Learn source pointer.

## Sourcing note (read this)

The constraints are stable, well-documented platform behaviors. The **exact numbers** (a length limit,
a threshold, a timeout) are the documented defaults at the time of writing and can change or be
configurable. The `source` field names the Microsoft Learn topic rather than pinning a deep URL,
because MS Learn URLs move. **Verify the current value against Microsoft Learn before relying on a
specific number.** Treat each entry as "check the current MS Learn value," not gospel.

## How the reviewer uses it

For a design in a given scope, the platform reviewer walks the relevant constraints and classifies
each as honored-implicitly, addressed-explicitly, or relevant-but-unaddressed/violated - raising a
finding only for the last case, at `severity_when_silent` or `severity_when_violated`.

## Contributing

Add a constraint only if it is public, documented, and causes a real failure when ignored. Cite the
Microsoft Learn topic. Keep it generic - no project-specific conventions.
