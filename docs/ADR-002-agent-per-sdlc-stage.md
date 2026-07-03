# ADR-002: One agent per SDLC stage

## Status

Accepted.

## Context

Power Platform delivery spans distinct phases with different skills: gathering requirements, designing
a solution, building it across several technologies, testing it, and shipping it through ALM. A single
general agent asked to do all of this at once tends to blur the phases - it starts building before the
design is settled, or skips test thinking entirely.

## Decision

Model each SDLC phase as a focused Claude Code subagent (`.claude/agents/`) with a narrow system
prompt and a tool allowlist appropriate to the phase:

| Agent | Stage | Focus |
|-------|-------|-------|
| `ba-analyst` | Business analysis | Turn a request into clear user stories with acceptance criteria |
| `solution-architect` | Architecture | Data model, security model, integration and ALM design |
| `developer` | Development | Canvas / model-driven apps, C# plugins, Power Automate flows |
| `test-engineer` | Test | End-to-end verification (pairs with the Playwright samples) |
| `devops-engineer` | DevOps | Solution segmentation, environments, deployment |
| `design-reviewer` | Quality gate | Adversarial review of a design before build (see ADR-003) |

## Consequences

- Each agent stays in its lane; the handoffs between phases become explicit artifacts (a story, a
  design, a review verdict) rather than an undifferentiated stream.
- The design can be gated by the `design-reviewer` before the `developer` starts, which is where the
  highest-leverage defects are caught.
- Orchestration between agents is deliberately left to the human or a thin driver - this repo shows
  the agents and the quality layer, not a specific autonomous controller.

## Honest status

The `design-reviewer` and the deterministic rules/hooks are the most developed. The BA, architect,
developer, test, and DevOps agents are **starting templates** to adapt to your own conventions, not
finished specialists.
